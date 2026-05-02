<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * TeacherAdviserAssignment Model
 * Handles teacher adviser assignments (one adviser per grade level per school year)
 */
class TeacherAdviserAssignmentModel extends Model
{
    protected $table = 'teacher_adviser_assignments';

    /**
     * Get all adviser assignments with teacher info
     */
    public function get_all_with_teacher($filters = [])
    {
        $query = $this->db->table($this->table . ' taa')
                          ->join('teachers t', 'taa.teacher_id = t.id')
                          ->join('users u', 't.user_id = u.id')
                          ->select('taa.id, taa.teacher_id, taa.level, taa.school_year, taa.created_at, taa.updated_at,
                                   t.employee_id, u.first_name, u.last_name, u.email, u.phone');

        if (!empty($filters['school_year'])) {
            $query = $query->where('taa.school_year', $filters['school_year']);
        }

        if (!empty($filters['level'])) {
            $query = $query->where('taa.level', $filters['level']);
        }

        if (!empty($filters['teacher_id'])) {
            $query = $query->where('taa.teacher_id', $filters['teacher_id']);
        }

        return $query->order_by('taa.level', 'ASC')->get_all();
    }

    /**
     * Get a single adviser assignment with teacher info
     */
    public function get_with_teacher($id)
    {
        return $this->db->table($this->table . ' taa')
                        ->join('teachers t', 'taa.teacher_id = t.id')
                        ->join('users u', 't.user_id = u.id')
                        ->select('taa.id, taa.teacher_id, taa.level, taa.school_year, taa.created_at, taa.updated_at,
                                 t.employee_id, u.first_name, u.last_name, u.email, u.phone')
                        ->where('taa.id', $id)
                        ->get();
    }

    /**
     * Create a new adviser assignment
     * Validates that no other teacher is assigned to the same level/year
     */
    public function create_assignment($teacher_id, $level, $school_year)
    {
        // Check if level/year already has an adviser
        $existing = $this->db->table($this->table)
                             ->where('level', $level)
                             ->where('school_year', $school_year)
                             ->get();

        if (!empty($existing)) {
            return ['success' => false, 'message' => 'Grade level already has an adviser assigned for this school year'];
        }

        // Check if teacher is already assigned as adviser for this year
        $teacher_existing = $this->db->table($this->table)
                                     ->where('teacher_id', $teacher_id)
                                     ->where('school_year', $school_year)
                                     ->get();

        if (!empty($teacher_existing)) {
            return ['success' => false, 'message' => 'Teacher is already assigned as adviser for this school year'];
        }

        $now = app_now();
        $data = [
            'teacher_id' => $teacher_id,
            'level' => $level,
            'school_year' => $school_year,
            'created_at' => $now,
            'updated_at' => $now
        ];

        $result = $this->db->table($this->table)->insert($data);

        if ($result === false) {
            return ['success' => false, 'message' => 'Failed to create assignment'];
        }

        return ['success' => true, 'id' => $this->db->insert_id()];
    }

    /**
     * Remove an adviser assignment
     */
    public function remove_assignment($id)
    {
        return $this->db->table($this->table)->where('id', $id)->delete();
    }

    /**
     * Get adviser for a specific level and school year
     */
    public function get_adviser_for_level($level, $school_year)
    {
        return $this->db->table($this->table . ' taa')
                        ->join('teachers t', 'taa.teacher_id = t.id')
                        ->join('users u', 't.user_id = u.id')
                        ->select('taa.id, taa.teacher_id, taa.level, taa.school_year,
                                 t.employee_id, u.first_name, u.last_name, u.email, u.phone')
                        ->where('taa.level', $level)
                        ->where('taa.school_year', $school_year)
                        ->get();
    }
}