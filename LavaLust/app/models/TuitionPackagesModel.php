<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * TuitionPackages Model
 * Handles tuition package headers and basic CRUD
 */
class TuitionPackagesModel extends Model
{
    protected $table = 'tuition_packages';

    public function create($data)
    {
        $fields = [
            'name',
            'effective_from',
            'effective_to',
            'is_active'
        ];

        $insert_data = [];
        foreach ($fields as $field) {
            if (isset($data[$field])) {
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
            'name',
            'effective_from',
            'effective_to',
            'is_active'
        ];

        $update_data = [];
        foreach ($fields as $field) {
            if (isset($data[$field])) {
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
