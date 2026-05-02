<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * School Service Controller
 * Manages recurring monthly school services (Service Fee, Transportation, etc.)
 */
class SchoolServiceController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('PaymentModel');
        $this->call->database();
    }

    /**
     * Get service fee for a specific year level or all grades
     * GET /api/school-services/service-fee-amount?year_level=Grade1
     */
    public function get_service_fee_amount()
    {
        header('Content-Type: application/json');
        
        try {
            $queryParams = $this->io->get();
            $queryParams = is_array($queryParams) ? $queryParams : [];
            $year_level = isset($queryParams['year_level']) ? $queryParams['year_level'] : null;
            
            // Query school_fees table for Service Fee
            $query = $this->db->table('school_fees')
                ->where('fee_type', 'Service Fee')
                ->where('is_active', 1)
                ->where('is_recurring', 1);
            
            // If year_level provided, filter by it, otherwise get the one with NULL year_level (all grades)
            if ($year_level) {
                $query = $query->where('year_level', $year_level);
            } else {
                $query = $query->where_null('year_level');
            }
            
            $serviceFees = $query->get_all();
            
            if (!empty($serviceFees)) {
                echo json_encode([
                    'success' => true,
                    'data' => $serviceFees
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Service fee not found'
                ]);
            }
        } catch (Exception $e) {
            error_log('Get service fee error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching service fee'
            ]);
        }
    }

    /**
     * Get all service fee payments (monthly tracking view)
     * GET /api/school-services/payments?year=2026
     */
    public function get_service_payments()
    {
        header('Content-Type: application/json');
        
        try {
            $queryParams = $this->io->get();
            $queryParams = is_array($queryParams) ? $queryParams : [];
            $year = isset($queryParams['year']) && $queryParams['year'] ? $queryParams['year'] : date('Y');
            $month = isset($queryParams['month']) ? $queryParams['month'] : null; // Optional: filter by specific month
            
            // Get all service fee payments for the year
            $query = $this->db->table('payments p')
                ->left_join('users u', 'p.student_id = u.id')
                ->left_join('students s', 'p.student_id = s.user_id')
                ->where('p.is_recurring_service', 1)
                ->where('p.service_period_year', $year)
                ->select('p.*, 
                         u.first_name, u.last_name,
                         s.student_id as student_number, s.year_level,
                         CONCAT(u.first_name, " ", u.last_name) as student_name')
                ->order_by('s.year_level', 'ASC')
                ->order_by('u.last_name', 'ASC');
            
            if ($month) {
                $query = $query->where('p.service_period_month', $month);
            }
            
            $payments = $query->get_all();
            
            echo json_encode([
                'success' => true,
                'data' => $payments
            ]);
        } catch (Exception $e) {
            error_log('Get service payments error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching service payments'
            ]);
        }
    }

    /**
     * Get all students for service fee payment
     * GET /api/school-services/students
     */
    public function get_students()
    {
        header('Content-Type: application/json');
        
        try {
            // Get ALL students - service fee can be paid by any student
            $students = $this->db->table('users u')
                ->join('students s', 'u.id = s.user_id')
                ->where('u.role', 'student')
                ->select('u.id, u.first_name, u.last_name, u.email,
                         s.student_id as student_number, s.year_level,
                         CONCAT(u.first_name, " ", u.last_name) as full_name')
                ->order_by('s.year_level', 'ASC')
                ->order_by('u.last_name', 'ASC')
                ->get_all();
            
            echo json_encode([
                'success' => true,
                'data' => $students ?: []
            ]);
        } catch (Exception $e) {
            error_log('Get students error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching students: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Create service fee payment for a student and month
     * POST /api/school-services/create-payment
     */
    public function create_service_payment()
    {
        header('Content-Type: application/json');
        
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            // Validate required fields
            if (empty($data['student_id']) || empty($data['service_period_month']) || empty($data['service_period_year'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'student_id, service_period_month, and service_period_year are required'
                ]);
                return;
            }
            
            // Check if already paid for this period
            $exists = $this->db->table('payments')
                ->where('student_id', $data['student_id'])
                ->where('is_recurring_service', 1)
                ->where('service_period_month', $data['service_period_month'])
                ->where('service_period_year', $data['service_period_year'])
                ->grouped(function ($query) {
                    $query->where('status', 'Approved')
                        ->or_where('status', 'Verified')
                        ->or_where('status', 'Pending');
                })
                ->get();
            
            if ($exists) {
                $monthName = date('F', mktime(0, 0, 0, $data['service_period_month'], 1));
                echo json_encode([
                    'success' => false,
                    'message' => "Service Fee for {$monthName} {$data['service_period_year']} has already been paid"
                ]);
                return;
            }
            
            // Get service fee amount from school_fees
            $feeQuery = $this->db->table('school_fees')
                ->where('fee_type', 'Service Fee')
                ->where('is_active', 1)
                ->where('is_recurring', 1)
                ->where_null('year_level'); // Assuming service fee is same for all grades

            if (!empty($data['service_fee_id'])) {
                $feeQuery = $feeQuery->where('id', $data['service_fee_id']);
            } elseif (!empty($data['service_fee_name'])) {
                $feeQuery = $feeQuery->where('fee_name', $data['service_fee_name']);
            }

            $serviceFee = $feeQuery->get();
            
            if (!$serviceFee) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Service Fee not configured in school fees'
                ]);
                return;
            }
            
            // Generate receipt number
            $date = new DateTime();
            $receiptNumber = 'RCP-' . $date->format('Ym') . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            
            // Get active academic period
            $activePeriod = $this->db->table('academic_periods')
                ->where('status', 'active')
                ->get();
            
            // Prepare payment data
            $monthName = date('F', mktime(0, 0, 0, $data['service_period_month'], 1));
            $feeName = $serviceFee['fee_name'] ?? 'Service Fee';
            $paymentData = [
                'student_id' => $data['student_id'],
                'academic_period_id' => $activePeriod ? $activePeriod['id'] : null,
                'receipt_number' => $receiptNumber,
                'payment_type' => 'Service Fee',
                'payment_for' => "{$feeName} - {$monthName} {$data['service_period_year']}",
                'amount' => $serviceFee['amount'],
                'payment_method' => $data['payment_method'] ?? 'Cash',
                'payment_date' => $data['payment_date'] ?? app_today(),
                'reference_number' => $data['reference_number'] ?? null,
                'status' => $data['status'] ?? 'Approved',
                'remarks' => $data['remarks'] ?? null,
                'received_by' => $data['received_by'] ?? null,
                'is_refund' => 0,
                'is_recurring_service' => 1,
                'service_period_month' => $data['service_period_month'],
                'service_period_year' => $data['service_period_year'],
                'created_at' => app_now(),
                'updated_at' => app_now()
            ];
            
            // Create payment using PaymentModel
            $paymentId = $this->PaymentModel->create($paymentData);
            
            if ($paymentId) {
                $payment = $this->PaymentModel->get_payment($paymentId);
                echo json_encode([
                    'success' => true,
                    'message' => 'Service payment recorded successfully',
                    'data' => $payment
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create service payment'
                ]);
            }
        } catch (Exception $e) {
            error_log('Create service payment error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error creating service payment: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get monthly summary statistics
     * GET /api/school-services/monthly-summary?year=2026&month=3
     */
    public function get_monthly_summary()
    {
        header('Content-Type: application/json');
        
        try {
            $queryParams = $this->io->get();
            $queryParams = is_array($queryParams) ? $queryParams : [];
            $year = isset($queryParams['year']) && $queryParams['year'] ? $queryParams['year'] : date('Y');
            $month = isset($queryParams['month']) ? $queryParams['month'] : null;
            
            if (!$month) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Month parameter is required'
                ]);
                return;
            }
            
            // Count total enrolled students
            $totalStudentsStmt = $this->db->raw(
                "SELECT COUNT(DISTINCT e.student_id) as total 
                 FROM enrollments e 
                 WHERE e.status = 'Approved'"
            );
            $totalStudentsResult = $totalStudentsStmt ? $totalStudentsStmt->fetchAll(PDO::FETCH_ASSOC) : [];
            
            // Count students who paid for this month
            $paidStudentsStmt = $this->db->raw(
                "SELECT COUNT(*) as total 
                 FROM payments 
                 WHERE is_recurring_service = 1 
                 AND service_period_month = ? 
                 AND service_period_year = ? 
                 AND status IN ('Approved', 'Verified')",
                [$month, $year]
            );
            $paidStudentsResult = $paidStudentsStmt ? $paidStudentsStmt->fetchAll(PDO::FETCH_ASSOC) : [];
            
            // Calculate total revenue
            $revenueStmt = $this->db->raw(
                "SELECT COALESCE(SUM(amount), 0) as total 
                 FROM payments 
                 WHERE is_recurring_service = 1 
                 AND service_period_month = ? 
                 AND service_period_year = ? 
                 AND status IN ('Approved', 'Verified')",
                [$month, $year]
            );
            $revenueResult = $revenueStmt ? $revenueStmt->fetchAll(PDO::FETCH_ASSOC) : [];
            
            $totalStudents = $totalStudentsResult[0]['total'] ?? 0;
            $paidStudents = $paidStudentsResult[0]['total'] ?? 0;
            $totalRevenue = $revenueResult[0]['total'] ?? 0;
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'total_students' => $totalStudents,
                    'paid_students' => $paidStudents,
                    'unpaid_students' => $totalStudents - $paidStudents,
                    'total_revenue' => $totalRevenue,
                    'month' => $month,
                    'year' => $year
                ]
            ]);
        } catch (Exception $e) {
            error_log('Get monthly summary error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching monthly summary'
            ]);
        }
    }
}
