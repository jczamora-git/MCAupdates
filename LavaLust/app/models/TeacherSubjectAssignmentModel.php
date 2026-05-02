<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * TeacherSubjectAssignment Model
 * Handles teacher subject assignments (many-to-many relationship)
 */
class TeacherSubjectAssignmentModel extends Model
{
    protected $table = 'teacher_subject_assignments';

    /**
     * Get all subject assignments with teacher and subject info
     */
    public function get_all_with_details($filters = [])
    {
        $query = $this->db->table($this->table . ' tsa')
                          ->join('teachers t', 'tsa.teacher_id = t.id')
                          ->join('users u', 't.user_id = u.id')
                          ->join('subjects s', 'tsa.subject_id = s.id')
                          ->left_join('year_levels yl', 'yl.name COLLATE utf8mb4_unicode_ci = s.level COLLATE utf8mb4_unicode_ci')
                          ->left_join('year_level_sections yls', 'yls.year_level_id = yl.id')
                          ->left_join('sections sec', 'sec.id = yls.section_id')
                          ->select('tsa.id, tsa.teacher_id, tsa.subject_id, tsa.school_year, tsa.created_at, tsa.updated_at,
                                   t.employee_id, u.first_name, u.last_name, u.email, u.phone,
                                   s.course_code, s.name as subject_name, s.level as subject_level,
                                   sec.id as section_id, sec.name as section_name');

        if (!empty($filters['school_year'])) {
            $query = $query->where('tsa.school_year', $filters['school_year']);
        }

        if (!empty($filters['teacher_id'])) {
            $query = $query->where('tsa.teacher_id', $filters['teacher_id']);
        }

        if (!empty($filters['subject_id'])) {
            $query = $query->where('tsa.subject_id', $filters['subject_id']);
        }

        if (!empty($filters['level'])) {
            $query = $query->where('s.level', $filters['level']);
        }

        return $query->order_by('u.last_name', 'ASC')->order_by('s.course_code', 'ASC')->get_all();
    }

    /**
     * Get a single subject assignment with details
     */
    public function get_with_details($id)
    {
        return $this->db->table($this->table . ' tsa')
                        ->join('teachers t', 'tsa.teacher_id = t.id')
                        ->join('users u', 't.user_id = u.id')
                        ->join('subjects s', 'tsa.subject_id = s.id')
                        ->select('tsa.id, tsa.teacher_id, tsa.subject_id, tsa.school_year, tsa.created_at, tsa.updated_at,
                                 t.employee_id, u.first_name, u.last_name, u.email, u.phone,
                                 s.course_code, s.name as subject_name, s.level as subject_level')
                        ->where('tsa.id', $id)
                        ->get();
    }

    /**
     * Get subjects assigned to a specific teacher
     */
    public function get_teacher_subjects($teacher_id, $school_year = null)
    {
        // Since there is exactly one section per year level (via year_level_sections),
        // we join through year_levels → year_level_sections → sections to resolve the
        // section_id and section_name directly, avoiding extra round-trips from the frontend.
        $sql = "
            SELECT
                tsa.id,
                tsa.subject_id,
                tsa.school_year,
                tsa.created_at,
                s.course_code,
                s.name,
                s.level,
                s.status,
                sec.id   AS section_id,
                sec.name AS section_name
            FROM teacher_subject_assignments tsa
            INNER JOIN subjects s        ON tsa.subject_id = s.id
            LEFT  JOIN year_levels yl    ON yl.name COLLATE utf8mb4_unicode_ci = s.level COLLATE utf8mb4_unicode_ci
            LEFT  JOIN year_level_sections yls ON yls.year_level_id = yl.id
            LEFT  JOIN sections sec      ON sec.id = yls.section_id
            WHERE tsa.teacher_id = ?
        ";

        $params = [$teacher_id];

        if ($school_year) {
            $sql .= " AND tsa.school_year = ?";
            $params[] = $school_year;
        }

        $sql .= " ORDER BY s.course_code ASC";

        $stmt = $this->db->raw($sql, $params);
        return $stmt ? $stmt->fetchAll(\PDO::FETCH_ASSOC) : [];
    }

    /**
     * Create a new subject assignment
     * Validates that the same teacher-subject-year combination doesn't exist
     */
    public function create_assignment($teacher_id, $subject_id, $school_year)
    {
        // Check if assignment already exists
        $existing = $this->db->table($this->table)
                             ->where('teacher_id', $teacher_id)
                             ->where('subject_id', $subject_id)
                             ->where('school_year', $school_year)
                             ->get();

        if (!empty($existing)) {
            return ['success' => false, 'message' => 'Teacher is already assigned to this subject for this school year'];
        }

        $now = app_now();
        $data = [
            'teacher_id' => $teacher_id,
            'subject_id' => $subject_id,
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
     * Remove a subject assignment
     */
    public function remove_assignment($id)
    {
        return $this->db->table($this->table)->where('id', $id)->delete();
    }

    /**
     * Remove all subject assignments for a teacher in a school year
     */
    public function remove_teacher_assignments($teacher_id, $school_year = null)
    {
        $query = $this->db->table($this->table)->where('teacher_id', $teacher_id);

        if ($school_year) {
            $query = $query->where('school_year', $school_year);
        }

        return $query->delete();
    }

    /**
     * Get teachers assigned to a specific subject
     */
    public function get_subject_teachers($subject_id, $school_year = null)
    {
        $query = $this->db->table($this->table . ' tsa')
                          ->join('teachers t', 'tsa.teacher_id = t.id')
                          ->join('users u', 't.user_id = u.id')
                          ->select('tsa.id, tsa.teacher_id, tsa.school_year,
                                   t.employee_id, u.first_name, u.last_name, u.email, u.phone')
                          ->where('tsa.subject_id', $subject_id);

        if ($school_year) {
            $query = $query->where('tsa.school_year', $school_year);
        }

        return $query->order_by('u.last_name', 'ASC')->get_all();
    }
}