<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Installment Model
 * Handles installment data operations
 */
class InstallmentModel extends Model
{
    protected $table = 'installments';

    /**
     * Get all installments across all payment plans
     */
    public function get_all()
    {
        return $this->db->table($this->table)
                        ->order_by('payment_plan_id', 'ASC')
                        ->order_by('installment_number', 'ASC')
                        ->get_all();
    }

    /**
     * Get all installments for a payment plan
     */
    public function get_by_plan($payment_plan_id)
    {
        return $this->db->table($this->table)
                        ->where('payment_plan_id', $payment_plan_id)
                        ->order_by('installment_number', 'ASC')
                        ->get_all();
    }

    /**
     * Get single installment by ID
     */
    public function get_installment($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->get();
    }

    /**
     * Create a new installment
     */
    public function create($data)
    {
        $data['created_at'] = app_now();
        $data['updated_at'] = app_now();
        
        // Ensure required defaults
        if (!isset($data['amount_paid'])) {
            $data['amount_paid'] = 0;
        }
        if (!isset($data['balance'])) {
            $data['balance'] = $data['amount_due'];
        }
        if (!isset($data['status'])) {
            $data['status'] = 'Pending';
        }
        if (!isset($data['late_fee'])) {
            $data['late_fee'] = 0;
        }
        if (!isset($data['days_overdue'])) {
            $data['days_overdue'] = 0;
        }

        return $this->db->table($this->table)->insert($data);
    }

    /**
     * Create multiple installments at once
     */
    public function create_batch($installments)
    {
        $success_count = 0;
        
        foreach ($installments as $installment) {
            if ($this->create($installment)) {
                $success_count++;
            }
        }
        
        return $success_count;
    }

    /**
     * Update an installment
     */
    public function update($id, $data)
    {
        $data['updated_at'] = app_now();
        
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($data);
    }

    /**
     * Record a payment for an installment
     */
    public function record_payment($id, $payment_amount)
    {
        $installment = $this->get_installment($id);
        
        if (!$installment) {
            return false;
        }

        $new_paid_amount = $installment['amount_paid'] + $payment_amount;
        $new_balance = $installment['amount_due'] - $new_paid_amount;
        
        // Determine new status
        $new_status = 'Pending';
        $paid_date = null;
        
        if ($new_balance <= 0) {
            $new_status = 'Paid';
            $new_balance = 0;
            $paid_date = date('Y-m-d');
        } elseif ($new_paid_amount > 0) {
            $new_status = 'Partial';
        }

        return $this->update($id, [
            'amount_paid' => $new_paid_amount,
            'balance' => $new_balance,
            'status' => $new_status,
            'paid_date' => $paid_date
        ]);
    }

    /**
     * Mark installment as paid
     */
    public function mark_paid($id)
    {
        $installment = $this->get_installment($id);
        
        if (!$installment) {
            return false;
        }

        return $this->update($id, [
            'amount_paid' => $installment['amount_due'],
            'balance' => 0,
            'status' => 'Paid',
            'paid_date' => date('Y-m-d')
        ]);
    }

    /**
     * Update overdue status for all installments
     * Should be called daily via cron job
     */
    public function update_overdue_status()
    {
        $today = date('Y-m-d');
        
        // Get all pending/partial installments that are past due
        $overdue = $this->db->table($this->table)
                            ->where_in('status', ['Pending', 'Partial'])
                            ->where('due_date <', $today)
                            ->get_all();
        
        $updated_count = 0;
        
        foreach ($overdue as $installment) {
            $due_date = new DateTime($installment['due_date']);
            $current_date = new DateTime($today);
            $days_overdue = $current_date->diff($due_date)->days;
            
            // Calculate late fee (optional: 1% per day, max 10%)
            $late_fee_rate = 0.01; // 1% per day
            $max_late_fee_rate = 0.10; // 10% max
            $late_fee_percentage = min($days_overdue * $late_fee_rate, $max_late_fee_rate);
            $late_fee = $installment['balance'] * $late_fee_percentage;
            
            $this->update($installment['id'], [
                'status' => 'Overdue',
                'days_overdue' => $days_overdue,
                'late_fee' => $late_fee
            ]);
            
            $updated_count++;
        }
        
        return $updated_count;
    }

    /**
     * Delete an installment
     */
    public function delete($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->delete();
    }

    /**
     * Delete all installments for a payment plan
     */
    public function delete_by_plan($payment_plan_id)
    {
        return $this->db->table($this->table)
                        ->where('payment_plan_id', $payment_plan_id)
                        ->delete();
    }

    /**
     * Get next pending installment for a payment plan
     */
    public function get_next_pending($payment_plan_id)
    {
        return $this->db->table($this->table)
                        ->where('payment_plan_id', $payment_plan_id)
                        ->where_in('status', ['Pending', 'Partial', 'Overdue'])
                        ->order_by('installment_number', 'ASC')
                        ->get();
    }
}
