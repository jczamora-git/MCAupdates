<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Discount Controller
 * Handles payment discount API endpoints
 */
class PaymentDiscountController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('PaymentDiscountModel');
        $this->call->model('PaymentModel');
    }

    /**
     * Get all payment discounts
     * GET /api/payment-discounts
     */
    public function get_discounts()
    {
        header('Content-Type: application/json');
        
        try {
            $filters = [];
            
            if (isset($_GET['student_id'])) {
                $filters['student_id'] = $_GET['student_id'];
            }
            if (isset($_GET['academic_period_id'])) {
                $filters['academic_period_id'] = $_GET['academic_period_id'];
            }
            if (isset($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }

            $discounts = $this->PaymentDiscountModel->get_all($filters);
            
            echo json_encode([
                'success' => true,
                'data' => $discounts ?: []
            ]);
        } catch (Exception $e) {
            error_log("Error fetching discounts: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch discounts'
            ]);
        }
    }

    /**
     * Get active discounts for a student
     * GET /api/payment-discounts/student/{student_id}/period/{period_id}
     */
    public function get_student_discounts($student_id, $period_id)
    {
        header('Content-Type: application/json');
        
        try {
            $discounts = $this->PaymentDiscountModel->get_student_active_discounts($student_id, $period_id);
            
            echo json_encode([
                'success' => true,
                'data' => $discounts ?: []
            ]);
        } catch (Exception $e) {
            error_log("Error fetching student discounts: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch student discounts'
            ]);
        }
    }

    /**
     * Create payment discount
     * POST /api/payment-discounts
     */
    public function create_discount()
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (empty($input['student_id']) || empty($input['academic_period_id']) || 
                empty($input['discount_name'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields'
                ]);
                return;
            }

            $discount_id = $this->PaymentDiscountModel->create($input);

            echo json_encode([
                'success' => true,
                'message' => 'Discount created successfully',
                'data' => ['discount_id' => $discount_id]
            ]);

        } catch (Exception $e) {
            error_log("Error creating discount: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error creating discount: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Apply discount to payment
     * POST /api/payments/{payment_id}/discounts
     */
    public function apply_discount_to_payment($payment_id)
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (empty($input['discount_id']) || !isset($input['discount_amount'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing discount_id or discount_amount'
                ]);
                return;
            }

            // Apply discount
            $this->PaymentDiscountModel->apply_to_payment(
                $payment_id,
                $input['discount_id'],
                $input['discount_amount']
            );

            // Recalculate total discount
            $total_discount = $this->PaymentDiscountModel->calculate_total_discount($payment_id);

            // Update payment total_discount field
            $this->PaymentModel->update($payment_id, [
                'total_discount' => $total_discount
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Discount applied successfully',
                'data' => ['total_discount' => $total_discount]
            ]);

        } catch (Exception $e) {
            error_log("Error applying discount: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error applying discount'
            ]);
        }
    }

    /**
     * Get discounts applied to a payment
     * GET /api/payments/{payment_id}/discounts
     */
    public function get_payment_discounts($payment_id)
    {
        header('Content-Type: application/json');
        
        try {
            $discounts = $this->PaymentDiscountModel->get_payment_discounts($payment_id);
            
            echo json_encode([
                'success' => true,
                'data' => $discounts ?: []
            ]);
        } catch (Exception $e) {
            error_log("Error fetching payment discounts: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch payment discounts'
            ]);
        }
    }

    /**
     * Remove discount from payment
     * DELETE /api/payments/{payment_id}/discounts/{discount_id}
     */
    public function remove_discount_from_payment($payment_id, $discount_id)
    {
        header('Content-Type: application/json');
        
        try {
            $this->PaymentDiscountModel->remove_from_payment($payment_id, $discount_id);

            // Recalculate total discount
            $total_discount = $this->PaymentDiscountModel->calculate_total_discount($payment_id);

            // Update payment total_discount field
            $this->PaymentModel->update($payment_id, [
                'total_discount' => $total_discount
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Discount removed successfully',
                'data' => ['total_discount' => $total_discount]
            ]);

        } catch (Exception $e) {
            error_log("Error removing discount: " . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Error removing discount'
            ]);
        }
    }
}
