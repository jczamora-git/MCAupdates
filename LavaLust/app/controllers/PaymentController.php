<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Controller
 * Handles payment operations and API endpoints
 */
class PaymentController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('PaymentModel');
        $this->call->model('PaymentDiscountApplicationModel');
        $this->call->model('PaymentPenaltyModel');
        $this->call->library('AuditLogger');
        $this->call->library('NotificationService');
        $this->call->library('session');
        $this->call->helper('notification_templates');
        $this->call->database();
    }

    /**
     * Check if a reference number already exists
     * GET /api/payments/check-reference?reference=MCC-INV-20260206-123456-789
     */
    public function check_reference()
    {
        header('Content-Type: application/json');
        
        try {
            $reference = $this->io->get('reference');
            
            if (empty($reference)) {
                echo json_encode([
                    'success' => false,
                    'exists' => false,
                    'message' => 'Reference number is required'
                ]);
                return;
            }

            // Check if reference number exists in payments table
            $exists = $this->PaymentModel->reference_exists($reference);

            echo json_encode([
                'success' => true,
                'exists' => $exists,
                'reference' => $reference
            ]);

        } catch (Exception $e) {
            error_log('Check reference error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'exists' => false,
                'message' => 'Error checking reference number'
            ]);
        }
    }

    /**
     * Check if a service period has already been paid
     * GET /api/payments/check-service-period?student_id=123&month=3&year=2026
     */
    public function check_service_period()
    {
        header('Content-Type: application/json');
        
        try {
            $student_id = $this->io->get('student_id');
            $month = $this->io->get('month');
            $year = $this->io->get('year');
            
            if (empty($student_id) || empty($month) || empty($year)) {
                echo json_encode([
                    'success' => false,
                    'paid' => false,
                    'message' => 'student_id, month, and year are required'
                ]);
                return;
            }

            // Check if this student already paid for this service period
            $result = $this->db->raw(
                'SELECT id FROM payments WHERE student_id = ? AND is_recurring_service = 1 AND service_period_month = ? AND service_period_year = ? AND status IN (?, ?, ?) LIMIT 1',
                [$student_id, $month, $year, 'Approved', 'Verified', 'Pending']
            )->fetch(\PDO::FETCH_ASSOC);

            $paid = !empty($result);

            echo json_encode([
                'success' => true,
                'paid' => $paid,
                'student_id' => $student_id,
                'month' => $month,
                'year' => $year
            ]);

        } catch (Exception $e) {
            error_log('Check service period error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'paid' => false,
                'message' => 'Error checking service period'
            ]);
        }
    }

    /**
     * Get payments by enrollment IDs (batch lookup)
     * GET /api/payments/by-enrollment?enrollment_ids=1,2,3,4
     * Returns enrollment IDs that have associated payments
     */
    public function by_enrollment()
    {
        header('Content-Type: application/json');
        
        try {
            $enrollment_ids_param = $this->io->get('enrollment_ids');
            
            if (empty($enrollment_ids_param)) {
                echo json_encode([
                    'success' => true,
                    'data' => []
                ]);
                return;
            }

            // Parse comma-separated enrollment IDs
            $enrollment_ids = array_map('intval', explode(',', $enrollment_ids_param));
            $enrollment_ids = array_filter($enrollment_ids); // Remove zeros

            if (empty($enrollment_ids)) {
                echo json_encode([
                    'success' => true,
                    'data' => []
                ]);
                return;
            }

            // Build IN clause for raw SQL query
            $placeholders = implode(',', array_fill(0, count($enrollment_ids), '?'));
            
            // Query payments table for these enrollment IDs using raw SQL
            // Only return enrollments with Approved payments
            $sql = "SELECT DISTINCT enrollment_id, status 
                    FROM payments 
                    WHERE enrollment_id IN ($placeholders) 
                    AND enrollment_id IS NOT NULL 
                    AND status = 'Approved'";
            
            $query = $this->db->raw($sql, $enrollment_ids);

            $paid_enrollments = [];
            if ($query) {
                foreach ($query as $row) {
                    $paid_enrollments[] = [
                        'enrollment_id' => (int)$row['enrollment_id'],
                        'status' => $row['status']
                    ];
                }
            }

            echo json_encode([
                'success' => true,
                'data' => $paid_enrollments
            ]);

        } catch (Exception $e) {
            error_log('Get payments by enrollment error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'data' => [],
                'message' => 'Error fetching payment status for enrollments'
            ]);
        }
    }

    /**
     * Get all payments with optional filters
     * GET /api/payments
     */
    public function get_payments()
    {
        header('Content-Type: application/json');
        
        try {
            // Safely get GET parameters - check if they exist first
            $filters = [];
            
            if (isset($_GET['student_id']) && !empty($_GET['student_id'])) {
                $filters['student_id'] = $_GET['student_id'];
            }
            
            if (isset($_GET['academic_period_id']) && !empty($_GET['academic_period_id'])) {
                $filters['academic_period_id'] = $_GET['academic_period_id'];
            }
            
            if (isset($_GET['payment_type']) && !empty($_GET['payment_type'])) {
                $filters['payment_type'] = $_GET['payment_type'];
            }
            
            if (isset($_GET['status']) && !empty($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }
            
            if (isset($_GET['date_from']) && !empty($_GET['date_from'])) {
                $filters['date_from'] = $_GET['date_from'];
            }
            
            if (isset($_GET['date_to']) && !empty($_GET['date_to'])) {
                $filters['date_to'] = $_GET['date_to'];
            }

            $payments = $this->PaymentModel->get_all($filters);

            // Add has_been_refunded flag to each payment
            foreach ($payments as &$payment) {
                $refundCheck = $this->db->raw(
                    "SELECT COUNT(*) as refund_count FROM payments WHERE original_payment_id = ? AND is_refund = 1",
                    [$payment['id']]
                );
                $refundRows = $refundCheck ? $refundCheck->fetchAll(PDO::FETCH_ASSOC) : [];
                $payment['has_been_refunded'] = !empty($refundRows) && intval($refundRows[0]['refund_count'] ?? 0) > 0;
            }
            unset($payment); // Break reference

            echo json_encode([
                'success' => true,
                'data' => $payments,
                'count' => count($payments)
            ]);

        } catch (Exception $e) {
            error_log('Get payments error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching payments'
            ]);
        }
    }

    /**
     * Get payments for a specific student
     * GET /api/payments/student/{student_id}
     */
    public function get_payments_by_student($student_id)
    {
        header('Content-Type: application/json');
        
        try {
            // Validate student_id
            if (!is_numeric($student_id) || $student_id <= 0) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid student ID'
                ]);
                return;
            }

            // Get payments for this student
            $payments = $this->PaymentModel->get_all(['student_id' => $student_id]);

            echo json_encode([
                'success' => true,
                'payments' => $payments,
                'count' => count($payments)
            ]);

        } catch (Exception $e) {
            error_log('Get payments by student error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching payments for student'
            ]);
        }
    }

    /**
     * Get single payment by ID
     * GET /api/payments/{id}
     */
    public function get_payment($id)
    {
        header('Content-Type: application/json');
        
        try {
            $payment = $this->PaymentModel->get_payment($id);

            if (!$payment) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Payment not found'
                ]);
                return;
            }

            echo json_encode([
                'success' => true,
                'data' => $payment
            ]);

        } catch (Exception $e) {
            error_log('Get payment error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching payment'
            ]);
        }
    }

    /**
     * Create new payment
     * POST /api/payments
     * Supports both JSON and multipart/form-data for file uploads
     */
    public function create_payment()
    {
        header('Content-Type: application/json');

        try {
            $data = [];
            $proof_of_payment_url = null;

            // Check if this is a multipart form request (with file upload)
            $content_type = $_SERVER['CONTENT_TYPE'] ?? '';
            if (strpos($content_type, 'multipart/form-data') !== false) {
                // Handle multipart form data with file upload
                $data = $_POST;

                // Handle proof of payment file upload
                if (isset($_FILES['proof_of_payment']) && $_FILES['proof_of_payment']['error'] !== UPLOAD_ERR_NO_FILE) {
                    // Load the proof of payment helper
                    require_once APP_DIR . 'helpers/proof_of_payment_helper.php';

                    $upload_result = upload_proof_of_payment('proof_of_payment');

                    if (!$upload_result['success']) {
                        echo json_encode([
                            'success' => false,
                            'message' => 'File upload failed: ' . $upload_result['message']
                        ]);
                        return;
                    }

                    $proof_of_payment_url = $upload_result['relative_path'];
                }
            } else {
                // Handle regular JSON request
                $data = json_decode(file_get_contents('php://input'), true);
            }

            // Log the received data for debugging
            error_log('Payment creation request: ' . json_encode($data));

            // Validate required fields
            if (empty($data['student_id']) || empty($data['amount']) || empty($data['payment_for'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields: student_id, amount, and payment_for are required'
                ]);
                return;
            }

            // Add proof of payment URL if uploaded
            if ($proof_of_payment_url) {
                $data['proof_of_payment_url'] = $proof_of_payment_url;
            }

            // Extract penalty information (don't save to payments table)
            $penalty_amount = isset($data['penalty_amount']) ? $data['penalty_amount'] : 0;
            $days_overdue = isset($data['days_overdue']) ? $data['days_overdue'] : 0;
            $installment_id = isset($data['installment_id']) ? $data['installment_id'] : null;
            $explanation_id = isset($data['explanation_id']) ? $data['explanation_id'] : null;
            
            // Extract discount template IDs (don't save to payments table)
            $discount_template_ids = isset($data['discount_template_ids']) ? $data['discount_template_ids'] : [];
            
            // Remove penalty and discount fields from payment data
            unset($data['penalty_amount']);
            unset($data['days_overdue']);
            unset($data['explanation_id']);
            unset($data['discount_template_ids']);

            // Handle recurring service payments (like Service Fee)
            if (isset($data['is_recurring_service']) && $data['is_recurring_service'] == 1) {
                // Validate service period fields
                if (empty($data['service_period_month']) || empty($data['service_period_year'])) {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Service period month and year are required for recurring service payments'
                    ]);
                    return;
                }

                // Check if this service period has already been paid
                $existingPayment = $this->db->raw(
                    'SELECT id FROM payments WHERE student_id = ? AND is_recurring_service = 1 AND service_period_month = ? AND service_period_year = ? AND status IN (?, ?, ?) LIMIT 1',
                    [
                        $data['student_id'],
                        $data['service_period_month'],
                        $data['service_period_year'],
                        'Approved',
                        'Verified',
                        'Pending'
                    ]
                )->fetch(\PDO::FETCH_ASSOC);

                if (!empty($existingPayment)) {
                    $monthName = date('F', mktime(0, 0, 0, $data['service_period_month'], 1));
                    echo json_encode([
                        'success' => false,
                        'message' => "Service Fee for {$monthName} {$data['service_period_year']} has already been paid"
                    ]);
                    return;
                }
            }

            // Note: We don't check for duplicate reference numbers here since the frontend
            // already generates unique references and validates them. This avoids false positives.

            $paymentId = $this->PaymentModel->create($data);

            if ($paymentId) {
                // Debug logging
                error_log('Payment created with ID: ' . $paymentId);
                error_log('Penalty amount: ' . $penalty_amount);
                error_log('Installment ID: ' . $installment_id);
                error_log('Days overdue: ' . $days_overdue);
                
                // If there's a penalty, create a penalty record
                if ($penalty_amount > 0 && $installment_id) {
                    error_log('Entering penalty creation block...');
                    try {
                        // Get the original installment amount
                        error_log('Fetching installment data for ID: ' . $installment_id);
                        $installment = $this->db->table('installments')
                            ->where('id', $installment_id)
                            ->get();
                        
                        error_log('Installment query result: ' . print_r($installment, true));
                        
                        // get() returns a single row as associative array
                        $original_amount = ($installment && isset($installment['amount_due'])) ? $installment['amount_due'] : 0;
                        
                        error_log('Original amount: ' . $original_amount);
                        
                        $penaltyData = [
                            'installment_id' => $installment_id,
                            'penalty_percentage' => 5.00, // 5% as per school policy
                            'penalty_amount' => $penalty_amount,
                            'original_amount' => $original_amount,
                            'days_overdue' => $days_overdue,
                            'applied_at' => app_now()
                        ];
                        
                        // Include explanation_id if provided
                        if ($explanation_id) {
                            $penaltyData['explanation_id'] = $explanation_id;
                        }
                        
                        error_log('Penalty data to insert: ' . print_r($penaltyData, true));
                        
                        $penaltyId = $this->PaymentPenaltyModel->create($penaltyData);
                        
                        error_log('PaymentPenaltyModel->create returned: ' . ($penaltyId ? $penaltyId : 'false'));
                        
                        if ($penaltyId) {
                            error_log('SUCCESS: Penalty record created (ID: ' . $penaltyId . ') for installment ' . $installment_id . ': ₱' . $penalty_amount);
                        } else {
                            error_log('FAILED: create() returned false for installment ' . $installment_id);
                        }
                    } catch (Throwable $e) {
                        error_log('EXCEPTION creating penalty record: ' . $e->getMessage());
                        error_log('Error file: ' . $e->getFile() . ' line ' . $e->getLine());
                        error_log('Error trace: ' . $e->getTraceAsString());
                        // Don't fail the payment if penalty record fails
                    }
                } else {
                    error_log('Penalty creation skipped - penalty_amount: ' . $penalty_amount . ', installment_id: ' . $installment_id);
                }
                
                // Apply discounts if any were provided
                if (!empty($discount_template_ids) && is_array($discount_template_ids)) {
                    error_log('Applying ' . count($discount_template_ids) . ' discounts to payment ' . $paymentId);
                    
                    // Get payment details to calculate discounts
                    $payment = $this->PaymentModel->get_payment($paymentId);
                    $original_amount = floatval($payment['amount']);
                    
                    foreach ($discount_template_ids as $template_id) {
                        try {
                            // Get discount template details
                            $template = $this->db->table('discount_templates')
                                ->where('id', $template_id)
                                ->get();
                            
                            if ($template) {
                                // Calculate discount amount
                                $discount_amount = $this->PaymentDiscountApplicationModel->calculate_discount_amount(
                                    $original_amount,
                                    $template['value_type'],
                                    $template['value']
                                );
                                
                                // Apply the discount
                                $result = $this->PaymentDiscountApplicationModel->apply_discount(
                                    $paymentId,
                                    $template_id,
                                    $discount_amount
                                );
                                
                                if ($result['success']) {
                                    error_log("Applied discount '{$template['name']}' (₱{$discount_amount}) to payment {$paymentId}");
                                } else {
                                    error_log("Failed to apply discount {$template_id}: {$result['message']}");
                                }
                            }
                        } catch (Exception $e) {
                            error_log("Error applying discount {$template_id}: " . $e->getMessage());
                            // Continue with other discounts even if one fails
                        }
                    }
                }
                
                // Get updated payment with discounts applied
                $payment = $this->PaymentModel->get_payment($paymentId);
                
                // Build current user context for notification + audit log
                $currentUser = [
                    'user_id' => $this->session->userdata('user_id'),
                    'role' => $this->session->userdata('role'),
                    'first_name' => $this->session->userdata('first_name'),
                    'last_name' => $this->session->userdata('last_name')
                ];

                // Send notification based on who created the payment
                // (NotificationService->create() also writes the audit log internally)
                try {
                    $student_name = $payment['student_name'] ?? 'Student';
                    $payment_amount = floatval($payment['amount']);
                    $payment_type = $payment['payment_type'] ?? 'Payment';
                    $payment_method = $payment['payment_method'] ?? 'Cash';
                    $formattedAmount = number_format($payment_amount, 2);
                    $actor_name = trim(($currentUser['first_name'] ?? '') . ' ' . ($currentUser['last_name'] ?? ''));
                    $actor_role = $currentUser['role'] ?? 'admin';
                    $isStudentActor = in_array($actor_role, ['student', 'enrollee'], true);

                    if ($isStudentActor) {
                        // Student submitted their own payment → notify all admins
                        $recipients = $this->NotificationService->getRecipientsByRole('admin');
                        if (empty($recipients)) {
                            // Fallback for deployments with inconsistent users.role/users.status values.
                            $adminRows = $this->db->raw(
                                'SELECT id as user_id FROM users WHERE role IN (?, ?, ?)',
                                ['admin', 'Admin', 'ADMIN']
                            )->fetchAll(\PDO::FETCH_ASSOC);

                            if (!empty($adminRows)) {
                                $recipients = array_map(function($row) {
                                    return [
                                        'user_id' => $row['user_id'],
                                        'role' => 'admin'
                                    ];
                                }, $adminRows);
                            }
                        }

                        $notif_title = 'New Payment Submitted';
                        $notif_body = "{$student_name} submitted a {$payment_type} payment of ₱{$formattedAmount}";
                        $notif_action_url = '/admin/payments';
                        $notif_description = "{$student_name} submitted a {$payment_type} payment of ₱{$formattedAmount}";
                        $notif_type = NotificationService::TYPE_PAYMENT_SUBMITTED;
                        $notif_action = 'payment.submitted';
                    } else {
                        // Admin/teacher created payment for student → notify the student
                        $recipients = [['user_id' => $payment['student_id'], 'role' => 'student']];
                        $notif_title = 'Payment Recorded';
                        $notif_body = "Your {$payment_type} payment of ₱{$formattedAmount} has been recorded";
                        $notif_action_url = '/enrollment/payment';
                        $notif_description = "{$actor_name} recorded a {$payment_type} payment of ₱{$formattedAmount} for {$student_name}";
                        $notif_type = NotificationService::TYPE_PAYMENT_RECEIVED;
                        $notif_action = 'payment.received';
                    }

                    $notificationData = [
                        'type' => $notif_type,
                        'title' => $notif_title,
                        'body' => $notif_body,
                        'icon' => 'dollar-sign',
                        'action_url' => $notif_action_url,
                        'push_data' => [
                            'screen' => $isStudentActor ? 'PaymentDetails' : 'PaymentHistory',
                            'payment_id' => $paymentId
                        ],
                        'metadata' => [
                            'payment_id' => $paymentId,
                            'amount' => $payment_amount,
                            'payment_type' => $payment_type,
                            'payment_method' => $payment_method
                        ],
                        'action' => $notif_action,
                        'entity_type' => 'payment',
                        'entity_id' => $paymentId,
                        'actor_user_id' => $currentUser['user_id'],
                        'actor_role' => $actor_role,
                        'actor_name' => $actor_name,
                        'description' => $notif_description,
                        'recipients' => $recipients
                    ];

                    $notificationResult = $this->NotificationService->create($notificationData);

                    // Fallback: if notification service fails, still write an audit log.
                    if (empty($notificationResult['success'])) {
                        $this->AuditLogger->log([
                            'action' => $notif_action,
                            'entity_type' => 'payment',
                            'entity_id' => $paymentId,
                            'actor_user_id' => $currentUser['user_id'] ?? null,
                            'actor_role' => $actor_role,
                            'actor_name' => $actor_name,
                            'description' => $notif_description,
                            'metadata' => [
                                'payment_id' => $paymentId,
                                'amount' => $payment_amount,
                                'payment_type' => $payment_type,
                                'payment_method' => $payment_method,
                                'notification_error' => $notificationResult['error'] ?? 'Notification service returned unsuccessful result'
                            ]
                        ]);
                    }
                } catch (Throwable $notifError) {
                    error_log('Failed to send payment notification: ' . $notifError->getMessage());
                    error_log('Notification error stack: ' . $notifError->getTraceAsString());

                    // Last-resort fallback audit logging when notification dispatch throws.
                    try {
                        $this->AuditLogger->log([
                            'action' => $notif_action ?? 'payment.created',
                            'entity_type' => 'payment',
                            'entity_id' => $paymentId,
                            'actor_user_id' => $currentUser['user_id'] ?? null,
                            'actor_role' => $actor_role ?? ($currentUser['role'] ?? 'admin'),
                            'actor_name' => $actor_name ?? trim(($currentUser['first_name'] ?? '') . ' ' . ($currentUser['last_name'] ?? '')),
                            'description' => $notif_description ?? ('Payment created with amount ₱' . number_format($payment_amount ?? 0, 2)),
                            'metadata' => [
                                'payment_id' => $paymentId,
                                'amount' => $payment_amount ?? 0,
                                'payment_type' => $payment_type ?? 'Payment',
                                'payment_method' => $payment_method ?? 'Unknown',
                                'notification_exception' => $notifError->getMessage()
                            ]
                        ]);
                    } catch (Throwable $auditFallbackError) {
                        error_log('Payment audit fallback failed: ' . $auditFallbackError->getMessage());
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Payment created successfully',
                    'data' => $payment
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create payment'
                ]);
            }

        } catch (Throwable $e) {
            error_log('Create payment error: ' . $e->getMessage());
            error_log('Create payment trace: ' . $e->getTraceAsString());
            echo json_encode([
                'success' => false,
                'message' => 'Error creating payment: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update payment
     * PUT /api/payments/{id}
     */
    public function update_payment($id)
    {
        header('Content-Type: application/json');
        
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Check if reference number is being changed and if new one exists
            if (!empty($data['reference_number'])) {
                $currentPayment = $this->PaymentModel->get_payment($id);
                if ($currentPayment['reference_number'] !== $data['reference_number']) {
                    $exists = $this->PaymentModel->reference_exists($data['reference_number']);
                    if ($exists) {
                        echo json_encode([
                            'success' => false,
                            'message' => 'Reference number already exists'
                        ]);
                        return;
                    }
                }
            }

            // Check if status is changing
            $oldPayment = $this->PaymentModel->get_payment($id);
            $oldStatus = $oldPayment['status'] ?? '';
            $newStatus = $data['status'] ?? $oldStatus;
            
            $success = $this->PaymentModel->update($id, $data);

            if ($success) {
                $payment = $this->PaymentModel->get_payment($id);
                
                // Create audit log for payment update
                try {
                    $currentUser = [
                        'user_id' => $this->session->userdata('user_id'),
                        'role' => $this->session->userdata('role'),
                        'first_name' => $this->session->userdata('first_name'),
                        'last_name' => $this->session->userdata('last_name')
                    ];
                    $this->AuditLogger->log([
                        'action' => 'update',
                        'entity_type' => 'payment',
                        'entity_id' => $id,
                        'actor_user_id' => $currentUser['user_id'] ?? null,
                        'actor_role' => $currentUser['role'] ?? 'admin',
                        'actor_name' => ($currentUser['first_name'] ?? '') . ' ' . ($currentUser['last_name'] ?? ''),
                        'description' => "Payment updated: Status changed from {$oldStatus} to {$newStatus}",
                        'metadata' => [
                            'old_status' => $oldStatus,
                            'new_status' => $newStatus,
                            'payment_id' => $id
                        ]
                    ]);
                } catch (Exception $auditError) {
                    error_log('Failed to create audit log: ' . $auditError->getMessage());
                }
                
                // Send notification to student if status changed
                if ($oldStatus !== $newStatus && in_array($newStatus, ['Approved', 'Verified', 'Rejected'])) {
                    try {
                        $student_id = $payment['student_id'];
                        $payment_amount = floatval($payment['amount']);
                        $payment_type = $payment['payment_type'] ?? 'Payment';
                        
                        // Get admin user info
                        $admin_user_id = $this->session->userdata('user_id');
                        $admin_first_name = $this->session->userdata('first_name');
                        $admin_last_name = $this->session->userdata('last_name');
                        $admin_name = trim("{$admin_first_name} {$admin_last_name}");
                        
                        if ($newStatus === 'Approved' || $newStatus === 'Verified') {
                            // Use template helper for payment approved notification
                            $notificationData = get_payment_approved_notification(
                                $payment_type,
                                $payment_amount,
                                $id,
                                $student_id,
                                $admin_user_id,
                                $admin_name
                            );
                            
                            $this->NotificationService->create($notificationData);
                        } elseif ($newStatus === 'Rejected') {
                            $rejection_reason = $data['remarks'] ?? '';
                            
                            // Use template helper for payment rejected notification
                            $notificationData = get_payment_rejected_notification(
                                $payment_amount,
                                $rejection_reason,
                                $id,
                                $student_id,
                                $admin_user_id,
                                $admin_name,
                                $payment_type
                            );
                            
                            $this->NotificationService->create($notificationData);
                        }
                        
                    } catch (Exception $notifError) {
                        error_log('Failed to send payment status notification: ' . $notifError->getMessage());
                        // Don't fail the update if notification fails
                    }

                    // Keep admin notification badges in sync even when student notification dispatch fails.
                    $this->markAllAdminNotificationsAsRead('payment', $id);
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Payment updated successfully',
                    'data' => $payment
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update payment'
                ]);
            }

        } catch (Exception $e) {
            error_log('Update payment error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error updating payment'
            ]);
        }
    }

    /**
     * Delete payment
     * DELETE /api/payments/{id}
     */
    public function delete_payment($id)
    {
        header('Content-Type: application/json');
        
        try {
            $success = $this->PaymentModel->delete($id);

            if ($success) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Payment deleted successfully'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete payment'
                ]);
            }

        } catch (Exception $e) {
            error_log('Delete payment error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error deleting payment'
            ]);
        }
    }

    /**
     * Mark payment-related notifications as read for current admin user by payment ID.
     * POST /api/payments/{id}/mark-notifications-read
     */
    public function mark_payment_notifications_as_read($id)
    {
        header('Content-Type: application/json');

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        $role = strtolower((string)$this->session->userdata('role'));
        if ($role !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $userId = (int)$this->session->userdata('user_id');
            $paymentId = (int)$id;

            $rows = $this->db->table('notifications')
                ->select('id, entity_type, action_url, type')
                ->where('user_id', $userId)
                ->where('entity_id', $paymentId)
                ->where('is_read', 0)
                ->where('is_archived', 0)
                ->get_all();

            $candidateIds = [];
            foreach ($rows as $row) {
                $entityType = strtolower((string)($row['entity_type'] ?? ''));
                $actionUrl = strtolower((string)($row['action_url'] ?? ''));
                $type = strtolower((string)($row['type'] ?? ''));

                $isPaymentNotification =
                    (in_array($entityType, ['payment', 'payments'], true) || strpos($type, 'payment') !== false) &&
                    strpos($actionUrl, '/admin/payments') !== false;

                if ($isPaymentNotification && !empty($row['id'])) {
                    $candidateIds[] = (int)$row['id'];
                }
            }

            if (empty($candidateIds)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'No matching unread payment notifications for current user',
                    'marked_count' => 0,
                    'candidate_notification_ids' => []
                ]);
                return;
            }

            $markedCount = 0;
            foreach ($candidateIds as $notificationId) {
                $updated = $this->db->table('notifications')
                    ->where('id', $notificationId)
                    ->where('user_id', $userId)
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
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Create a refund payment linked to an original payment
     * POST /api/payments/{id}/refund
     * Body: { amount: number, reason: string, remarks?: string, payment_date?: string, received_by?: int }
     */
    public function create_refund($id)
    {
        header('Content-Type: application/json');

        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $refundAmount = isset($input['amount']) ? floatval($input['amount']) : 0;
            $refundReason = trim($input['reason'] ?? '');

            if ($refundAmount <= 0) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Refund amount must be greater than 0'
                ]);
                return;
            }

            if ($refundReason === '') {
                echo json_encode([
                    'success' => false,
                    'message' => 'Refund reason is required'
                ]);
                return;
            }

            $originalPayment = $this->PaymentModel->get_payment($id);
            if (!$originalPayment) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Original payment not found'
                ]);
                return;
            }

            if (!empty($originalPayment['is_refund']) && intval($originalPayment['is_refund']) === 1) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Cannot refund a refund record'
                ]);
                return;
            }

            if (($originalPayment['status'] ?? '') !== 'Approved') {
                echo json_encode([
                    'success' => false,
                    'message' => 'Only approved payments can be refunded'
                ]);
                return;
            }

            $originalNetAmount = isset($originalPayment['net_amount'])
                ? floatval($originalPayment['net_amount'])
                : (floatval($originalPayment['amount']) - floatval($originalPayment['total_discount'] ?? 0));

            $refundedStmt = $this->db->raw(
                "SELECT COALESCE(SUM(amount), 0) as refunded_total
                 FROM payments
                 WHERE original_payment_id = ? AND is_refund = 1 AND status != 'Rejected'",
                [$id]
            );
            $refundedRows = $refundedStmt ? $refundedStmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $alreadyRefunded = !empty($refundedRows) ? floatval($refundedRows[0]['refunded_total'] ?? 0) : 0;
            $remainingRefundable = max(0, $originalNetAmount - $alreadyRefunded);

            if ($refundAmount > $remainingRefundable) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Refund amount exceeds remaining refundable amount of ₱' . number_format($remainingRefundable, 2)
                ]);
                return;
            }

            $usedTx = null;
            if (method_exists($this->db, 'transaction')) {
                $this->db->transaction();
                $usedTx = 'transaction';
            } elseif (method_exists($this->db, 'beginTransaction')) {
                $this->db->beginTransaction();
                $usedTx = 'beginTransaction';
            }

            $refundDate = !empty($input['payment_date']) ? $input['payment_date'] : app_today();
            $remarks = trim($input['remarks'] ?? '');
            if ($remarks === '') {
                $remarks = 'Refund for payment ' . ($originalPayment['receipt_number'] ?? ('#' . $id));
            }

            $refundData = [
                'student_id' => $originalPayment['student_id'] ?? null,
                'enrollment_id' => $originalPayment['enrollment_id'] ?? null,
                'academic_period_id' => $originalPayment['academic_period_id'],
                'payment_type' => $originalPayment['payment_type'],
                'payment_for' => 'Refund - ' . ($originalPayment['payment_for'] ?? 'Payment'),
                'amount' => $refundAmount,
                'total_discount' => 0,
                'payment_method' => $originalPayment['payment_method'] ?? 'Cash',
                'payment_date' => $refundDate,
                'reference_number' => null,
                'installment_id' => $originalPayment['installment_id'] ?? null,
                'status' => 'Approved',
                'is_refund' => 1,
                'refund_reason' => $refundReason,
                'original_payment_id' => $id,
                'remarks' => $remarks,
                'received_by' => $input['received_by'] ?? null
            ];

            $refundId = $this->PaymentModel->create($refundData);
            if (!$refundId) {
                throw new Exception('Failed to create refund payment record');
            }

            // Reverse installment/payment-plan totals if original payment was linked to installment
            if (!empty($originalPayment['installment_id'])) {
                $this->reverse_installment_refund(intval($originalPayment['installment_id']), $refundAmount);
            }

            if (($usedTx === 'transaction' || $usedTx === 'beginTransaction') && method_exists($this->db, 'commit')) {
                $this->db->commit();
            }

            $refundPayment = $this->PaymentModel->get_payment($refundId);
            
            // Create audit log for refund
            try {
                $currentUser = [
                    'user_id' => $this->session->userdata('user_id'),
                    'role' => $this->session->userdata('role'),
                    'first_name' => $this->session->userdata('first_name'),
                    'last_name' => $this->session->userdata('last_name')
                ];
                $this->AuditLogger->log([
                    'action' => 'create',
                    'entity_type' => 'refund',
                    'entity_id' => $refundId,
                    'actor_user_id' => $currentUser['user_id'] ?? null,
                    'actor_role' => $currentUser['role'] ?? 'admin',
                    'actor_name' => ($currentUser['first_name'] ?? '') . ' ' . ($currentUser['last_name'] ?? ''),
                    'description' => "Refund processed: ₱" . number_format($refundAmount, 2) . " for payment #{$id}",
                    'metadata' => [
                        'refund_amount' => $refundAmount,
                        'original_payment_id' => $id,
                        'refund_reason' => $refundReason
                    ]
                ]);
            } catch (Exception $auditError) {
                error_log('Failed to create audit log: ' . $auditError->getMessage());
            }
            
            // Send notification to student about refund
            try {
                $student_id = $originalPayment['student_id'];
                
                // Get admin user info
                $admin_user_id = $this->session->userdata('user_id');
                $admin_first_name = $this->session->userdata('first_name');
                $admin_last_name = $this->session->userdata('last_name');
                $admin_name = trim("{$admin_first_name} {$admin_last_name}");
                
                // Use template helper for refund notification
                $notificationData = get_refund_processed_notification(
                    $refundAmount,
                    $refundReason,
                    $refundId,
                    $id,
                    $student_id,
                    $admin_user_id,
                    $admin_name
                );
                
                $this->NotificationService->create($notificationData);
            } catch (Exception $notifError) {
                error_log('Failed to send refund notification: ' . $notifError->getMessage());
                // Don't fail the refund if notification fails
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Refund created successfully',
                'data' => $refundPayment
            ]);
        } catch (Exception $e) {
            if (method_exists($this->db, 'roll_back')) {
                $this->db->roll_back();
            } elseif (method_exists($this->db, 'rollback')) {
                $this->db->rollback();
            } elseif (method_exists($this->db, 'rollBack')) {
                $this->db->rollBack();
            }

            error_log('Create refund error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error creating refund: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get applicable discounts for a payment
     * GET /api/payments/applicable-discounts?student_id=123&payment_type=Tuition%20Full%20Payment
     */
    public function get_applicable_discounts()
    {
        header('Content-Type: application/json');
        
        try {
            $student_id = $this->io->get('student_id');
            $payment_type = $this->io->get('payment_type');
            
            if (empty($student_id) || empty($payment_type)) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Student ID and payment type are required'
                ]);
                return;
            }

            $discounts = $this->PaymentDiscountApplicationModel->get_applicable_discounts($student_id, $payment_type);

            echo json_encode([
                'success' => true,
                'data' => $discounts
            ]);

        } catch (Exception $e) {
            error_log('Get applicable discounts error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching discounts'
            ]);
        }
    }

    /**
     * Get discounts applied to a payment
     * GET /api/payments/{id}/discounts
     */
    public function get_payment_discounts($payment_id)
    {
        header('Content-Type: application/json');
        
        try {
            $discounts = $this->PaymentDiscountApplicationModel->get_payment_discounts($payment_id);

            echo json_encode([
                'success' => true,
                'data' => $discounts
            ]);

        } catch (Exception $e) {
            error_log('Get payment discounts error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching payment discounts: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Apply discount to a payment
     * POST /api/payments/{id}/discounts
     * Body: { discount_id: number, original_amount: number }
     */
    public function apply_discount($payment_id)
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (empty($input['discount_id'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Discount ID is required'
                ]);
                return;
            }

            $discount_id = $input['discount_id'];
            $original_amount = $input['original_amount'] ?? 0;

            // Get discount details (using new dictionary_templates table)
            $discount = $this->db->table('discount_templates')
                ->where('id', $discount_id)
                ->get();

            if (!$discount) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Discount not found'
                ]);
                return;
            }

            // Calculate discount amount
            // Map value_type -> discount_type, value -> discount_value
            $discount_amount = $this->PaymentDiscountApplicationModel->calculate_discount_amount(
                $original_amount,
                $discount['value_type'],
                $discount['value']
            );

            // Apply discount
            $result = $this->PaymentDiscountApplicationModel->apply_discount(
                $payment_id,
                $discount_id,
                $discount_amount
            );

            echo json_encode($result);

        } catch (Exception $e) {
            error_log('Apply discount error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error applying discount: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Remove discount from a payment
     * DELETE /api/payments/{id}/discounts/{discount_id}
     */
    public function remove_discount($payment_id, $discount_id)
    {
        header('Content-Type: application/json');
        
        try {
            $result = $this->PaymentDiscountApplicationModel->remove_discount($payment_id, $discount_id);
            echo json_encode($result);

        } catch (Exception $e) {
            error_log('Remove discount error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error removing discount'
            ]);
        }
    }

    /**
     * Recalculate payment totals after discount changes
     * PUT /api/payments/{id}/recalculate
     */
    public function recalculate_totals($payment_id)
    {
        header('Content-Type: application/json');
        
        try {
            $result = $this->PaymentDiscountApplicationModel->recalculate_payment_total($payment_id);
            
            if ($result['success']) {
                // Get updated payment
                $payment = $this->PaymentModel->get_payment($payment_id);
                
                echo json_encode([
                    'success' => true,
                    'data' => $payment,
                    'total_discount' => $result['total_discount']
                ]);
            } else {
                echo json_encode($result);
            }

        } catch (Exception $e) {
            error_log('Recalculate totals error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error recalculating totals'
            ]);
        }
    }

    /**
     * Upload proof of payment file for existing payment
     * POST /api/payments/{id}/upload-proof
     */
    public function upload_proof($payment_id)
    {
        header('Content-Type: application/json');

        try {
            // Check if payment exists
            $payment = $this->PaymentModel->get_payment($payment_id);
            if (!$payment) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Payment not found'
                ]);
                return;
            }

            // Load the proof of payment helper
            require_once APP_DIR . 'helpers/proof_of_payment_helper.php';

            // Upload the file
            $upload_result = upload_proof_of_payment('proof_of_payment');

            if (!$upload_result['success']) {
                echo json_encode([
                    'success' => false,
                    'message' => 'File upload failed: ' . $upload_result['message']
                ]);
                return;
            }

            // Update payment with proof of payment URL
            $update_data = [
                'proof_of_payment_url' => $upload_result['relative_path']
            ];

            $update_result = $this->PaymentModel->update($payment_id, $update_data);

            if ($update_result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Proof of payment uploaded successfully',
                    'data' => [
                        'file_url' => $upload_result['file_url'],
                        'file_name' => $upload_result['file_name'],
                        'file_size' => $upload_result['file_size']
                    ]
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update payment with proof of payment'
                ]);
            }

        } catch (Exception $e) {
            error_log('Upload proof error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error uploading proof of payment: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Delete proof of payment file
     * DELETE /api/payments/{id}/delete-proof
     */
    public function delete_proof($payment_id)
    {
        header('Content-Type: application/json');

        try {
            // Check if payment exists
            $payment = $this->PaymentModel->get_payment($payment_id);
            if (!$payment) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Payment not found'
                ]);
                return;
            }

            // Check if payment has a proof of payment file
            if (empty($payment['proof_of_payment_url'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'No proof of payment file found for this payment'
                ]);
                return;
            }

            // Load the proof of payment helper
            require_once APP_DIR . 'helpers/proof_of_payment_helper.php';

            // Delete the file
            $delete_result = delete_proof_of_payment($payment['proof_of_payment_url']);

            if (!$delete_result['success']) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete file: ' . $delete_result['message']
                ]);
                return;
            }

            // Update payment to remove proof of payment URL
            $update_data = [
                'proof_of_payment_url' => null
            ];

            $update_result = $this->PaymentModel->update($payment_id, $update_data);

            if ($update_result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Proof of payment deleted successfully'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update payment record'
                ]);
            }

        } catch (Exception $e) {
            error_log('Delete proof error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error deleting proof of payment: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get proof of payment file information
     * GET /api/payments/{id}/proof-info
     */
    public function get_proof_info($payment_id)
    {
        header('Content-Type: application/json');

        try {
            // Check if payment exists
            $payment = $this->PaymentModel->get_payment($payment_id);
            if (!$payment) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Payment not found'
                ]);
                return;
            }

            // Check if payment has a proof of payment file
            if (empty($payment['proof_of_payment_url'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'No proof of payment file found for this payment'
                ]);
                return;
            }

            // Load the proof of payment helper
            require_once APP_DIR . 'helpers/proof_of_payment_helper.php';

            // Get file information
            $file_info = get_proof_of_payment_info($payment['proof_of_payment_url']);

            if ($file_info['success']) {
                echo json_encode([
                    'success' => true,
                    'data' => $file_info
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => $file_info['message']
                ]);
            }

        } catch (Exception $e) {
            error_log('Get proof info error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error retrieving proof of payment information: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get all payment penalties (for admin overview)
     * GET /api/payment-installment-penalties
     */
    public function get_all_penalties()
    {
        header('Content-Type: application/json');
        
        try {
            $penalties = $this->db->table('payment_installment_penalties')
                ->order_by('applied_at', 'DESC')
                ->get_all();

            echo json_encode([
                'success' => true,
                'data' => $penalties,
                'count' => count($penalties),
                'total_penalty_amount' => array_sum(array_map(function($p) {
                    return floatval($p['penalty_amount']);
                }, $penalties))
            ]);

        } catch (Exception $e) {
            error_log('Get penalties error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error retrieving penalties: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Reverse installment totals when a refund is created
     */
    private function reverse_installment_refund($installmentId, $refundAmount)
    {
        $installment = $this->db->table('installments')
            ->where('id', $installmentId)
            ->get();

        if (!$installment) {
            return false;
        }

        $currentAmountPaid = floatval($installment['amount_paid'] ?? 0);
        $amountDue = floatval($installment['amount_due'] ?? 0);

        $newAmountPaid = max(0, $currentAmountPaid - $refundAmount);
        $newBalance = max(0, $amountDue - $newAmountPaid);

        $newStatus = 'Pending';
        if ($newBalance <= 0) {
            $newStatus = 'Paid';
        } elseif ($newAmountPaid > 0) {
            $newStatus = 'Partial';
        }

        $today = app_today();
        if ($newStatus !== 'Paid' && !empty($installment['due_date']) && $installment['due_date'] < $today) {
            $newStatus = 'Overdue';
        }

        $this->db->table('installments')
            ->where('id', $installmentId)
            ->update([
                'amount_paid' => $newAmountPaid,
                'balance' => $newBalance,
                'status' => $newStatus,
                'paid_date' => $newStatus === 'Paid' ? ($installment['paid_date'] ?: app_today()) : null,
                'updated_at' => app_now()
            ]);

        if (!empty($installment['payment_plan_id'])) {
            $this->recalculate_payment_plan_totals(intval($installment['payment_plan_id']));
        }

        return true;
    }

    /**
     * Recalculate payment plan totals from installments
     */
    private function recalculate_payment_plan_totals($paymentPlanId)
    {
        $plan = $this->db->table('payment_plans')
            ->where('id', $paymentPlanId)
            ->get();

        if (!$plan) {
            return false;
        }

        $installments = $this->db->table('installments')
            ->where('payment_plan_id', $paymentPlanId)
            ->get_all();

        $totalPaid = 0;
        foreach ($installments as $installment) {
            $totalPaid += floatval($installment['amount_paid'] ?? 0);
        }

        $planTotal = floatval($plan['total_tuition'] ?? 0);
        $newBalance = max(0, $planTotal - $totalPaid);

        $newStatus = 'Active';
        if ($newBalance <= 0) {
            $newStatus = 'Completed';
        } elseif ($totalPaid <= 0) {
            $newStatus = 'Active';
        }

        $this->db->table('payment_plans')
            ->where('id', $paymentPlanId)
            ->update([
                'total_paid' => $totalPaid,
                'balance' => $newBalance,
                'status' => $newStatus,
                'updated_at' => app_now()
            ]);

        return true;
    }

    /**
     * Mark ALL admin notifications as read for a given entity
     * This ensures multi-admin synchronization: when Admin1 takes action,
     * Admin2's notification is also marked as read to prevent stale notifications
     * 
     * @param string $entityType Entity type (e.g., 'payment', 'enrollment')
     * @param int $entityId Entity ID
     */
    private function markAllAdminNotificationsAsRead($entityType, $entityId)
    {
        try {
            $this->db->table('notifications')
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->where('is_read', 0)
                ->update([
                    'is_read' => 1,
                    'read_at' => app_now()
                ]);
        } catch (Exception $e) {
            error_log('Failed to mark all admin notifications as read: ' . $e->getMessage());
            // Don't fail the main operation if notification sync fails
        }
    }
}

