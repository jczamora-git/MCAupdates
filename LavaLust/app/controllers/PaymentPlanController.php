<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Plan Controller
 * Handles payment plan and installment API endpoints
 */
class PaymentPlanController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('PaymentPlanModel');
        $this->call->model('InstallmentModel');
        $this->call->model('PaymentScheduleTemplateModel');
        $this->call->library('AuditLogger');
        $this->call->library('NotificationService');
        $this->call->library('session');
        $this->call->database();
    }

    /**
     * Get all payment plans
     * GET /api/payment-plans
     */
    public function get_plans()
    {
        header('Content-Type: application/json');
        
        try {
            $filters = [];
            
            // Check for filters using isset to avoid undefined key warnings
            if (isset($_GET['student_id'])) {
                $filters['student_id'] = $_GET['student_id'];
            }
            if (isset($_GET['academic_period_id'])) {
                $filters['academic_period_id'] = $_GET['academic_period_id'];
            }
            if (isset($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }
            if (isset($_GET['payment_type'])) {
                $filters['payment_type'] = $_GET['payment_type'];
            }

            $plans = $this->PaymentPlanModel->get_all($filters);
            
            echo json_encode([
                'success' => true,
                'data' => $plans ?: []
            ]);
        } catch (Exception $e) {
            error_log("Error fetching payment plans: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch payment plans'
            ]);
        }
    }

    /**
     * Get single payment plan
     * GET /api/payment-plans/{id}
     */
    public function get_plan($id)
    {
        header('Content-Type: application/json');
        
        try {
            $plan = $this->PaymentPlanModel->get_plan($id);
            
            if (!$plan) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Payment plan not found'
                ]);
                return;
            }

            echo json_encode([
                'success' => true,
                'data' => $plan
            ]);
        } catch (Exception $e) {
            error_log("Error fetching payment plan: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch payment plan'
            ]);
        }
    }

    /**
     * Create new payment plan with installments
     * POST /api/payment-plans
     */
    public function create_plan()
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validate required fields
            if (empty($input['student_id']) || empty($input['academic_period_id']) || 
                empty($input['total_tuition']) || empty($input['template_id'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields (student_id, academic_period_id, total_tuition, template_id)'
                ]);
                return;
            }

            // Fetch template and its installments
            $template = $this->PaymentScheduleTemplateModel->get_by_id($input['template_id']);
            if (!$template || $template['status'] !== 'active') {
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid or inactive payment schedule template'
                ]);
                return;
            }

            // Check if student already has active plan for this period
            if ($this->PaymentPlanModel->has_active_plan($input['student_id'], $input['academic_period_id'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Student already has an active payment plan for this academic period'
                ]);
                return;
            }

            // Create payment plan
            $plan_data = [
                'student_id' => $input['student_id'],
                'enrollment_id' => $input['enrollment_id'] ?? null,
                'academic_period_id' => $input['academic_period_id'],
                'total_tuition' => $input['total_tuition'],
                'total_paid' => 0,
                'balance' => $input['total_tuition'],
                'schedule_type' => $template['schedule_type'],
                'number_of_installments' => $template['number_of_installments'],
                'template_id' => $input['template_id'],
                'status' => 'Active'
            ];

            $plan_id = $this->PaymentPlanModel->create($plan_data);

            if (!$plan_id) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create payment plan'
                ]);
                return;
            }

            // Generate installments from template
            $installments = $this->generate_installments_from_template(
                $plan_id,
                $input['total_tuition'],
                $template,
                $input['academic_period_id'],
                $input['start_date'] ?? app_today()
            );

            $installments_created = $this->InstallmentModel->create_batch($installments);

            // Create audit log + notifications (same approach as PaymentController)
            try {
                $currentUser = [
                    'user_id' => $this->session->userdata('user_id'),
                    'role' => $this->session->userdata('role') ?: 'student',
                    'first_name' => $this->session->userdata('first_name'),
                    'last_name' => $this->session->userdata('last_name')
                ];

                $actor_name = trim(($currentUser['first_name'] ?? '') . ' ' . ($currentUser['last_name'] ?? ''));
                if (empty($actor_name)) {
                    $actor_name = 'System User';
                }

                $studentName = $actor_name;
                $studentQuery = $this->db->table('users')
                    ->select('first_name, last_name')
                    ->where('id', $input['student_id'])
                    ->get();
                if ($studentQuery) {
                    $resolvedName = trim(($studentQuery['first_name'] ?? '') . ' ' . ($studentQuery['last_name'] ?? ''));
                    if (!empty($resolvedName)) {
                        $studentName = $resolvedName;
                    }
                }

                $formattedTotal = number_format((float)$input['total_tuition'], 2);
                $scheduleType = $template['schedule_type'] ?? 'Installment';
                $installmentCount = (int)($template['number_of_installments'] ?? 0);
                $actorRole = $currentUser['role'] ?? 'student';
                $isStudentActor = in_array($actorRole, ['student', 'enrollee'], true);

                if ($isStudentActor) {
                    // Student created installment plan -> notify admins
                    $recipients = $this->NotificationService->getRecipientsByRole('admin');
                    $notifTitle = 'New Installment Plan Created';
                    $notifBody = "{$studentName} selected a {$scheduleType} tuition installment plan";
                    $notifActionUrl = '/admin/payment-plans';
                    $description = "{$studentName} created a {$scheduleType} installment plan (₱{$formattedTotal})";
                } else {
                    // Admin created installment plan -> notify student
                    $recipients = [[
                        'user_id' => $input['student_id'],
                        'role' => 'student'
                    ]];
                    $notifTitle = 'Installment Plan Approved';
                    $notifBody = "Your {$scheduleType} tuition installment plan has been created";
                    $notifActionUrl = '/enrollment/payment';
                    $description = "{$actor_name} created a {$scheduleType} installment plan for {$studentName} (₱{$formattedTotal})";
                }

                $notificationData = [
                    'type' => NotificationService::TYPE_INSTALLMENT_PLAN_CREATED,
                    'title' => $notifTitle,
                    'body' => $notifBody,
                    'icon' => 'calendar',
                    'action_url' => $notifActionUrl,
                    'push_data' => [
                        'screen' => 'PaymentPlans',
                        'payment_plan_id' => $plan_id
                    ],
                    'metadata' => [
                        'payment_plan_id' => $plan_id,
                        'student_id' => (int)$input['student_id'],
                        'enrollment_id' => isset($input['enrollment_id']) ? (int)$input['enrollment_id'] : null,
                        'academic_period_id' => (int)$input['academic_period_id'],
                        'total_tuition' => (float)$input['total_tuition'],
                        'schedule_type' => $scheduleType,
                        'number_of_installments' => $installmentCount
                    ],
                    'action' => 'payment_plan.created',
                    'entity_type' => 'payment_plan',
                    'entity_id' => $plan_id,
                    'actor_user_id' => $currentUser['user_id'] ?? null,
                    'actor_role' => $actorRole,
                    'actor_name' => $actor_name,
                    'description' => $description,
                    'recipients' => $recipients
                ];

                $notificationResult = $this->NotificationService->create($notificationData);

                // Fallback: if notification service fails, still write audit log
                if (!$notificationResult['success']) {
                    $this->AuditLogger->log([
                        'action' => 'payment_plan.created',
                        'entity_type' => 'payment_plan',
                        'entity_id' => $plan_id,
                        'actor_user_id' => $currentUser['user_id'] ?? null,
                        'actor_role' => $currentUser['role'] ?? 'student',
                        'actor_name' => $actor_name,
                        'description' => $description,
                        'metadata' => [
                            'payment_plan_id' => $plan_id,
                            'student_id' => (int)$input['student_id'],
                            'academic_period_id' => (int)$input['academic_period_id'],
                            'total_tuition' => (float)$input['total_tuition'],
                            'schedule_type' => $scheduleType,
                            'number_of_installments' => $installmentCount
                        ]
                    ]);
                }
            } catch (Exception $auditNotifError) {
                error_log('PaymentPlan audit/notification failed: ' . $auditNotifError->getMessage());

                // Last-resort fallback audit log
                try {
                    $this->AuditLogger->log([
                        'action' => 'payment_plan.created',
                        'entity_type' => 'payment_plan',
                        'entity_id' => $plan_id,
                        'actor_user_id' => $this->session->userdata('user_id') ?? null,
                        'actor_role' => $this->session->userdata('role') ?? 'student',
                        'actor_name' => trim(($this->session->userdata('first_name') ?? '') . ' ' . ($this->session->userdata('last_name') ?? '')),
                        'description' => 'Installment payment plan created',
                        'metadata' => [
                            'payment_plan_id' => $plan_id,
                            'student_id' => (int)$input['student_id'],
                            'academic_period_id' => (int)$input['academic_period_id'],
                            'total_tuition' => (float)$input['total_tuition'],
                            'schedule_type' => $template['schedule_type'] ?? 'Installment',
                            'number_of_installments' => (int)($template['number_of_installments'] ?? 0)
                        ]
                    ]);
                } catch (Exception $fallbackAuditError) {
                    error_log('PaymentPlan fallback audit log failed: ' . $fallbackAuditError->getMessage());
                }
            }

            echo json_encode([
                'success' => true,
                'message' => 'Payment plan created successfully',
                'data' => [
                    'plan_id' => $plan_id,
                    'installments_created' => $installments_created
                ]
            ]);

        } catch (Exception $e) {
            error_log("Error creating payment plan: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error creating payment plan: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update payment plan
     * PUT /api/payment-plans/{id}
     */
    public function update_plan($id)
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $result = $this->PaymentPlanModel->update($id, $input);
            
            echo json_encode([
                'success' => $result,
                'message' => $result ? 'Payment plan updated successfully' : 'Failed to update payment plan'
            ]);
        } catch (Exception $e) {
            error_log("Error updating payment plan: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error updating payment plan'
            ]);
        }
    }

    /**
     * Delete payment plan
     * DELETE /api/payment-plans/{id}
     */
    public function delete_plan($id)
    {
        header('Content-Type: application/json');
        
        try {
            // Delete associated installments first
            $this->InstallmentModel->delete_by_plan($id);
            
            // Delete payment plan
            $result = $this->PaymentPlanModel->delete($id);
            
            echo json_encode([
                'success' => $result,
                'message' => $result ? 'Payment plan deleted successfully' : 'Failed to delete payment plan'
            ]);
        } catch (Exception $e) {
            error_log("Error deleting payment plan: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error deleting payment plan'
            ]);
        }
    }

    /**
     * Get all installments across all payment plans (for reports/analytics)
     * GET /api/payment-plans/installments/all
     */
    public function get_all_installments()
    {
        header('Content-Type: application/json');

        try {
            $installments = $this->InstallmentModel->get_all();

            echo json_encode([
                'success' => true,
                'data' => $installments ?: []
            ]);
        } catch (Exception $e) {
            error_log("Error fetching all installments: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch installments'
            ]);
        }
    }

    /**
     * Get installments for a payment plan
     * GET /api/payment-plans/{id}/installments
     */
    public function get_installments($plan_id)
    {
        header('Content-Type: application/json');
        
        try {
            $installments = $this->InstallmentModel->get_by_plan($plan_id);
            
            echo json_encode([
                'success' => true,
                'data' => $installments ?: []
            ]);
        } catch (Exception $e) {
            error_log("Error fetching installments: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch installments'
            ]);
        }
    }

    /**
     * Update installment (due date, amount, etc.)
     * PUT /api/payment-plans/installments/{id}
     */
    public function update_installment($installment_id)
    {
        header('Content-Type: application/json');
        
        try {
            $existingInstallment = $this->InstallmentModel->get_installment($installment_id);
            $input = json_decode(file_get_contents('php://input'), true);
            
            $update_data = [];
            if (isset($input['due_date'])) {
                $update_data['due_date'] = $input['due_date'];
            }
            if (isset($input['amount_due'])) {
                $update_data['amount_due'] = $input['amount_due'];
                // Only recalculate balance if not explicitly provided
                if (!isset($input['balance'])) {
                    $installment = $this->InstallmentModel->get_installment($installment_id);
                    if ($installment) {
                        $update_data['balance'] = $input['amount_due'] - $installment['amount_paid'];
                    }
                }
            }
            if (isset($input['amount_paid'])) {
                $update_data['amount_paid'] = $input['amount_paid'];
            }
            if (isset($input['balance'])) {
                // Allow explicit balance setting (e.g., 0 for discounted payments)
                $update_data['balance'] = $input['balance'];
            }
            if (isset($input['status'])) {
                $update_data['status'] = $input['status'];
            }
            if (isset($input['paid_date'])) {
                $update_data['paid_date'] = $input['paid_date'];
            }
            if (isset($input['late_fee'])) {
                $update_data['late_fee'] = $input['late_fee'];
            }
            if (isset($input['days_overdue'])) {
                $update_data['days_overdue'] = $input['days_overdue'];
            }
            
            $result = $this->InstallmentModel->update($installment_id, $update_data);

            if ($result) {
                try {
                    $updatedInstallment = $this->InstallmentModel->get_installment($installment_id);
                    $plan = null;
                    if ($updatedInstallment && !empty($updatedInstallment['payment_plan_id'])) {
                        $plan = $this->PaymentPlanModel->get_plan($updatedInstallment['payment_plan_id']);
                    }

                    $currentUser = [
                        'user_id' => $this->session->userdata('user_id'),
                        'role' => $this->session->userdata('role') ?: 'admin',
                        'first_name' => $this->session->userdata('first_name'),
                        'last_name' => $this->session->userdata('last_name')
                    ];

                    $actorName = trim(($currentUser['first_name'] ?? '') . ' ' . ($currentUser['last_name'] ?? ''));
                    if (empty($actorName)) {
                        $actorName = 'Admin';
                    }

                    $description = "Installment #{$installment_id} updated";
                    if ($plan && isset($plan['student_name'])) {
                        $description = "Installment #{$installment_id} updated for {$plan['student_name']}";
                    }

                    // Audit log
                    $this->AuditLogger->log([
                        'action' => 'payment_plan.installment_updated',
                        'entity_type' => 'installment',
                        'entity_id' => $installment_id,
                        'actor_user_id' => $currentUser['user_id'] ?? null,
                        'actor_role' => $currentUser['role'] ?? 'admin',
                        'actor_name' => $actorName,
                        'description' => $description,
                        'metadata' => [
                            'payment_plan_id' => $updatedInstallment['payment_plan_id'] ?? null,
                            'installment_number' => $updatedInstallment['installment_number'] ?? null,
                            'old_due_date' => $existingInstallment['due_date'] ?? null,
                            'new_due_date' => $updatedInstallment['due_date'] ?? null,
                            'old_amount_due' => $existingInstallment['amount_due'] ?? null,
                            'new_amount_due' => $updatedInstallment['amount_due'] ?? null,
                            'old_balance' => $existingInstallment['balance'] ?? null,
                            'new_balance' => $updatedInstallment['balance'] ?? null,
                        ]
                    ]);

                    // Notify student when admin updates installment schedule/details
                    if (($currentUser['role'] ?? '') === 'admin' && $plan && !empty($plan['student_id'])) {
                        $notifResult = $this->NotificationService->create([
                            'type' => 'payment_plan.installment_updated',
                            'title' => 'Installment Schedule Updated',
                            'body' => 'Your installment payment details were updated by the admin.',
                            'icon' => 'calendar',
                            'action_url' => '/enrollment/payment',
                            'push_data' => [
                                'screen' => 'PaymentPlans',
                                'payment_plan_id' => $updatedInstallment['payment_plan_id'] ?? null,
                                'installment_id' => $installment_id
                            ],
                            'metadata' => [
                                'payment_plan_id' => $updatedInstallment['payment_plan_id'] ?? null,
                                'installment_id' => $installment_id,
                                'installment_number' => $updatedInstallment['installment_number'] ?? null,
                                'due_date' => $updatedInstallment['due_date'] ?? null,
                                'amount_due' => $updatedInstallment['amount_due'] ?? null
                            ],
                            'action' => 'payment_plan.installment_updated',
                            'entity_type' => 'installment',
                            'entity_id' => $installment_id,
                            'actor_user_id' => $currentUser['user_id'] ?? null,
                            'actor_role' => $currentUser['role'] ?? 'admin',
                            'actor_name' => $actorName,
                            'description' => $description,
                            'recipients' => [[
                                'user_id' => $plan['student_id'],
                                'role' => 'student'
                            ]]
                        ]);

                        if (!$notifResult['success']) {
                            error_log('PaymentPlan installment update notification failed: ' . ($notifResult['error'] ?? 'unknown error'));
                        }
                    }
                } catch (Exception $auditNotifError) {
                    error_log('PaymentPlan installment update audit/notification failed: ' . $auditNotifError->getMessage());
                }
            }
            
            echo json_encode([
                'success' => $result,
                'message' => $result ? 'Installment updated successfully' : 'Failed to update installment'
            ]);
        } catch (Exception $e) {
            error_log("Error updating installment: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error updating installment: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update "Upon Enrollment" installments with actual enrollment date
     * PUT /api/payment-plans/{id}/set-enrollment-date
     */
    public function set_enrollment_date($plan_id)
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (empty($input['enrollment_date'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'enrollment_date is required'
                ]);
                return;
            }
            
            // Update all installments with NULL due_date (Upon Enrollment) for this plan
            $updated = $this->db->table('installments')
                ->where('payment_plan_id', $plan_id)
                ->where('due_date', null)
                ->update(['due_date' => $input['enrollment_date']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment date set for Upon Enrollment installments',
                'installments_updated' => $updated
            ]);
        } catch (Exception $e) {
            error_log("Error setting enrollment date: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error setting enrollment date: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Generate installment schedule based on schedule type
     * For Quarterly: 4 payments (Aug, Nov, Feb, May)
     * For Monthly: 10 payments (Aug-May school year, 15th of each month)
     * For Semestral: 2 payments (Aug, Jan)
     * For Tri Semestral: 3 payments (Aug, Dec, Apr)
     */
    private function generate_installments($plan_id, $total_tuition, $num_installments, $academic_period_id, $schedule_type)
    {
        $installments = [];
        $amount_per_installment = $total_tuition / $num_installments;
        
        // Get academic period info to determine school year start
        $period = $this->db->table('academic_periods')
                          ->where('id', $academic_period_id)
                          ->get();
        
        // Default start date (August 1st of the school year)
        $school_year = $period ? $period['school_year'] : date('Y') . '-' . (date('Y') + 1);
        $year_parts = explode('-', $school_year);
        $start_year = $year_parts[0];
        
        // Quarterly installments based on quarters
        if ($schedule_type === 'Quarterly') {
            $due_dates = [
                $start_year . '-08-15',  // 1st Quarter
                $start_year . '-11-15',  // 2nd Quarter
                ($start_year + 1) . '-02-15',  // 3rd Quarter
                ($start_year + 1) . '-05-15'   // 4th Quarter
            ];
            
            for ($i = 0; $i < min($num_installments, 4); $i++) {
                $installments[] = [
                    'payment_plan_id' => $plan_id,
                    'installment_number' => $i + 1,
                    'amount_due' => $amount_per_installment,
                    'amount_paid' => 0,
                    'balance' => $amount_per_installment,
                    'due_date' => $due_dates[$i],
                    'status' => 'Pending',
                    'late_fee' => 0,
                    'days_overdue' => 0
                ];
            }
        }
        // Semestral: 2 payments
        elseif ($schedule_type === 'Semestral') {
            $due_dates = [
                $start_year . '-08-15',  // 1st Semester
                ($start_year + 1) . '-01-15'   // 2nd Semester
            ];
            
            for ($i = 0; $i < min($num_installments, 2); $i++) {
                $installments[] = [
                    'payment_plan_id' => $plan_id,
                    'installment_number' => $i + 1,
                    'amount_due' => $amount_per_installment,
                    'amount_paid' => 0,
                    'balance' => $amount_per_installment,
                    'due_date' => $due_dates[$i],
                    'status' => 'Pending',
                    'late_fee' => 0,
                    'days_overdue' => 0
                ];
            }
        }
        // Tri Semestral: 3 payments
        elseif ($schedule_type === 'Tri Semestral') {
            $due_dates = [
                $start_year . '-08-15',  // 1st Tri Semester
                $start_year . '-12-15',  // 2nd Tri Semester
                ($start_year + 1) . '-04-15'   // 3rd Tri Semester
            ];
            
            for ($i = 0; $i < min($num_installments, 3); $i++) {
                $installments[] = [
                    'payment_plan_id' => $plan_id,
                    'installment_number' => $i + 1,
                    'amount_due' => $amount_per_installment,
                    'amount_paid' => 0,
                    'balance' => $amount_per_installment,
                    'due_date' => $due_dates[$i],
                    'status' => 'Pending',
                    'late_fee' => 0,
                    'days_overdue' => 0
                ];
            }
        }
        // Monthly: 10 months (Aug-May)
        elseif ($schedule_type === 'Monthly') {
            $months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5]; // Aug to May
            
            for ($i = 0; $i < min($num_installments, 10); $i++) {
                $month = $months[$i];
                $year = $month >= 8 ? $start_year : ($start_year + 1);
                $due_date = $year . '-' . str_pad($month, 2, '0', STR_PAD_LEFT) . '-15';
                
                $installments[] = [
                    'payment_plan_id' => $plan_id,
                    'installment_number' => $i + 1,
                    'amount_due' => $amount_per_installment,
                    'amount_paid' => 0,
                    'balance' => $amount_per_installment,
                    'due_date' => $due_date,
                    'status' => 'Pending',
                    'late_fee' => 0,
                    'days_overdue' => 0
                ];
            }
        }

        
        return $installments;
    }

    /**
     * Generate installments from template (NEW METHOD)
     * Uses week-of-month scheduling from payment_schedule_installment_templates
     */
    private function generate_installments_from_template($plan_id, $total_amount, $template, $academic_period_id, $start_date)
    {
        $installments = [];
        
        // Get template installments
        $template_installments = $template['installments'] ?? [];
        
        if (empty($template_installments)) {
            error_log("No template installments found for template: " . $template['id']);
            return $installments;
        }
        
        // Get academic period for school year
        $period = $this->db->table('academic_periods')
                          ->where('id', $academic_period_id)
                          ->get();
        
        $school_year = $period ? $period['school_year'] : date('Y') . '-' . (date('Y') + 1);
        $year_parts = explode('-', $school_year);
        $start_year = (int)$year_parts[0];
        
        // Calculate amount per installment based on schedule type
        $num_installments = count($template_installments);
        $schedule_type = $template['schedule_type'] ?? '';
        
        // Monthly & Quarterly: First payment is 5000, remaining amount divided equally
        if ($schedule_type === 'Monthly' || $schedule_type === 'Quarterly') {
            $first_payment = 5000;
            $remaining_amount = $total_amount - $first_payment;
            $remaining_installments = $num_installments - 1;
            
            if ($remaining_installments > 0) {
                $amount_per_remaining = round($remaining_amount / $remaining_installments, 2);
                // Adjust last installment for rounding
                $total_allocated = $first_payment + ($amount_per_remaining * ($remaining_installments - 1));
                $last_installment_amount = $total_amount - $total_allocated;
            } else {
                // Edge case: only 1 installment
                $amount_per_remaining = 0;
                $last_installment_amount = $first_payment;
            }
        } else {
            // Semestral & Tri Semestral: Equal division as before
            $amount_per_installment = round($total_amount / $num_installments, 2);
            $total_allocated = $amount_per_installment * ($num_installments - 1);
            $last_installment_amount = $total_amount - $total_allocated;
        }
        
        foreach ($template_installments as $index => $template_inst) {
            $due_date = $this->calculate_due_date_from_template(
                $template_inst,
                $start_year,
                $start_date
            );
            
            // Determine amount for this installment
            if ($schedule_type === 'Monthly' || $schedule_type === 'Quarterly') {
                if ($index === 0) {
                    $installment_amount = $first_payment;
                } elseif ($index === $num_installments - 1) {
                    $installment_amount = $last_installment_amount;
                } else {
                    $installment_amount = $amount_per_remaining;
                }
            } else {
                $installment_amount = ($index === $num_installments - 1) ? $last_installment_amount : $amount_per_installment;
            }
            
            // Create installment data
            $installment_data = [
                'payment_plan_id' => $plan_id,
                'installment_number' => $template_inst['installment_number'],
                'amount_due' => $installment_amount,
                'amount_paid' => 0,
                'balance' => $installment_amount,
                'status' => 'Pending',
                'late_fee' => 0,
                'days_overdue' => 0
            ];
            
            // Only set due_date if it's not null (Upon Enrollment can be null for flexibility)
            if ($due_date !== null) {
                $installment_data['due_date'] = $due_date;
            }
            
            $installments[] = $installment_data;
        }
        
        return $installments;
    }
    
    /**
     * Calculate actual due date from template week-of-month rule
     * Returns NULL for "Upon Enrollment" if no enrollment date provided (for flexibility)
     */
    private function calculate_due_date_from_template($template_inst, $start_year, $enrollment_date)
    {
        $week_of_month = $template_inst['week_of_month'];
        $month = $template_inst['month'];
        
        // Handle "Upon Enrollment"
        if ($week_of_month === 'Upon Enrollment') {
            // If no enrollment date provided, return NULL for flexibility
            // This allows setting the due date later when actual enrollment happens
            if (empty($enrollment_date) || $enrollment_date === '0000-00-00') {
                return null;
            }
            return $enrollment_date;
        }
        
        // Parse month ("01" to "12")
        $month_num = (int)$month;
        
        // Determine year (Jan-Jul is next year, Aug-Dec is current year)
        $year = ($month_num >= 1 && $month_num <= 7) ? $start_year + 1 : $start_year;
        
        // Calculate day based on week
        $day = $this->get_day_from_week($week_of_month, $year, $month_num);
        
        return sprintf('%04d-%02d-%02d', $year, $month_num, $day);
    }
    
    /**
     * Get actual day number from week-of-month label
     */
    private function get_day_from_week($week_label, $year, $month)
    {
        // Week definitions:
        // 1st week = 1-7 → use day 5 (Friday of 1st week)
        // 2nd week = 8-14 → use day 12 (Friday of 2nd week)
        // 3rd week = 15-21 → use day 19 (Friday of 3rd week)
        // 4th week = 22-28 → use day 26 (Friday of 4th week)
        // Last week = use 2nd to last day of month
        
        switch ($week_label) {
            case '1st week':
                return 5;
            case '2nd week':
                return 12;
            case '3rd week':
                return 19;
            case '4th week':
                return 26;
            case 'Last week':
                // Get last day of month minus 1
                $last_day = cal_days_in_month(CAL_GREGORIAN, $month, $year);
                return max(1, $last_day - 1);
            default:
                return 15; // Default to mid-month
        }
    }

    /**
     * Mark payment-plan related notifications as read for current admin user by plan ID.
     * POST /api/payment-plans/{id}/mark-notifications-read
     */
    public function mark_plan_notifications_as_read($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        $role = (string)$this->session->userdata('role');
        if (strtolower($role) !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $user_id = (int)$this->session->userdata('user_id');
            $plan_id = (int)$id;

            $rows = $this->db->table('notifications')
                ->select('id, entity_type, action_url')
                ->where('user_id', $user_id)
                ->where('entity_id', $plan_id)
                ->where('is_read', 0)
                ->where('is_archived', 0)
                ->get_all();

            $candidateIds = [];
            foreach ($rows as $row) {
                $entityType = strtolower((string)($row['entity_type'] ?? ''));
                $actionUrl = strtolower((string)($row['action_url'] ?? ''));

                $isPlanNotification =
                    in_array($entityType, ['payment_plan', 'payment_plans', 'installment'], true) &&
                    strpos($actionUrl, '/admin/payment-plans') !== false;

                if ($isPlanNotification && !empty($row['id'])) {
                    $candidateIds[] = (int)$row['id'];
                }
            }

            if (empty($candidateIds)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'No matching unread payment-plan notifications for current user',
                    'marked_count' => 0,
                    'candidate_notification_ids' => []
                ]);
                return;
            }

            $markedCount = 0;
            foreach ($candidateIds as $notificationId) {
                $updated = $this->db->table('notifications')
                    ->where('id', $notificationId)
                    ->where('user_id', $user_id)
                    ->where('is_read', 0)
                    ->update([
                        'is_read' => 1,
                        'read_at' => app_now()
                    ]);

                if ($updated) {
                    $markedCount++;
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Notifications marked as read',
                'marked_count' => $markedCount,
                'candidate_notification_ids' => $candidateIds
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}
