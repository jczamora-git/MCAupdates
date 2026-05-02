<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Discount_model extends Model {

    public function get_all_templates() {
        return $this->db->table('discount_templates')->get_all();
    }

    public function create_template($data) {
        $bind = [
            'name' => $data['name'],
            'type' => $data['discount_type'] ?? 'Other',
            'value' => $data['value'],
            'value_type' => $data['value_type'] ?? 'Percentage', // Mapped from frontend type
            'description' => $data['description'] ?? '',
            'is_active' => $data['is_active'] ?? 1
        ];
        return $this->db->table('discount_templates')->insert($bind);
    }

    public function update_template($id, $data) {
        $bind = [
            'name' => $data['name'],
            'type' => $data['discount_type'] ?? 'Other',
            'value' => $data['value'],
            'value_type' => $data['value_type'] ?? 'Percentage',
            'description' => $data['description'] ?? '',
            'is_active' => $data['is_active'] ?? 1
        ];
        return $this->db->table('discount_templates')->where('id', $id)->update($bind);
    }

    public function delete_template($id) {
        // Check if used in enrollments (optional safety check)
        // For now, strict delete.
        return $this->db->table('discount_templates')->where('id', $id)->delete();
    }

    public function toggle_template_status($id) {
        $template = $this->db->table('discount_templates')->where('id', $id)->get();
        if ($template) {
            $new_status = $template['is_active'] ? 0 : 1;
            return $this->db->table('discount_templates')->where('id', $id)->update(['is_active' => $new_status]);
        }
        return false;
    }

    public function get_active_templates() {
        return $this->db->table('discount_templates')->where('is_active', 1)->get_all();
    }
}
