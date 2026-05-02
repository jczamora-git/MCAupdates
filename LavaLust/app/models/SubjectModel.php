<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Subject Model
 * Handles subjects table operations for Nursery to Grade 6
 */
class SubjectModel extends Model
{
    protected $table = 'subjects';

    /**
     * Get all subjects with optional filters
     */
    public function get_all($filters = [])
    {
        $query = $this->db->table($this->table)
                  ->select('id, course_code, name, level, status, created_at, updated_at');

        if (!empty($filters['status'])) {
            $query = $query->where('status', $filters['status']);
        }

        if (!empty($filters['level'])) {
            $query = $query->where('level', $filters['level']);
        }

        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $query = $query->where_group_start();
            $query = $query->like('course_code', $search);
            $query = $query->or_like('name', $search);
            $query = $query->where_group_end();
        }

        return $query->order_by('course_code', 'ASC')->get_all();
    }

    /**
     * Get a single subject by id
     */
    public function get_subject($id)
    {
        return $this->db->table($this->table)
                ->select('id, course_code, name, level, status, created_at, updated_at')
                ->where('id', $id)
                ->get();
    }

    public function find_by_id($id)
    {
        return $this->get_subject($id);
    }

    /**
     * Find subject by course_code
     */
    public function find_by_course_code($code)
    {
        return $this->db->table($this->table)
                ->select('id, course_code, name, level, status, created_at, updated_at')
                ->where('course_code', $code)
                ->get();
    }

    /**
     * Check if course_code exists (optionally excluding an id)
     */
    public function course_code_exists($code, $excludeId = null)
    {
        $query = $this->db->table($this->table)
                          ->where('course_code', $code);

        if ($excludeId) {
            $query = $query->where('id', '!=', $excludeId);
        }

        $result = $query->get();
        return !empty($result);
    }

    /**
     * Create a new subject
     */
    public function create($data)
    {
        $now = app_now();
        $insert = [
            'course_code' => $data['course_code'] ?? '',
            'name' => $data['name'] ?? '',
            'level' => $data['level'] ?? 'Grade 1',
            'status' => $data['status'] ?? 'active',
            'created_at' => $now,
            'updated_at' => $now
        ];

        $result = $this->db->table($this->table)->insert($insert);

        if ($result === false) {
            return false;
        }

        if (is_int($result)) {
            return $result;
        }

        return $this->db->insert_id() ?? true;
    }

    /**
     * Update subject
     */
    public function update_subject($id, $data)
    {
        $data['updated_at'] = app_now();

        $allowed = ['course_code', 'name', 'level', 'status', 'updated_at'];
        $updateData = [];
        foreach ($data as $k => $v) {
            if (in_array($k, $allowed)) {
                $updateData[$k] = $v;
            }
        }

        return $this->db->table($this->table)->where('id', $id)->update($updateData);
    }

    /**
     * Delete subject (soft delete by setting status to inactive)
     */
    public function delete_subject($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update(['status' => 'inactive', 'updated_at' => app_now()]);
    }
}
