<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Penalty Model
 * 
 * Handles database operations for payment_installment_penalties table
 * NOTE: Penalties are ALWAYS charged per school policy - no waiving
 */
class PaymentPenaltyModel extends Model
{
    protected $table = 'payment_installment_penalties';
    
    /**
     * Create a new penalty record
     */
    public function create($data)
    {
        try {
            error_log('PaymentPenaltyModel::create called with data: ' . print_r($data, true));
            
            $penalty_id = $this->db->table('payment_installment_penalties')->insert($data);
            
            error_log('PaymentPenaltyModel::create - Insert returned: ' . print_r($penalty_id, true));
            
            return $penalty_id;
        } catch (Throwable $e) {
            error_log('PaymentPenaltyModel::create ERROR: ' . $e->getMessage());
            error_log('Error file: ' . $e->getFile() . ' line ' . $e->getLine());
            error_log('Error trace: ' . $e->getTraceAsString());
            return false;
        }
    }

    /**
     * Get penalty by ID
     */
    public function get_by_id($penaltyId)
    {
        try {
            $result = $this->db->table('payment_installment_penalties pip')
                ->select('
                    pip.*,
                    i.installment_number,
                    i.due_date,
                    i.balance,
                    pp.student_id
                ')
                ->left_join('installments i', 'i.installment_id = pip.installment_id')
                ->left_join('payment_plans pp', 'pp.payment_plan_id = i.payment_plan_id')
                ->where('pip.penalty_id', $penaltyId)
                ->get();

            return $result ? $result[0] : null;
        } catch (Exception $e) {
            error_log('PaymentPenaltyModel::get_by_id error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get all penalties for an installment
     */
    public function get_by_installment($installmentId)
    {
        try {
            return $this->db->table('payment_installment_penalties pip')
                ->select('pip.*')
                ->where('pip.installment_id', $installmentId)
                ->order_by('pip.created_at', 'DESC')
                ->get_all();
        } catch (Exception $e) {
            error_log('PaymentPenaltyModel::get_by_installment error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get all penalties for a student
     */
    public function get_by_student($studentId)
    {
        try {
            return $this->db->table('payment_installment_penalties pip')
                ->select('
                    pip.*,
                    i.installment_number,
                    i.due_date,
                    i.balance,
                    pp.tuition_package_name
                ')
                ->join('installments i', 'i.installment_id = pip.installment_id')
                ->join('payment_plans pp', 'pp.payment_plan_id = i.payment_plan_id')
                ->where('pp.student_id', $studentId)
                ->order_by('pip.created_at', 'DESC')
                ->get_all();
        } catch (Exception $e) {
            error_log('PaymentPenaltyModel::get_by_student error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Check if installment has any penalties
     */
    public function has_penalty($installmentId)
    {
        try {
            $result = $this->db->table('payment_installment_penalties')
                ->where('installment_id', $installmentId)
                ->get();

            return !empty($result);
        } catch (Exception $e) {
            error_log('PaymentPenaltyModel::has_penalty error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get total penalties for an installment (all penalties are charged)
     */
    public function get_total_penalty($installmentId)
    {
        try {
            $result = $this->db->table('payment_installment_penalties')
                ->select('SUM(penalty_amount) as total_penalty')
                ->where('installment_id', $installmentId)
                ->get();

            return $result && isset($result[0]['total_penalty']) ? (float)$result[0]['total_penalty'] : 0;
        } catch (Exception $e) {
            error_log('PaymentPenaltyModel::get_total_penalty error: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Update penalty with payment ID
     */
    public function update_payment_id($penaltyId, $paymentId)
    {
        try {
            $this->db->table('payment_installment_penalties')
                ->where('penalty_id', $penaltyId)
                ->update(['payment_id' => $paymentId]);

            return $this->db->affected_rows() > 0;
        } catch (Exception $e) {
            error_log('PaymentPenaltyModel::update_payment_id error: ' . $e->getMessage());
            return false;
        }
    }
}
?>
