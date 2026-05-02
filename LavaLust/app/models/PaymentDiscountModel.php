<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Discount Model
 * Handles student discount management
 */
class PaymentDiscountModel extends Model
{
    protected $table = 'payment_discounts';

    /**
     * Get all discounts with optional filters
     */
    public function get_all($filters = [])
    {
        $query = $this->db->table($this->table . ' pd');
        
        $query = $query->left_join('students s', 'pd.student_id = s.id')
                       ->left_join('users u', 's.user_id = u.id')
                       ->left_join('academic_periods ap', 'pd.academic_period_id = ap.id');

        if (!empty($filters['student_id'])) {
            $query = $query->where('pd.student_id', $filters['student_id']);
        }

        if (!empty($filters['academic_period_id'])) {
            $query = $query->where('pd.academic_period_id', $filters['academic_period_id']);
        }

        if (!empty($filters['status'])) {
            $query = $query->where('pd.status', $filters['status']);
        }

        $query = $query->select('pd.*, 
                                 s.student_id as student_number,
                                 CONCAT(u.first_name, " ", u.last_name) as student_name,
                                 CONCAT(ap.school_year, " - ", ap.quarter) as academic_period');

        return $query->order_by('pd.created_at', 'DESC')->get_all();
    }

    /**
     * Get active discounts for a student in a specific period
     */
    public function get_student_active_discounts($student_id, $academic_period_id)
    {
        return $this->db->table($this->table)
                        ->where('student_id', $student_id)
                        ->where('academic_period_id', $academic_period_id)
                        ->where('status', 'Active')
                        ->get_all();
    }

    /**
     * Create discount
     */
    public function create($data)
    {
        $data['created_at'] = app_now();
        $data['updated_at'] = app_now();
        
        return $this->db->table($this->table)->insert($data);
    }

    /**
     * Update discount
     */
    public function update($id, $data)
    {
        $data['updated_at'] = app_now();
        
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($data);
    }

    /**
     * Delete discount
     */
    public function delete($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->delete();
    }

    /**
     * Apply discount to a payment
     */
    public function apply_to_payment($payment_id, $discount_id, $discount_amount)
    {
        return $this->db->table('payment_discount_applications')->insert([
            'payment_id' => $payment_id,
            'discount_id' => $discount_id,
            'discount_amount' => $discount_amount,
            'applied_at' => app_now()
        ]);
    }

    /**
     * Get discounts applied to a payment
     */
    public function get_payment_discounts($payment_id)
    {
        return $this->db->table('payment_discount_applications pda')
                        ->left_join('payment_discounts pd', 'pda.discount_id = pd.id')
                        ->select('pda.*, pd.discount_name, pd.discount_type')
                        ->where('pda.payment_id', $payment_id)
                        ->get_all();
    }

    /**
     * Remove discount from payment
     */
    public function remove_from_payment($payment_id, $discount_id)
    {
        return $this->db->table('payment_discount_applications')
                        ->where('payment_id', $payment_id)
                        ->where('discount_id', $discount_id)
                        ->delete();
    }

    /**
     * Calculate total discount for payment
     */
    public function calculate_total_discount($payment_id)
    {
        $result = $this->db->table('payment_discount_applications')
                           ->select('SUM(discount_amount) as total')
                           ->where('payment_id', $payment_id)
                           ->get();
        
        return $result ? (float)$result['total'] : 0;
    }
}
