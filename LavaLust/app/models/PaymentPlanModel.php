<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Plan Model
 * Handles payment plan data operations
 */
class PaymentPlanModel extends Model
{
    protected $table = 'payment_plans';

    /**
     * Get all payment plans with optional filters
     */
    public function get_all($filters = [])
    {
        $query = $this->db->table($this->table . ' pp');
        
        // Join with related tables
        $query = $query->left_join('users u', 'pp.student_id = u.id')
                       ->left_join('students s', 'pp.student_id = s.user_id')
                       ->left_join('academic_periods ap', 'pp.academic_period_id = ap.id');

        // Apply filters
        if (!empty($filters['student_id'])) {
            $query = $query->where('pp.student_id', $filters['student_id']);
        }

        if (!empty($filters['academic_period_id'])) {
            $query = $query->where('pp.academic_period_id', $filters['academic_period_id']);
        }

        if (!empty($filters['status'])) {
            $query = $query->where('pp.status', $filters['status']);
        }

        if (!empty($filters['payment_type'])) {
            $query = $query->where('pp.payment_type', $filters['payment_type']);
        }

        // Select fields
        $query = $query->select('pp.*, 
                                 u.first_name, u.last_name, u.email,
                                 s.student_id as student_number,
                                 ap.school_year, ap.quarter,
                                 CONCAT(u.first_name, " ", u.last_name) as student_name,
                                 CONCAT(ap.school_year, " - ", ap.quarter) as academic_period');

        return $query->order_by('pp.created_at', 'DESC')->get_all();
    }

    /**
     * Get single payment plan by ID
     */
    public function get_plan($id)
    {
        return $this->db->table($this->table . ' pp')
                        ->left_join('users u', 'pp.student_id = u.id')
                        ->left_join('students s', 'pp.student_id = s.user_id')
                        ->left_join('academic_periods ap', 'pp.academic_period_id = ap.id')
                        ->select('pp.*, 
                                 u.first_name, u.last_name, u.email,
                                 s.student_id as student_number,
                                 ap.school_year, ap.quarter,
                                 CONCAT(u.first_name, " ", u.last_name) as student_name,
                                 CONCAT(ap.school_year, " - ", ap.quarter) as academic_period')
                        ->where('pp.id', $id)
                        ->get();
    }

    /**
     * Create a new payment plan
     */
    public function create($data)
    {
        $data['created_at'] = app_now();
        $data['updated_at'] = app_now();
        
        // Ensure required defaults
        if (!isset($data['total_paid'])) {
            $data['total_paid'] = 0;
        }
        if (!isset($data['balance'])) {
            $data['balance'] = $data['total_tuition'];
        }
        if (!isset($data['status'])) {
            $data['status'] = 'Active';
        }

        return $this->db->table($this->table)->insert($data);
    }

    /**
     * Update a payment plan
     */
    public function update($id, $data)
    {
        $data['updated_at'] = app_now();
        
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($data);
    }

    /**
     * Update payment plan balances (called when payment is made)
     */
    public function update_balance($id, $payment_amount)
    {
        $plan = $this->get_plan($id);
        
        if (!$plan) {
            return false;
        }

        $new_paid_amount = $plan['total_paid'] + $payment_amount;
        $new_balance = $plan['total_tuition'] - $new_paid_amount;
        
        // Determine new status
        $new_status = $plan['status'];
        if ($new_balance <= 0) {
            $new_status = 'Completed';
            $new_balance = 0;
        }

        return $this->update($id, [
            'total_paid' => $new_paid_amount,
            'balance' => $new_balance,
            'status' => $new_status
        ]);
    }

    /**
     * Delete a payment plan
     */
    public function delete($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->delete();
    }

    /**
     * Get active payment plan for a student in a specific academic period
     */
    public function get_student_active_plan($student_id, $academic_period_id)
    {
        return $this->db->table($this->table)
                        ->where('student_id', $student_id)
                        ->where('academic_period_id', $academic_period_id)
                        ->where('status', 'Active')
                        ->get();
    }

    /**
     * Check if student already has an active plan for the period
     */
    public function has_active_plan($student_id, $academic_period_id)
    {
        $result = $this->get_student_active_plan($student_id, $academic_period_id);
        return !empty($result) && $result !== false;
    }
}
