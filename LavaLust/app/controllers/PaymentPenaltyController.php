<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Penalty Controller
 * 
 * Handles penalty-related operations:
 * - Recording penalties when payments are made (penalties are ALWAYS charged)
 * - Retrieving penalty history
 * - Mandatory student explanations for late payments (record-keeping only)
 */
class PaymentPenaltyController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('PaymentPenaltyModel');
        // Load explanation model for mandatory student explanations
        $this->call->model('LatePaymentExplanationModel');

        // Require an active session
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
            exit;
        }

        // Build a user object from session data (used in role checks below)
        $this->user = (object) [
            'id'   => $this->session->userdata('user_id'),
            'role' => $this->session->userdata('role'),
        ];
    }

    /**
     * Record a penalty when payment is made
     * POST /api/payment-penalties/record
     * 
     * Body: {
     *   installment_id: number,
     *   penalty_amount: number,
     *   days_overdue: number,
     *   payment_id: number (optional, can be set later)
     * }
     */
    public function record_penalty()
    {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['installment_id']) || !isset($input['penalty_amount']) || !isset($input['days_overdue'])) {
                http_response_code(400);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Missing required fields: installment_id, penalty_amount, days_overdue'
                ]);
                return;
            }

            $penaltyData = [
                'installment_id' => $input['installment_id'],
                'penalty_amount' => $input['penalty_amount'],
                'days_overdue' => $input['days_overdue'],
                'payment_id' => $input['payment_id'] ?? null
            ];

            $penaltyId = $this->PaymentPenaltyModel->create($penaltyData);

            if ($penaltyId) {
                http_response_code(201);
                echo json_encode([
                    'status' => 'success',
                    'message' => 'Penalty recorded successfully',
                    'penalty_id' => $penaltyId
                ]);
            } else {
                throw new Exception('Failed to record penalty');
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to record penalty: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get penalty history for an installment
     * GET /api/payment-penalties/installment/{installment_id}
     */
    public function get_by_installment($installmentId)
    {
        try {
            $penalties = $this->PaymentPenaltyModel->get_by_installment($installmentId);

            echo json_encode([
                'status' => 'success',
                'data' => $penalties
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to fetch penalties: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get penalty by ID
     * GET /api/payment-penalties/{id}
     */
    public function get_by_id($penaltyId)
    {
        try {
            $penalty = $this->PaymentPenaltyModel->get_by_id($penaltyId);

            if ($penalty) {
                echo json_encode([
                    'status' => 'success',
                    'data' => $penalty
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Penalty not found'
                ]);
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to fetch penalty: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get all penalties for a student
     * GET /api/payment-penalties/student/{student_id}
     */
    public function get_by_student($studentId)
    {
        try {
            $penalties = $this->PaymentPenaltyModel->get_by_student($studentId);

            echo json_encode([
                'status' => 'success',
                'data' => $penalties
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to fetch penalties: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Student submits a mandatory explanation for late payment
     * POST /api/payment-penalties/submit-explanation
     * Body: { installment_id, penalty_amount, days_overdue, explanation }
     * 
     * NOTE: This is NOT a waiver - penalty is ALWAYS charged.
     * This is just a required explanation for record-keeping.
     */
    public function submit_explanation()
    {
        try {
            $input = json_decode(file_get_contents('php://input'), true);

            if (!isset($input['installment_id']) || !isset($input['penalty_amount'])) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
                return;
            }

            if (!isset($input['explanation']) || trim($input['explanation']) === '') {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Explanation is required for late payments']);
                return;
            }

            $explanationData = [
                'student_id' => $this->user->id,
                'installment_id' => $input['installment_id'],
                'penalty_amount' => $input['penalty_amount'],
                'days_overdue' => $input['days_overdue'] ?? 0,
                'explanation' => trim($input['explanation']),
                'submitted_at' => app_now(),
                'viewed_by_admin' => 0,
                'admin_notes' => null
            ];

            $id = $this->LatePaymentExplanationModel->create($explanationData);

            if ($id) {
                http_response_code(201);
                echo json_encode([
                    'status' => 'success', 
                    'message' => 'Late payment explanation submitted. Penalty will still apply.',
                    'data' => ['id' => $id]
                ]);
            } else {
                throw new Exception('Failed to save explanation');
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Failed to submit explanation: ' . $e->getMessage()]);
        }
    }

    /**
     * Get all late payment explanations for current student
     * GET /api/payment-penalties/waiver-requests
     * 
     * NOTE: Despite the "waiver-requests" name (kept for backward compatibility),
     * these are mandatory explanations - penalties are always charged.
     */
    public function get_student_explanations()
    {
        try {
            $explanations = $this->LatePaymentExplanationModel->get_by_student($this->user->id);

            echo json_encode([
                'status' => 'success',
                'data' => $explanations
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to fetch explanations: ' . $e->getMessage()
            ]);
        }
    }
}
?>
