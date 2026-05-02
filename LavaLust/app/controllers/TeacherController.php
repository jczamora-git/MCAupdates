<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class TeacherController extends Controller
{
    public function __construct()
    {
        parent::__construct();
    }
    /**
     * Check if user is admin
     * @return bool
     */
    private function is_admin()
    {
        return $this->session->userdata('logged_in') === true && 
               $this->session->userdata('role') === 'admin';
    }

    /**
     * Get last employee ID for a given year (for ID generation)
     * GET /api/teachers/last-id?year=2025
     */
    public function api_get_last_id()
    {
         api_set_json_headers();
        
        try {
            $year = $_GET['year'] ?? date('Y');
            
            // Use the TeacherModel to fetch the last employee_id for the year
            $lastId = $this->TeacherModel->get_last_employee_id($year);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'last_id' => $lastId,
                'year' => $year
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get all teachers with optional filters
     * GET /api/teachers
     */
    public function api_get_teachers()
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            // Get query parameters safely
            $filters = [];
            
            if (isset($_GET['status']) && !empty($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }
            
            if (isset($_GET['search']) && !empty($_GET['search'])) {
                $filters['search'] = $_GET['search'];
            }
            
            $teachers = $this->TeacherModel->get_all($filters);
            
            echo json_encode([
                'success' => true,
                'teachers' => $teachers,
                'count' => count($teachers)
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get single teacher by ID
     * GET /api/teachers/{id}
     */
    public function api_get_teacher($id)
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            $teacher = $this->TeacherModel->find_by_id($id);
            
            if (!$teacher) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher not found'
                ]);
                return;
            }
            
            echo json_encode([
                'success' => true,
                'teacher' => $teacher
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * GET /api/teachers/{id}/public
     * Student-accessible: returns basic teacher profile for public/student views
     */
    public function api_get_public_teacher($id)
    {
         api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $teacher = $this->TeacherModel->find_by_id($id);

            if (!$teacher) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher not found'
                ]);
                return;
            }

            // Minimal public profile
            $public = [
                'id' => $teacher['id'] ?? null,
                'first_name' => $teacher['first_name'] ?? null,
                'last_name' => $teacher['last_name'] ?? null,
                'email' => $teacher['email'] ?? null,
                'phone' => $teacher['phone'] ?? null,
                'employee_id' => $teacher['employee_id'] ?? null,
            ];

            echo json_encode([
                'success' => true,
                'teacher' => $public
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * GET /api/teachers/by-user/{user_id}
     * Get teacher record by user_id
     */
    public function api_get_teacher_by_user($user_id)
    {
        api_set_json_headers();
        
        try {
            $teacher = $this->TeacherModel->get_by_user_id($user_id);
            
            if (!$teacher) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher not found for this user'
                ]);
                return;
            }
            
            echo json_encode([
                'success' => true,
                'teacher' => $teacher
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Create new teacher
     * POST /api/teachers
     * 
     * Supports two modes:
     * 1. Simple profile creation (from React frontend): {user_id, employee_id}
     * 2. Full teacher creation: {firstName, lastName, email, employeeId, phone, assignedCourses}
     */
    public function api_create_teacher()
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            // Get raw POST data and decode JSON
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            // Check if this is simple profile creation (from React frontend)
            $user_id = $json_data['user_id'] ?? null;
            $employee_id = $json_data['employee_id'] ?? '';
            
            if ($user_id && $employee_id && !isset($json_data['firstName'])) {
                // Simple profile creation mode
                return $this->create_teacher_profile($user_id, $employee_id);
            }
            
            // Full teacher creation mode
            $first_name = $json_data['firstName'] ?? '';
            $last_name = $json_data['lastName'] ?? '';
            $email = $json_data['email'] ?? '';
            $employee_id = $json_data['employeeId'] ?? '';
            $phone = $json_data['phone'] ?? '';
            
            // Validation
            if (empty($first_name) || empty($last_name) || empty($email) || empty($employee_id)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'First name, last name, email, and employee ID are required'
                ]);
                return;
            }
            
            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email format'
                ]);
                return;
            }
            
            // Check if email exists
            if ($this->TeacherModel->email_exists($email)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists'
                ]);
                return;
            }
            
            // Check if employee ID exists
            if ($this->TeacherModel->employee_id_exists($employee_id)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Employee ID already exists'
                ]);
                return;
            }
            
            // Prepare teacher data
            $teacherData = [
                'first_name' => $first_name,
                'last_name' => $last_name,
                'email' => $email,
                'employee_id' => $employee_id,
                'phone' => $phone,
                'status' => 'active'
            ];
            
            // Create teacher
            $teacherId = $this->TeacherModel->create($teacherData);
            
            if (!$teacherId) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create teacher'
                ]);
                return;
            }
            
            // Get created teacher
            $teacher = $this->TeacherModel->find_by_id($teacherId);
            
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Teacher created successfully',
                'teacher' => $teacher
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Create teacher profile (simple - only user_id and employee_id)
     * Called from api_create_teacher when receiving {user_id, employee_id}
     */
    private function create_teacher_profile($user_id, $employee_id)
    {
        try {
            // Validate inputs
            if (empty($user_id) || empty($employee_id)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'user_id and employee_id are required'
                ]);
                return;
            }

            // Check if employee ID already exists
            if ($this->TeacherModel->employee_id_exists($employee_id)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Employee ID already exists'
                ]);
                return;
            }

            // Insert teacher profile
            $teacherData = [
                'user_id' => $user_id,
                'employee_id' => $employee_id,
                'created_at' => app_now()
            ];

            $result = $this->db->table('teachers')->insert($teacherData);

            if ($result) {
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Teacher profile created successfully',
                    'user_id' => $user_id,
                    'employee_id' => $employee_id
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create teacher profile'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update existing teacher
     * PUT /api/teachers/{id}
     */
    public function api_update_teacher($id)
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            // Check if teacher exists
            $existingTeacher = $this->TeacherModel->find_by_id($id);
            if (!$existingTeacher) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher not found'
                ]);
                return;
            }
            
            // Get raw PUT data and decode JSON
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            // Extract data
            $first_name = $json_data['firstName'] ?? '';
            $last_name = $json_data['lastName'] ?? '';
            $email = $json_data['email'] ?? '';
            $employee_id = $json_data['employeeId'] ?? '';
            $phone = $json_data['phone'] ?? '';
            $profile_photo_path = $json_data['profile_photo_path'] ?? ($json_data['profilePhotoPath'] ?? null);
            $status = $json_data['status'] ?? '';
            $year_level = $json_data['yearLevel'] ?? $json_data['year_level'] ?? '';
            
            // Validation
            if (empty($first_name) || empty($last_name) || empty($email) || empty($employee_id)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'First name, last name, email, and employee ID are required'
                ]);
                return;
            }
            
            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email format'
                ]);
                return;
            }
            
            // Check if email exists (excluding current teacher)
            if ($email !== $existingTeacher['email'] && $this->TeacherModel->email_exists($email, $id)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists'
                ]);
                return;
            }
            
            // Check if employee ID exists (excluding current teacher)
            if ($employee_id !== $existingTeacher['employee_id'] && $this->TeacherModel->employee_id_exists($employee_id, $id)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Employee ID already exists'
                ]);
                return;
            }
            
            // Prepare update data
            $updateData = [
                'first_name' => $first_name,
                'last_name' => $last_name,
                'email' => $email,
                'employee_id' => $employee_id,
                'phone' => $phone,
                'profile_photo_path' => !empty($profile_photo_path) ? $profile_photo_path : null
            ];
            
            // Only update status if provided and valid
            if (!empty($status) && in_array($status, ['active', 'inactive'])) {
                $updateData['status'] = $status;
            }
            
            // Update teacher
            $result = $this->TeacherModel->update_teacher($id, $updateData);
            
            if (!$result) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update teacher'
                ]);
                return;
            }
            
            // Handle year level assignment (new preschool model)
            if (!empty($year_level)) {
                $this->TeacherModel->save_assignment($id, $year_level);
            }
            
            // Get updated teacher
            $teacher = $this->TeacherModel->find_by_id($id);
            $assignment = $this->TeacherModel->get_current_assignment($id);
            $teacher['assignment'] = $assignment;
            
            // Get subjects for assigned level if assignment exists
            if (!empty($assignment) && !empty($assignment['level'])) {
                $teacher['subjects_for_level'] = $this->TeacherModel->get_subjects_for_level($assignment['level']);
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Teacher updated successfully',
                'teacher' => $teacher
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Delete teacher (soft delete - set status to inactive)
     * DELETE /api/teachers/{id}
     */
    public function api_delete_teacher($id)
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            // Check if teacher exists
            $teacher = $this->TeacherModel->find_by_id($id);
            if (!$teacher) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher not found'
                ]);
                return;
            }
            
            // Soft delete (set status to inactive)
            $result = $this->TeacherModel->delete_teacher($id);
            
            if ($result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Teacher deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete teacher'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get teacher statistics
     * GET /api/teachers/stats
     */
    public function api_teacher_stats()
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            $counts = $this->TeacherModel->get_teacher_counts();
            
            echo json_encode([
                'success' => true,
                'stats' => $counts
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * API: Get teacher assignment with subjects for assigned level
     */
    public function api_get_teacher_assignment($id)
    {
        api_set_json_headers();
        
        try {
            // Get teacher
            $teacher = $this->TeacherModel->find_by_id($id);
            if (!$teacher) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher not found'
                ]);
                return;
            }
            
            // Get teacher's current assignment
            $assignment = $this->TeacherModel->get_current_assignment($id);
            
            $response = [
                'success' => true,
                'teacher' => $teacher,
                'assignment' => $assignment,
                'subjects' => []
            ];
            
            // Get subjects for assigned level if assignment exists
            if (!empty($assignment) && !empty($assignment['level'])) {
                $response['subjects'] = $this->TeacherModel->get_subjects_for_level($assignment['level']);
            }
            
            echo json_encode($response);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get all teacher assignments
     * GET /api/teacher-assignments
     */
    public function api_get_all_assignments()
    {
        api_set_json_headers();
        
        try {
            $assignments = $this->db->table('teacher_assignments')
                                    ->order_by('school_year', 'DESC')
                                    ->order_by('level', 'ASC')
                                    ->get_all();
            
            echo json_encode([
                'success' => true,
                'assignments' => $assignments ?? []
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get current logged-in teacher's assignment and subjects
     * GET /api/teacher-assignments/my
     */
    public function api_get_my_assignment()
    {
        api_set_json_headers();
        
        try {
            // Check if user is logged in and is a teacher
            $logged_in = $this->session->userdata('logged_in');
            $role = $this->session->userdata('role');
            $user_id = $this->session->userdata('user_id');
            
            if (!$logged_in || $role !== 'teacher' || !$user_id) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'Access denied. Teacher authentication required.'
                ]);
                return;
            }
            
            // Get teacher record from user_id
            $teacher = $this->TeacherModel->get_by_user_id($user_id);
            if (!$teacher) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher profile not found'
                ]);
                return;
            }
            
            // Get teacher's current assignment (year level)
            $assignment = $this->TeacherModel->get_current_assignment($teacher['id']);
            
            // If no assignment, return empty response
            if (!$assignment || empty($assignment['level'])) {
                echo json_encode([
                    'success' => true,
                    'assignment' => null,
                    'assigned_courses' => [],
                    'total_students' => 0,
                    'message' => 'No year level assignment found'
                ]);
                return;
            }
            
            // Get all subjects for the assigned year level
            $subjects = $this->TeacherModel->get_subjects_for_level($assignment['level']);
            
            // Get students for this year level to calculate total students
            $students = $this->db->table('students')
                                 ->join('users', 'students.user_id = users.id')
                                 ->select('students.id, students.student_id, students.section_id, users.first_name, users.last_name, users.email')
                                 ->where('students.year_level', $assignment['level'])
                                 ->where('users.status', 'active')
                                 ->get_all();
            
            $totalStudents = count($students ?? []);
            
            // Get section information if students are in sections
            $sectionStudentCounts = [];
            if ($totalStudents > 0) {
                // Group students by section
                foreach ($students as $student) {
                    $sectionId = $student['section_id'] ?? 'no_section';
                    if (!isset($sectionStudentCounts[$sectionId])) {
                        $sectionStudentCounts[$sectionId] = 0;
                    }
                    $sectionStudentCounts[$sectionId]++;
                }
            }
            
            // Format response similar to what dashboard expects
            $assignedCourses = [];
            foreach ($subjects as $subject) {
                $assignedCourses[] = [
                    'id' => $subject['id'],
                    'subject_id' => $subject['id'],
                    'teacher_subject_id' => $subject['id'],
                    'course_code' => $subject['course_code'] ?? '',
                    'course_name' => $subject['name'] ?? '',
                    'year_level' => $subject['level'] ?? '',
                    'level' => $subject['level'] ?? '',
                    'status' => $subject['status'] ?? 'active',
                    'sections' => [], // Sections are the same across all subjects for this year level
                    'students_count' => $totalStudents // Total students for this year level
                ];
            }
            
            echo json_encode([
                'success' => true,
                'assignment' => $assignment,
                'assigned_courses' => $assignedCourses,
                'year_level' => $assignment['level'],
                'school_year' => $assignment['school_year'],
                'total_students' => $totalStudents,
                'students' => $students ?? []
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get sections for a specific year level
     * GET /api/teachers/sections-by-year-level?year_level=Grade 1
     */
    public function api_get_sections_by_year_level()
    {
        api_set_json_headers();
        
        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $yearLevelName = $_GET['year_level'] ?? null;
            
            if (empty($yearLevelName)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameter: year_level'
                ]);
                return;
            }

            // Get year_level_id from year_levels table
            $yearLevel = $this->db->table('year_levels')
                ->where('name', $yearLevelName)
                ->get();
            
            if (!$yearLevel) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Year level not found: ' . $yearLevelName
                ]);
                return;
            }

            // Get sections for this year level through year_level_sections
            $sections = $this->db->raw("
                SELECT s.*, yls.year_level_id
                FROM sections s
                INNER JOIN year_level_sections yls ON s.id = yls.section_id
                WHERE yls.year_level_id = ?
                AND s.status = 'active'
                ORDER BY s.name ASC
            ", [$yearLevel['id']]);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'year_level' => $yearLevelName,
                'year_level_id' => $yearLevel['id'],
                'sections' => $sections ?? [],
                'count' => is_array($sections) ? count($sections) : 0
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    // ===== TEACHER ASSIGNMENT API METHODS =====

    /**
     * GET /api/teachers/advisers?school_year=2026-2027
     * Get all adviser assignments for a school year
     */
    public function api_get_advisers()
    {
        api_set_json_headers();

        // Load required models
        $this->call->model('TeacherAdviserAssignmentModel');

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $school_year = $_GET['school_year'] ?? null;

            if (!$school_year) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'school_year parameter is required']);
                return;
            }

            $advisers = $this->TeacherAdviserAssignmentModel->get_all_with_teacher(['school_year' => $school_year]);

            echo json_encode([
                'success' => true,
                'advisers' => $advisers,
                'count' => count($advisers)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/teachers/me/adviser-levels
     * Get adviser levels for the logged-in teacher (active school year)
     */
    public function api_get_my_adviser_levels()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'teacher') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Teacher only.']);
            return;
        }

        try {
            $userId = $this->session->userdata('user_id');
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing user id']);
                return;
            }

            $this->call->model('TeacherModel');
            $teacher = $this->TeacherModel->get_by_user_id($userId);
            if (!$teacher || empty($teacher['id'])) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Teacher not found']);
                return;
            }

            $this->call->model('AcademicPeriodModel');
            $period = $this->AcademicPeriodModel->get_active_period();
            $schoolYear = $period['school_year'] ?? null;
            if (!$schoolYear) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Active school year not found']);
                return;
            }

            $rows = $this->db->table('teacher_adviser_assignments')
                ->select('level')
                ->where('teacher_id', $teacher['id'])
                ->where('school_year', $schoolYear)
                ->get_all();

            $levels = [];
            if (is_array($rows)) {
                $levels = array_values(array_unique(array_filter(array_map(function ($row) {
                    return $row['level'] ?? null;
                }, $rows))));
            }

            echo json_encode([
                'success' => true,
                'levels' => $levels,
                'school_year' => $schoolYear
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/teachers/assignments?school_year=2026-2027
     * Get all subject assignments for a school year
     */
    public function api_get_assignments()
    {
        api_set_json_headers();

        // Load required models
        $this->call->model('TeacherSubjectAssignmentModel');

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $school_year = $_GET['school_year'] ?? null;

            if (!$school_year) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'school_year parameter is required']);
                return;
            }

            $assignments = $this->TeacherSubjectAssignmentModel->get_all_with_details(['school_year' => $school_year]);

            echo json_encode([
                'success' => true,
                'assignments' => $assignments,
                'count' => count($assignments)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/teachers/me/subjects
     * Get subjects assigned to the logged-in teacher
     */
    public function api_get_my_subjects()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        $this->call->model('TeacherModel');
        $this->call->model('TeacherSubjectAssignmentModel');
        $this->call->model('AcademicPeriodModel');

        try {
            $userId = $this->session->userdata('user_id');
            $teacher = $this->TeacherModel->get_by_user_id($userId);

            if (!$teacher || empty($teacher['id'])) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Teacher record not found']);
                return;
            }

            $schoolYear = $_GET['school_year'] ?? null;
            if (!$schoolYear) {
                $period = $this->AcademicPeriodModel->get_active_period();
                $schoolYear = $period['school_year'] ?? null;
            }

            $subjects = $this->TeacherSubjectAssignmentModel->get_teacher_subjects($teacher['id'], $schoolYear);

            echo json_encode([
                'success' => true,
                'subjects' => $subjects,
                'count' => count($subjects),
                'school_year' => $schoolYear
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/teachers/assign-adviser
     * Assign a teacher as adviser to a grade level
     * Payload: { teacher_id: int, level: string, school_year: string }
     */
    public function api_assign_adviser()
    {
        api_set_json_headers();

        // Load required models
        $this->call->model('TeacherAdviserAssignmentModel');

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true) ?? [];

            $teacher_id = $data['teacher_id'] ?? null;
            $level = $data['level'] ?? null;
            $school_year = $data['school_year'] ?? null;

            if (!$teacher_id || !$level || !$school_year) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'teacher_id, level, and school_year are required']);
                return;
            }

            $result = $this->TeacherAdviserAssignmentModel->create_assignment($teacher_id, $level, $school_year);

            if ($result['success']) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Adviser assignment created successfully',
                    'id' => $result['id']
                ]);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => $result['message']]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/teachers/assign-subject
     * Assign a teacher to teach a subject
     * Payload: { teacher_id: int, subject_id: int, school_year: string }
     */
    public function api_assign_subject()
    {
        api_set_json_headers();

        // Load required models
        $this->call->model('TeacherSubjectAssignmentModel');

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true) ?? [];

            $teacher_id = $data['teacher_id'] ?? null;
            $subject_id = $data['subject_id'] ?? null;
            $school_year = $data['school_year'] ?? null;

            if (!$teacher_id || !$subject_id || !$school_year) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'teacher_id, subject_id, and school_year are required']);
                return;
            }

            $result = $this->TeacherSubjectAssignmentModel->create_assignment($teacher_id, $subject_id, $school_year);

            if ($result['success']) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Subject assignment created successfully',
                    'id' => $result['id']
                ]);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => $result['message']]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/teachers/{id}/subjects?school_year=2026-2027
     * Get subjects assigned to a specific teacher
     */
    public function api_get_teacher_subjects($id)
    {
        api_set_json_headers();

        // Load required models
        $this->call->model('TeacherSubjectAssignmentModel');

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $teacher_id = $id;
            $school_year = $_GET['school_year'] ?? null;

            if (!$teacher_id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Teacher ID is required']);
                return;
            }

            $subjects = $this->TeacherSubjectAssignmentModel->get_teacher_subjects($teacher_id, $school_year);

            echo json_encode([
                'success' => true,
                'subjects' => $subjects,
                'count' => count($subjects)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/teachers/assignment
     * Remove a teacher assignment (adviser or subject)
     * Payload: { assignment_id: int, type: 'adviser'|'subject' }
     */
    public function api_remove_assignment()
    {
        api_set_json_headers();

        // Load required models
        $this->call->model('TeacherAdviserAssignmentModel');
        $this->call->model('TeacherSubjectAssignmentModel');

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true) ?? [];

            $assignment_id = $data['assignment_id'] ?? null;
            $type = $data['type'] ?? null;

            if (!$assignment_id || !$type) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'assignment_id and type are required']);
                return;
            }

            if (!in_array($type, ['adviser', 'subject'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'type must be either "adviser" or "subject"']);
                return;
            }

            if ($type === 'adviser') {
                $result = $this->TeacherAdviserAssignmentModel->remove_assignment($assignment_id);
            } else {
                $result = $this->TeacherSubjectAssignmentModel->remove_assignment($assignment_id);
            }

            if ($result) {
                echo json_encode([
                    'success' => true,
                    'message' => ucfirst($type) . ' assignment removed successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Assignment not found']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Public endpoint: return teacher info keyed by subject_id.
     * Used by students to resolve teacher names on their course list.
     * Queries teacher_subject_assignments → teachers → users.
     * GET /api/teacher-subject-assignments
     * Optional query params: subject_id (comma-separated list)
     */
    public function api_get_subject_teachers()
    {
        api_set_json_headers();

        try {
            $subjectIds = isset($_GET['subject_id'])
                ? array_filter(array_map('intval', explode(',', $_GET['subject_id'])))
                : [];

            $sql = "SELECT tsa.subject_id,
                           t.id   AS teacher_id,
                           u.first_name,
                           u.last_name,
                           u.email
                    FROM   teacher_subject_assignments tsa
                    JOIN   teachers t ON tsa.teacher_id = t.id
                    JOIN   users u    ON t.user_id = u.id";

            if (!empty($subjectIds)) {
                $placeholders = implode(',', array_fill(0, count($subjectIds), '?'));
                $sql .= " WHERE tsa.subject_id IN ($placeholders)";
                $stmt = $this->db->raw($sql, array_values($subjectIds));
            } else {
                $stmt = $this->db->raw($sql);
            }

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Build a map: subject_id → first teacher found
            $map = [];
            foreach ($rows as $row) {
                $sid = (int)$row['subject_id'];
                if (!isset($map[$sid])) {
                    $map[$sid] = [
                        'teacher_id' => (int)$row['teacher_id'],
                        'first_name' => $row['first_name'],
                        'last_name'  => $row['last_name'],
                        'email'      => $row['email'],
                    ];
                }
            }

            echo json_encode(['success' => true, 'teachers' => $map]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}

