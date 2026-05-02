<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Student Model
 * Handles all student-related database operations
 */
class StudentModel extends Model
{
    protected $table = 'students';

    private function log_student_create($message)
    {
        $line = '[' . app_now() . '] ' . $message;
        error_log($line);
        $logPath = dirname(__DIR__) . '/../runtime/student_create.log';
        @file_put_contents($logPath, $line . PHP_EOL, FILE_APPEND);
    }

    /**
     * Get all users with student or enrollee role (includes enrollees without student records)
     * Uses LEFT JOIN to include enrollees who don't have student data yet
     */
    public function get_students_and_enrollees($filters = [])
    {
        // Use raw SQL for better control
        $sql = "SELECT 
                    users.id as user_id, 
                    users.email, 
                    users.first_name, 
                    users.last_name, 
                    users.profile_photo_path,
                    users.phone, 
                    users.role, 
                    users.status as user_status,
                    students.id,
                    students.student_id, 
                    students.rfid_card,
                    students.gender, 
                    students.year_level, 
                    students.section_id, 
                    students.status, 
                    students.graduated_at,
                    students.graduation_batch,
                    students.created_at, 
                    students.updated_at
                FROM users 
                LEFT JOIN students ON users.id = students.user_id 
                WHERE users.role IN ('student', 'enrollee')";
        
        $params = [];
        
        // Status filter
        if (!empty($filters['status'])) {
            $sql .= " AND students.status = ?";
            $params[] = $filters['status'];
        }

        // Year level filter
        if (!empty($filters['year_level'])) {
            $sql .= " AND students.year_level = ?";
            $params[] = $filters['year_level'];
        }

        // Section filter
        if (!empty($filters['section_id'])) {
            $sql .= " AND students.section_id = ?";
            $params[] = $filters['section_id'];
        }

        // Search by name, email, or student_id
        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $sql .= " AND (users.first_name LIKE ? OR users.last_name LIKE ? OR users.email LIKE ? OR students.student_id LIKE ?)";
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }

        $sql .= " ORDER BY users.created_at DESC";
        
        // Execute query and return results
        $stmt = $this->db->raw($sql, $params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get all students with user data (joined)
     */
    public function get_all($filters = [])
    {
        // If search filter is provided, use raw SQL for better flexibility with CONCAT
        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $sql = "SELECT 
                        students.id, students.user_id, students.student_id, students.rfid_card, students.gender, students.year_level, students.section_id, students.status, students.graduated_at, students.graduation_batch, students.created_at, students.updated_at, 
                        users.email, users.first_name, users.middle_name, users.last_name, users.phone, users.profile_photo_path, users.status as user_status, users.role
                    FROM students
                    JOIN users ON students.user_id = users.id
                    WHERE (
                        users.first_name LIKE ?
                        OR users.last_name LIKE ?
                        OR users.email LIKE ?
                        OR students.student_id LIKE ?
                        OR CONCAT(users.first_name, ' ', users.last_name) LIKE ?
                    )";
            
            $params = [$search, $search, $search, $search, $search];
            
            // Add status filter if provided
            if (!empty($filters['status'])) {
                $sql .= " AND students.status = ?";
                $params[] = $filters['status'];
            }
            
            // Add year level filter if provided
            if (!empty($filters['year_level'])) {
                $sql .= " AND students.year_level = ?";
                $params[] = $filters['year_level'];
            }
            
            // Add section filter if provided
            if (!empty($filters['section_id'])) {
                $sql .= " AND students.section_id = ?";
                $params[] = $filters['section_id'];
            }
            
            $sql .= " ORDER BY students.student_id DESC";
            
            $stmt = $this->db->raw($sql, $params);
            $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // No search - use query builder
            $query = $this->db->table($this->table)
                      ->join('users', 'students.user_id = users.id')
                      ->select('students.id, students.user_id, students.student_id, students.rfid_card, students.gender, students.year_level, students.section_id, students.status, students.graduated_at, students.graduation_batch, students.created_at, students.updated_at, users.email, users.first_name, users.middle_name, users.last_name, users.phone, users.profile_photo_path, users.status as user_status, users.role');

            // Status filter
            if (!empty($filters['status'])) {
                $query = $query->where('students.status', $filters['status']);
            }

            // Year level filter
            if (!empty($filters['year_level'])) {
                $query = $query->where('students.year_level', $filters['year_level']);
            }

            // Section filter
            if (!empty($filters['section_id'])) {
                $query = $query->where('students.section_id', $filters['section_id']);
            }

            $students = $query->order_by('students.student_id', 'DESC')->get_all();
        }
        
        // If include_grades is requested, fetch grades for each student
        if (!empty($filters['include_grades']) && is_array($students)) {
            foreach ($students as &$student) {
                $student['grades'] = $this->get_student_grades($student['id']);
            }
        }
        
        return $students;
    }
    
    /**
     * Get all grades for a specific student
     */
    public function get_student_grades($studentId)
    {
        return $this->db->table('activity_grades')
                        ->where('student_id', $studentId)
                        ->get_all();
    }

    /**
     * Get single student with user data
     */
    public function get_student($id)
    {
    $result = $this->db->table($this->table)
               ->join('users', 'students.user_id = users.id')
               ->select('students.*, users.email, users.first_name, users.last_name, users.phone, users.profile_photo_path, users.status as user_status')
               ->where('students.id', $id)
               ->get();
        
        return $result;
    }

    /**
     * Get student by user_id
     */
    public function get_by_user_id($userId)
    {
        return $this->db->table($this->table)
                        ->where('user_id', $userId)
                        ->get();
    }

    /**
     * Get student by RFID card code
     */
    public function get_by_rfid_card($rfidCode)
    {
        return $this->db->table($this->table)
                        ->join('users', 'students.user_id = users.id')
                        ->select('students.id, students.user_id, students.student_id, students.rfid_card, students.year_level, students.section_id, users.first_name, users.last_name, users.email, users.role')
                        ->where('students.rfid_card', $rfidCode)
                        ->get();
    }

    public function update_rfid_card($studentId, $rfidCode)
    {
        return $this->db->table($this->table)
                        ->where('id', $studentId)
                        ->update([
                            'rfid_card' => $rfidCode,
                            'updated_at' => app_now()
                        ]);
    }

    public function clear_rfid_card($studentId)
    {
        return $this->db->table($this->table)
                        ->where('id', $studentId)
                        ->update([
                            'rfid_card' => null,
                            'updated_at' => app_now()
                        ]);
    }

    /**
     * Check if student_id exists
     */
    public function student_id_exists($studentId, $excludeId = null)
    {
        $query = $this->db->table($this->table)
                          ->where('student_id', $studentId);

        if ($excludeId) {
            $query = $query->where('id', '!=', $excludeId);
        }

        $result = $query->get();
        return !empty($result);
    }

    /**
     * Get student stats
     */
    public function get_stats()
    {
        $total = $this->db->table($this->table)
                         ->select('COUNT(*) as count')
                         ->get();
    $active = $this->db->table($this->table)
              ->join('users', 'students.user_id = users.id')
                          ->select('COUNT(*) as count')
                          ->where('users.status', 'active')
                          ->get();

    $inactive = $this->db->table($this->table)
                ->join('users', 'students.user_id = users.id')
                            ->select('COUNT(*) as count')
                            ->where('users.status', 'inactive')
                            ->get();

        $byYear = $this->db->table($this->table)
                          ->select('students.year_level, COUNT(*) as count')
                          ->join('users', 'students.user_id = users.id')
                          ->where('users.status', 'active')
                          ->group_by('students.year_level')
                          ->get_all();

        return [
            'total' => $total['count'] ?? 0,
            'active' => $active['count'] ?? 0,
            'inactive' => $inactive['count'] ?? 0,
            'by_year_level' => $byYear,
        ];
    }

    /**
     * Update student record
     */
    public function update($id, $data)
    {
        $data['updated_at'] = app_now();
        
        $result = $this->db->table($this->table)
                          ->where('id', $id)
                          ->update($data);
        
        return $result;
    }

    /**
     * Delete student and associated user
     */
    public function delete($id)
    {
        // Get the student record first
        $student = $this->get_student($id);
        
        if (!$student) {
            return false;
        }

        $user_id = $student['user_id'];

        try {
            // Start transaction
            $this->db->beginTransaction();

            // Delete student record
            $this->db->table($this->table)
                    ->where('id', $id)
                    ->delete();

            // Delete associated user
            $this->db->table('users')
                    ->where('id', $user_id)
                    ->delete();

            // Commit transaction
            $this->db->commit();

            return true;
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    /**
     * Get the last student_id for a given year (returns string or null)
     */
    public function get_last_student_id($year)
    {
        // Use MCAF{year}- pattern (e.g. MCAF2026-0001)
        $pattern = 'MCAF' . $year . '-%';

        $result = $this->db->table($this->table)
                   ->select('student_id')
                   ->like('student_id', $pattern)
                   ->order_by('student_id', 'DESC')
                   ->limit(1)
                   ->get();

        return $result['student_id'] ?? null;
    }

    /**
     * Generate next student ID for a given year using pattern MCC{year}-{5digit}
     */
    public function generate_student_id($year)
    {
        // Generate using MCAF{year}-{4digit}
        $last = $this->get_last_student_id($year);
        $prefix = 'MCAF' . $year . '-';

        if (!$last) {
            $next = 1;
        } else {
            // Extract numeric suffix
            $suffix = str_replace($prefix, '', $last);
            $num = intval($suffix);
            $next = $num + 1;
        }

        return $prefix . str_pad((string)$next, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Create student record safely by generating student_id and inserting with retries.
     * Returns the created student record on success, or false on failure.
     */
    public function create_student_with_generated_id($studentData, $startYear, $maxRetries = 5)
    {
        $attempt = 0;
        while ($attempt < $maxRetries) {
            $attempt++;
            try {
                // Generate a candidate ID
                $candidate = $this->generate_student_id($startYear);
                $studentData['student_id'] = $candidate;
                if (!isset($studentData['created_at'])) {
                    $studentData['created_at'] = app_now();
                }

                $this->log_student_create("Attempt $attempt: Trying to insert student with ID=$candidate, user_id=" . ($studentData['user_id'] ?? 'null'));

                // Use transaction for safety
                $this->db->transaction();
                $res = $this->db->table($this->table)->insert($studentData);
                $this->db->commit();

                $this->log_student_create("Insert result: " . var_export($res, true));

                // Successful insert - fetch and return the record
                $created = $this->db->table($this->table)->where('student_id', $candidate)->get();
                if ($created) {
                    $this->log_student_create("Successfully created student with ID=$candidate");
                    return $created;
                }

                // Fallback: try to fetch by user_id if insert succeeded
                if (!empty($studentData['user_id'])) {
                    $createdByUser = $this->db->table($this->table)->where('user_id', $studentData['user_id'])->get();
                    if ($createdByUser) {
                        $this->log_student_create("Fetched created student by user_id after insert; ID=" . ($createdByUser['student_id'] ?? 'unknown'));
                        return $createdByUser;
                    }
                }

                $this->log_student_create("WARNING: Insert succeeded but could not fetch created record");
                return false;
            } catch (Exception $e) {
                // Rollback and check if it's duplicate key error; if so, retry
                try { $this->db->roll_back(); } catch (Exception $_) {}
                $msg = $e->getMessage();
                $this->log_student_create("Exception on attempt $attempt: " . $msg);
                
                if (strpos($msg, 'Duplicate entry') !== false || strpos($msg, 'Integrity constraint violation') !== false) {
                    $this->log_student_create("Duplicate key detected, retrying...");
                    usleep(50000); // small sleep to reduce contention
                    continue; // retry
                }
                // Other exception: log and rethrow
                $this->log_student_create("Non-duplicate error, throwing: " . $msg);
                throw $e;
            }
        }

        $this->log_student_create("ERROR: Failed to create student after $maxRetries attempts");
        return false;
    }
}
