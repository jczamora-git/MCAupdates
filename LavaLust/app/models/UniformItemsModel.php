<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * UniformItems Model
 * Handles CRUD for uniform_items table
 */
class UniformItemsModel extends Model
{
    protected $table = 'uniform_items';

    public function create($data)
    {
        $fields = [
            'item_name',
            'item_group',
            'applicable_levels',
            'applicable_gender',
            'is_pair',
            'allow_half_price',
            'is_active',
        ];

        $insert_data = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $insert_data[$field] = $data[$field];
            }
        }

        if (!isset($insert_data['is_active'])) {
            $insert_data['is_active'] = 1;
        }

        $result = $this->db->table($this->table)->insert($insert_data);

        if ($result) {
            return $this->db->last_id();
        }

        return false;
    }

    public function update($id, $data)
    {
        $fields = [
            'item_name',
            'item_group',
            'applicable_levels',
            'applicable_gender',
            'is_pair',
            'allow_half_price',
            'is_active',
        ];

        $update_data = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $update_data[$field] = $data[$field];
            }
        }

        if (empty($update_data)) {
            return false;
        }

        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($update_data);
    }
}
