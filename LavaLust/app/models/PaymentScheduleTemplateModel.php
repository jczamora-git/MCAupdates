<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class PaymentScheduleTemplateModel extends Model
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Get all payment schedule templates with their installments
     */
    public function get_all($filters = [])
    {
        $this->db->table('payment_schedule_templates pst')
            ->select('pst.*')
            ->order_by('pst.schedule_type ASC, pst.name ASC');

        if (!empty($filters['schedule_type'])) {
            $this->db->where('pst.schedule_type', $filters['schedule_type']);
        }

        if (!empty($filters['status'])) {
            $this->db->where('pst.status', $filters['status']);
        }

        $templates = $this->db->get_all();

        // Get installments for each template
        if ($templates) {
            foreach ($templates as &$template) {
                $template['installments'] = $this->get_installments($template['id']);
            }
        }

        return $templates ?: [];
    }

    /**
     * Get single template by ID with installments
     */
    public function get_by_id($id)
    {
        $template = $this->db->table('payment_schedule_templates')
            ->where('id', $id)
            ->get();

        if ($template) {
            $template['installments'] = $this->get_installments($id);
        }

        return $template;
    }

    /**
     * Get installments for a template
     */
    public function get_installments($template_id)
    {
        return $this->db->table('payment_schedule_installment_templates')
            ->where('template_id', $template_id)
            ->order_by('installment_number ASC')
            ->get_all() ?: [];
    }

    /**
     * Create payment schedule template with installments
     */
    public function create($data)
    {
        try {
            // Start transaction
            $this->db->transaction();

            // Insert template
            $template_data = [
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'schedule_type' => $data['schedule_type'],
                'number_of_installments' => $data['number_of_installments'],
                'status' => $data['status'] ?? 'active',
                'is_default' => $data['is_default'] ?? 0,
                'is_active' => 1
            ];

            $template_id = $this->db->table('payment_schedule_templates')->insert($template_data);

            if (!$template_id) {
                $this->db->roll_back();
                return false;
            }

            // Insert installments
            if (!empty($data['installments'])) {
                foreach ($data['installments'] as $installment) {
                    $installment_data = [
                        'template_id' => $template_id,
                        'installment_number' => $installment['installment_number'],
                        'month' => $installment['month'] ?? null,
                        'week_of_month' => $installment['week_of_month'],
                        'label' => $installment['label']
                    ];

                    $this->db->table('payment_schedule_installment_templates')->insert($installment_data);
                }
            }

            // Complete transaction
            if (!$this->db->commit()) {
                return false;
            }

            return $template_id;
        } catch (Exception $e) {
            $this->db->roll_back();
            error_log('Create template model error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Update payment schedule template
     */
    public function update($id, $data)
    {
        try {
            $this->db->transaction();

            // Update template
            $template_data = [];
            
            if (isset($data['name'])) $template_data['name'] = $data['name'];
            if (isset($data['description'])) $template_data['description'] = $data['description'];
            if (isset($data['schedule_type'])) $template_data['schedule_type'] = $data['schedule_type'];
            if (isset($data['number_of_installments'])) $template_data['number_of_installments'] = $data['number_of_installments'];
            if (isset($data['status'])) $template_data['status'] = $data['status'];

            if (!empty($template_data)) {
                $this->db->table('payment_schedule_templates')
                    ->where('id', $id)
                    ->update($template_data);
            }

            // Update installments if provided
            if (isset($data['installments']) && is_array($data['installments'])) {
                // Delete existing installments
                $this->db->table('payment_schedule_installment_templates')
                    ->where('template_id', $id)
                    ->delete();

                // Insert new installments
                foreach ($data['installments'] as $installment) {
                    $installment_data = [
                        'template_id' => $id,
                        'installment_number' => $installment['installment_number'],
                        'month' => $installment['month'] ?? null,
                        'week_of_month' => $installment['week_of_month'],
                        'label' => $installment['label']
                    ];

                    $this->db->table('payment_schedule_installment_templates')->insert($installment_data);
                }
            }

            $this->db->commit();

            return true;
        } catch (Exception $e) {
            $this->db->roll_back();
            error_log('Update template model error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Toggle template status
     */
    public function toggle_status($id)
    {
        $template = $this->get_by_id($id);
        if (!$template) return false;

        $new_status = $template['status'] === 'active' ? 'inactive' : 'active';

        return $this->db->table('payment_schedule_templates')
            ->where('id', $id)
            ->update(['status' => $new_status]);
    }

    /**
     * Delete template and its installments
     */
    public function delete($id)
    {
        try {
            $this->db->transaction();

            // Delete installments first (cascade should handle this, but being explicit)
            $this->db->table('payment_schedule_installment_templates')
                ->where('template_id', $id)
                ->delete();

            // Delete template
            $this->db->table('payment_schedule_templates')
                ->where('id', $id)
                ->delete();

            $this->db->commit();

            return true;
        } catch (Exception $e) {
            $this->db->roll_back();
            error_log('Delete template model error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if template is in use by any payment plans
     */
    public function is_template_in_use($id)
    {
        // Check if any payment_plans reference this template
        // You may need to adjust this based on your payment_plans table structure
        $count = $this->db->table('payment_plans')
            ->where('template_id', $id)
            ->count();

        return $count > 0;
    }

    /**
     * Get templates by schedule type
     */
    public function get_by_schedule_type($schedule_type, $active_only = true)
    {
        $this->db->table('payment_schedule_templates pst')
            ->select('pst.*')
            ->where('pst.schedule_type', $schedule_type);

        if ($active_only) {
            $this->db->where('pst.status', 'active');
        }

        $this->db->order_by('pst.name ASC');

        $templates = $this->db->get_all();

        if ($templates) {
            foreach ($templates as &$template) {
                $template['installments'] = $this->get_installments($template['id']);
            }
        }

        return $templates ?: [];
    }
}
