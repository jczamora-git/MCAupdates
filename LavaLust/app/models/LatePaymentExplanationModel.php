<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Late Payment Explanation Model
 *
 * Stores mandatory student explanations for late payments.
 * Note: Penalties are ALWAYS charged - this is for record-keeping only.
 */
class LatePaymentExplanationModel extends Model
{
    /**
     * Create a new late payment explanation
     * @param array $data
     * @return int|false inserted id or false
     */
    public function create($data)
    {
        try {
            $this->db->table('late_payment_explanations')->insert($data);
            return $this->db->last_id();
        } catch (Exception $e) {
            error_log('LatePaymentExplanationModel::create error: ' . $e->getMessage());
            return false;
        }
    }

    public function get_by_student($studentId)
    {
        try {
            return $this->db->table('late_payment_explanations lpe')
                ->select('lpe.*')
                ->where('lpe.student_id', $studentId)
                ->order_by('lpe.submitted_at', 'DESC')
                ->get_all();
        } catch (Exception $e) {
            error_log('LatePaymentExplanationModel::get_by_student error: ' . $e->getMessage());
            return [];
        }
    }

    public function get_by_id($id)
    {
        try {
            $res = $this->db->table('late_payment_explanations')
                ->where('id', $id)
                ->get();

            return $res ? $res[0] : null;
        } catch (Exception $e) {
            error_log('LatePaymentExplanationModel::get_by_id error: ' . $e->getMessage());
            return null;
        }
    }
}

?>
