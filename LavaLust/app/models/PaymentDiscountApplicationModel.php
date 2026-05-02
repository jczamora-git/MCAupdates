<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class PaymentDiscountApplicationModel extends Model {
    
    /**
     * Apply a discount to a payment
     */
    public function apply_discount($payment_id, $template_id, $discount_amount) {
        try {
            // Get payment to determine enrollment linkage
            $payment = $this->db->table('payments')->where('id', $payment_id)->get();
            if (!$payment || empty($payment['enrollment_id'])) {
                return ['success' => false, 'message' => 'Payment is not linked to an enrollment'];
            }
            $enrollment_id = $payment['enrollment_id'];

            // Get template details
            $template = $this->db->table('discount_templates')->where('id', $template_id)->get();
            if (!$template) {
                return ['success' => false, 'message' => 'Discount template not found'];
            }

            // Check if discount already applied for this enrollment
            $existing = $this->db->table('enrollment_discounts')
                ->where('enrollment_id', $enrollment_id)
                ->where('template_id', $template_id)
                ->get();
            
            if ($existing) {
                return ['success' => false, 'message' => 'Discount already applied to this enrollment/payment'];
            }
            
            // Insert discount application into enrollment_discounts
            $data = [
                'enrollment_id' => $enrollment_id,
                'template_id' => $template_id,
                'applied_amount' => $discount_amount,
                'approved_by' => null,
                'created_at' => app_now()
            ];
            
            $this->db->table('enrollment_discounts')->insert($data);
            
            // Recalculate payment totals
            $this->recalculate_payment_total($payment_id);
            
            return ['success' => true, 'message' => 'Discount applied successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error applying discount: ' . $e->getMessage()];
        }
    }

    private function map_discount_type($type) {
        $map = [
            'Sibling' => 'Sibling Discount',
            'Staff' => 'Staff Discount'
        ];
        return $map[$type] ?? $type;
    }
    
    /**
     * Remove a discount from a payment
     */
    public function remove_discount($payment_id, $template_id) {
        try {
            $payment = $this->db->table('payments')->where('id', $payment_id)->get();
            if (!$payment || empty($payment['enrollment_id'])) {
                return ['success' => false, 'message' => 'Payment is not linked to an enrollment'];
            }
            $enrollment_id = $payment['enrollment_id'];

            $this->db->table('enrollment_discounts')
                ->where('enrollment_id', $enrollment_id)
                ->where('template_id', $template_id)
                ->delete();
            
            // Recalculate payment totals
            $this->recalculate_payment_total($payment_id);
            
            return ['success' => true, 'message' => 'Discount removed successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error removing discount: ' . $e->getMessage()];
        }
    }
    
    /**
     * Get all discounts applied to a payment
     */
    public function get_payment_discounts($payment_id) {
        // Fetch enrollment context first
        $payment = $this->db->table('payments')->where('id', $payment_id)->get();
        if (!$payment || empty($payment['enrollment_id'])) {
            return [];
        }
        $enrollment_id = $payment['enrollment_id'];

        $sql = "SELECT ed.id as id,
                       ed.enrollment_id,
                       ed.template_id as discount_id,
                       dt.name as discount_name,
                       dt.value_type as discount_type,
                       dt.value as discount_value,
                       ed.applied_amount as discount_amount,
                       ed.created_at as applied_at
                FROM enrollment_discounts ed
                LEFT JOIN discount_templates dt ON ed.template_id = dt.id
                WHERE ed.enrollment_id = ?";

        $stmt = $this->db->raw($sql, [$enrollment_id]);
        return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    }
    
    /**
     * Get total discount amount for a payment
     */
    public function get_total_discount($payment_id) {
        $payment = $this->db->table('payments')->where('id', $payment_id)->get();
        if (!$payment || empty($payment['enrollment_id'])) {
            return 0;
        }
        $enrollment_id = $payment['enrollment_id'];

        $stmt = $this->db->raw("
            SELECT COALESCE(SUM(applied_amount), 0) as total_discount
            FROM enrollment_discounts
            WHERE enrollment_id = ?
        ", [$enrollment_id]);

        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        if (empty($rows)) {
            return 0;
        }
        return isset($rows[0]['total_discount']) ? (float)$rows[0]['total_discount'] : 0;
    }

    
    /**
     * Recalculate payment total_discount and net_amount
     */
    public function recalculate_payment_total($payment_id) {
        try {
            $total_discount = $this->get_total_discount($payment_id);
            
            // Update payment total_discount
            $this->db->table('payments')
                ->where('id', $payment_id)
                ->update(['total_discount' => $total_discount]);
            
            return ['success' => true, 'total_discount' => $total_discount];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error recalculating total: ' . $e->getMessage()];
        }
    }
    
    /**
     * Get applicable discounts for a payment
     * Returns all active discount templates (filtering logic removed as per new schema)
     */
    public function get_applicable_discounts($student_id, $payment_type) {
        try {
            // Get active discounts from new templates table
            $discounts = $this->db->table('discount_templates')
                ->where('is_active', 1)
                ->get_all();
            
            $mapped_discounts = [];
            foreach ($discounts as $discount) {
                // Map to frontend expected format
                $mapped_discounts[] = [
                    'id' => $discount['id'],
                    'discount_name' => $discount['name'],
                    'discount_type' => $discount['value_type'], // Percentage or Fixed Amount
                    'discount_value' => $discount['value'],
                    'is_active' => $discount['is_active'],
                    'year_levels' => '[]', // Returning empty array strings for compatibility
                    'applicable_fees' => '[]'
                ];
            }
            
            return $mapped_discounts;
        } catch (Exception $e) {
            return [];
        }
    }
    
    /**
     * Calculate discount amount based on discount type
     */
    public function calculate_discount_amount($original_amount, $discount_type, $discount_value) {
        if ($discount_type === 'Percentage') {
            return ($original_amount * $discount_value) / 100;
        } else {
            return min($discount_value, $original_amount); // Fixed amount, but not more than original
        }
    }
    
    /**
     * Remove all discounts from a payment
     */
    public function remove_all_discounts($payment_id) {
        try {
            $payment = $this->db->table('payments')->where('id', $payment_id)->get();
            if (!$payment || empty($payment['enrollment_id'])) {
                return ['success' => false, 'message' => 'Payment is not linked to an enrollment'];
            }
            $enrollment_id = $payment['enrollment_id'];

            $this->db->table('enrollment_discounts')
                ->where('enrollment_id', $enrollment_id)
                ->delete();
            
            // Reset payment total_discount
            $this->db->table('payments')
                ->where('id', $payment_id)
                ->update(['total_discount' => 0]);
            
            return ['success' => true, 'message' => 'All discounts removed'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error removing discounts: ' . $e->getMessage()];
        }
    }
}
?>
