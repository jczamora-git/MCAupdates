<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Teacher Model
 * Handles all teacher-related database operations
 */
class TeacherModel extends Model
{
    protected $table = 'teachers';
    
    /**
     * Get all teachers with user data (joined)
     */
    public function get_all($filters = [])
    {
      $query = $this->db->table($this->table)
          ->join('users', 'teachers.user_id = users.id')
                  ->select('teachers.id, teachers.user_id, teachers.employee_id, teachers.status, teachers.status_updated_at, teachers.created_at, teachers.updated_at, users.email, users.first_name, users.last_name, users.phone, users.profile_photo_path, users.status as user_status');

        // Status filter
        if (!empty($filters['status'])) {
            $query = $query->where('users.status', $filters['status']);
        }

        // Search by name, email, or employee_id
        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            // Use where_group_start for OR conditions
            $query = $query->where_group_start();
            $query = $query->like('users.first_name', $search);
            $query = $query->or_like('users.last_name', $search);
            $query = $query->or_like('users.email', $search);
            $query = $query->or_like('teachers.employee_id', $search);
            $query = $query->where_group_end();
        }

        // Department filter
        if (!empty($filters['department'])) {
            $query = $query->where('teachers.department', $filters['department']);
        }

    return $query->order_by('teachers.created_at', 'DESC')->get_all();
    }

    /**
     * Get single teacher with user data
     */
    public function get_teacher($id)
    {
    $result = $this->db->table($this->table)
           ->join('users', 'teachers.user_id = users.id')
               ->select('teachers.*, users.email, users.first_name, users.last_name, users.phone, users.profile_photo_path, users.status as user_status')
               ->where('teachers.id', $id)
               ->get();
        
        return $result;
    }

    /**
     * Get teacher by user_id
     */
    public function get_by_user_id($userId)
    {
        return $this->db->table($this->table)
                        ->where('user_id', $userId)
                        ->get();
    }

    /**
     * Check if employee_id exists
     */
    public function employee_id_exists($employeeId, $excludeId = null)
    {
        $query = $this->db->table($this->table)
                          ->where('employee_id', $employeeId);

        if ($excludeId) {
            $query = $query->where('id', '!=', $excludeId);
        }

        $result = $query->get();
        return !empty($result);
    }

    /**
     * Get teacher stats
     */
    public function get_stats()
    {
        $total = $this->db->table($this->table)
                         ->select('COUNT(*) as count')
                         ->get();

    $active = $this->db->table($this->table)
              ->join('users', 'teachers.user_id = users.id')
                          ->select('COUNT(*) as count')
                          ->where('users.status', 'active')
                          ->get();

    $inactive = $this->db->table($this->table)
                ->join('users', 'teachers.user_id = users.id')
                            ->select('COUNT(*) as count')
                            ->where('users.status', 'inactive')
                            ->get();

        return [
            'total' => $total['count'] ?? 0,
            'active' => $active['count'] ?? 0,
            'inactive' => $inactive['count'] ?? 0,
        ];
    }

    /**
     * Find teacher by ID (alias for get_teacher)
     */
    public function find_by_id($id)
    {
        return $this->get_teacher($id);
    }

    /**
     * Check if email exists (for the associated user)
     */
    public function email_exists($email, $excludeTeacherId = null)
    {
        $query = $this->db->table('users')
                          ->join('teachers', 'users.id = teachers.user_id')
                          ->where('users.email', $email);

        if ($excludeTeacherId) {
            $query = $query->where('teachers.id', '!=', $excludeTeacherId);
        }

        $result = $query->get();
        return !empty($result);
    }

    /**
     * Get assigned courses for a teacher
     * DEPRECATED: Old college model - returns empty array
     * Use get_current_assignment() and get_subjects_for_level() instead for preschool model
     */
    public function get_assigned_courses($teacherId)
    {
        return [];
    }

    /**
     * Update teacher record
     */
    public function update_teacher($id, $data)
    {
        $data['updated_at'] = app_now();
        
        // Separate teacher data from user data
        $teacherData = [];
        $userData = [];

        // Teacher-specific fields
        $teacher_fields = ['employee_id', 'hire_date', 'department', 'specialization', 'updated_at', 'deleted_at'];
        foreach ($data as $key => $value) {
            if (in_array($key, $teacher_fields)) {
                $teacherData[$key] = $value;
            }
        }

        // User-specific fields
        $user_fields = ['first_name', 'last_name', 'email', 'phone', 'profile_photo_path', 'status'];
        foreach ($data as $key => $value) {
            if (in_array($key, $user_fields)) {
                $userData[$key] = $value;
            }
        }

        // Get the teacher to find the user_id
        $teacher = $this->get_teacher($id);
        if (!$teacher) {
            return false;
        }

        // Update teacher record
        if (!empty($teacherData)) {
            $this->db->table($this->table)
                    ->where('id', $id)
                    ->update($teacherData);
        }

        // Update user record
        if (!empty($userData)) {
            $this->db->table('users')
                    ->where('id', $teacher['user_id'])
                    ->update($userData);
        }

        return true;
    }

    /**
     * Soft delete teacher (set deleted_at timestamp)
     */
    public function delete_teacher($id)
    {
        $result = $this->db->table($this->table)
                          ->where('id', $id)
                          ->update([
                              'deleted_at' => app_now()
                          ]);
        
        return $result;
    }

    /**
     * Get teacher counts (for stats)
     */
    public function get_teacher_counts()
    {
        return $this->get_stats();
    }

    /**
     * Get the last employee_id for a given year (returns string or null)
     */
    public function get_last_employee_id($year)
    {
        $pattern = 'EMP' . $year . '-%';

    $result = $this->db->table($this->table)
               ->select('employee_id')
               ->like('employee_id', $pattern)
               ->order_by('id', 'DESC')
               ->limit(1)
               ->get();

        return $result['employee_id'] ?? null;
    }

    /**
     * Get teacher's current assignment for a school year
     */
    public function get_current_assignment($teacherId, $schoolYear = null)
    {
        if (!$schoolYear) {
            // Use current school year if not provided
            $schoolYear = date('Y') . '-' . (date('Y') + 1);
        }

        $sql = "SELECT tsa.teacher_id, tsa.school_year, s.level
                FROM teacher_subject_assignments tsa
                INNER JOIN subjects s ON s.id = tsa.subject_id
                WHERE tsa.teacher_id = ?";
        $params = [$teacherId];

        if ($schoolYear) {
            $sql .= " AND tsa.school_year = ?";
            $params[] = $schoolYear;
        }

        $sql .= " ORDER BY tsa.school_year DESC, s.level ASC LIMIT 1";

        $stmt = $this->db->raw($sql, $params);
        return $stmt ? ($stmt->fetch(PDO::FETCH_ASSOC) ?: null) : null;
    }

    /**
     * Get all assignments for a teacher
     */
    public function get_all_assignments($teacherId)
    {
        $stmt = $this->db->raw(
            "SELECT DISTINCT tsa.teacher_id, tsa.school_year, s.level
             FROM teacher_subject_assignments tsa
             INNER JOIN subjects s ON s.id = tsa.subject_id
             WHERE tsa.teacher_id = ?
             ORDER BY tsa.school_year DESC, s.level ASC",
            [$teacherId]
        );

        return $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    }

    /**
     * Create or update teacher assignment
     */
    public function save_assignment($teacherId, $level, $schoolYear = null)
    {
        if (!$schoolYear) {
            $schoolYear = date('Y') . '-' . (date('Y') + 1);
        }

        if (empty($level)) {
            return false;
        }

        $subjects = $this->db->table('subjects')
                             ->select('id')
                             ->where('level', $level)
                             ->where('status', 'active')
                             ->get_all();

        if (empty($subjects)) {
            return false;
        }

        $now = app_now();
        foreach ($subjects as $subject) {
            if (empty($subject['id'])) {
                continue;
            }

            $existing = $this->db->table('teacher_subject_assignments')
                                 ->where('teacher_id', $teacherId)
                                 ->where('subject_id', $subject['id'])
                                 ->where('school_year', $schoolYear)
                                 ->get();

            if (!empty($existing)) {
                continue;
            }

            $this->db->table('teacher_subject_assignments')->insert([
                'teacher_id' => $teacherId,
                'subject_id' => $subject['id'],
                'school_year' => $schoolYear,
                'created_at' => $now,
                'updated_at' => $now
            ]);
        }

        return true;
    }

    /**
     * Get subjects for a specific level
     */
    public function get_subjects_for_level($level)
    {
        return $this->db->table('subjects')
                        ->where('level', $level)
                        ->where('status', 'active')
                        ->order_by('course_code', 'ASC')
                        ->get_all();
    }

    /**
     * Delete teacher assignment
     */
    public function delete_assignment($teacherId, $schoolYear = null)
    {
        if (!$schoolYear) {
            $schoolYear = date('Y') . '-' . (date('Y') + 1);
        }

        return $this->db->table('teacher_subject_assignments')
                        ->where('teacher_id', $teacherId)
                        ->where('school_year', $schoolYear)
                        ->delete();
    }
}
