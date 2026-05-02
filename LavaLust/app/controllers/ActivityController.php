<?php

/**
 * ActivityController - Manage activities and grades
 * Handles CRUD operations for activities and grade input/viewing for transparency
 */
class ActivityController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('ActivityModel');
        $this->call->model('AcademicPeriodModel');
    }

    /**
     * Get all activities for a course
     * GET /api/activities?course_id=6&section_id=1&type=assignment&academic_period_id=6&status=published
     */
    public function api_get_activities()
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
            $filters = [];
            
            if (!empty($_GET['course_id'])) {
                $filters['course_id'] = $_GET['course_id'];
            }
            if (!empty($_GET['section_id'])) {
                $filters['section_id'] = $_GET['section_id'];
            }
            if (!empty($_GET['type'])) {
                $filters['type'] = $_GET['type'];
            }
            if (!empty($_GET['academic_period_id'])) {
                $filters['academic_period_id'] = $_GET['academic_period_id'];
            }
            if (!empty($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }
            if (!empty($_GET['search'])) {
                $filters['search'] = $_GET['search'];
            }

            $activities = $this->ActivityModel->get_all($filters);

            // Enrich with grading stats and current period context
            if (is_array($activities)) {
                foreach ($activities as &$activity) {
                    $activity['grading_stats'] = $this->ActivityModel->get_grading_stats($activity['id']);
                }
            }

            // Include current academic period context
            $gradingContext = $this->AcademicPeriodModel->get_grading_context();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $activities,
                'count' => is_array($activities) ? count($activities) : 0,
                'grading_context' => $gradingContext
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
     * Get single activity by ID
     * GET /api/activities/{id}
     */
    public function api_get_activity($id)
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
            $activity = $this->ActivityModel->get_activity($id);

            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            // Enrich with grading stats
            $activity['grading_stats'] = $this->ActivityModel->get_grading_stats($activity['id']);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $activity
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
     * Create a new activity (teacher only)
     * POST /api/activities
     * Body: { course_id, title, type, academic_period_id?, max_score, due_at, section_id? }
     */
    public function api_create_activity()
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

        // Only teachers can create activities (adjust role check as needed)
        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: only teachers/admins can create activities'
            ]);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validation
            if (empty($data['course_id']) || empty($data['title']) || empty($data['type'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields: course_id, title, type'
                ]);
                return;
            }

            // Get current academic period if not provided
            $academicPeriodId = $data['academic_period_id'] ?? null;
            if (!$academicPeriodId) {
                $activePeriod = $this->AcademicPeriodModel->get_active_period();
                $academicPeriodId = $activePeriod ? $activePeriod['id'] : null;
            }

            // Prepare activity data
            $activityData = [
                'subject_id' => $data['course_id'], // Map course_id from request to subject_id in database
                'title' => $data['title'],
                'type' => $data['type'],
                'description' => $data['description'] ?? null,
                'academic_period_id' => $academicPeriodId,
                'max_score' => $data['max_score'] ?? 100,
                'due_at' => $data['due_at'] ?? null,
                'allow_late_submission' => isset($data['allow_late_submission']) ? (int)$data['allow_late_submission'] : 1,
                'section_id' => $data['section_id'] ?? null,
            ];

            $newId = $this->ActivityModel->create($activityData);

            if ($newId) {
                $activity = $this->ActivityModel->get_activity($newId);
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Activity created successfully',
                    'data' => $activity
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create activity'
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
     * Update activity (teacher only)
     * PUT /api/activities/{id}
     */
    public function api_update_activity($id)
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

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: only teachers/admins can update activities'
            ]);
            return;
        }

        try {
            $activity = $this->ActivityModel->get_activity($id);
            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            $data = json_decode(file_get_contents('php://input'), true);
            $updateData = [];

            // Only allow certain fields to be updated
            if (!empty($data['title'])) $updateData['title'] = $data['title'];
            if (!empty($data['type'])) $updateData['type'] = $data['type'];
            if (isset($data['description'])) $updateData['description'] = $data['description'];
            if (isset($data['academic_period_id'])) $updateData['academic_period_id'] = $data['academic_period_id'];
            if (isset($data['max_score'])) $updateData['max_score'] = $data['max_score'];
            if (isset($data['due_at'])) $updateData['due_at'] = $data['due_at'];
            if (isset($data['allow_late_submission'])) $updateData['allow_late_submission'] = (int)$data['allow_late_submission'];

            $result = $this->ActivityModel->update($id, $updateData);

            if ($result) {
                if (isset($updateData['due_at']) && in_array($activity['type'], ['quiz', 'exam'])) {
                    $existingSettings = $this->db->table('activity_settings')
                        ->where('activity_id', $id)
                        ->get();
                    if ($existingSettings) {
                        $this->db->table('activity_settings')
                            ->where('activity_id', $id)
                            ->update([
                                'available_until' => $updateData['due_at'],
                                'updated_at' => app_now()
                            ]);
                    }
                }

                $updated = $this->ActivityModel->get_activity($id);
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Activity updated successfully',
                    'data' => $updated
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update activity'
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
     * Delete activity (teacher/admin only)
     * DELETE /api/activities/{id}
     */
    public function api_delete_activity($id)
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

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden'
            ]);
            return;
        }

        try {
            $activity = $this->ActivityModel->get_activity($id);
            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            $result = $this->ActivityModel->delete($id);

            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Activity deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete activity'
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
     * Get grades for an activity (all students)
     * GET /api/activities/{id}/grades
     */
    public function api_get_activity_grades($activityId)
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
            $grades = $this->db->table('activity_grades')
                               ->where('activity_id', $activityId)
                               ->get_all();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $grades,
                'count' => is_array($grades) ? count($grades) : 0
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
     * Generic query for activity_grades
     * GET /api/activity-grades?activity_id=123&student_id=45
     * Returns grade rows filtered by activity_id and/or student_id
     */
    public function api_get_activity_grades_by_params()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $activityId = isset($_GET['activity_id']) ? (int)$_GET['activity_id'] : null;
            $studentId = isset($_GET['student_id']) ? (int)$_GET['student_id'] : null;

            if (!$activityId && !$studentId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'At least one filter required: activity_id or student_id']);
                return;
            }

            $sql = "SELECT * FROM activity_grades WHERE 1=1";
            $params = [];

            if ($activityId) {
                $sql .= " AND activity_id = ?";
                $params[] = $activityId;
            }
            if ($studentId) {
                $sql .= " AND student_id = ?";
                $params[] = $studentId;
            }

            $sql .= " ORDER BY id DESC";

            $stmt = $this->db->raw($sql, $params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $rows, 'count' => is_array($rows) ? count($rows) : 0]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Input / Update grade for a student on an activity (teacher only)
     * POST /api/activities/{id}/grades
     * Body: { student_id, grade, status }
     */
    public function api_set_grade($activityId)
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

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: only teachers/admins can input grades'
            ]);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validation
            if (empty($data['student_id'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required field: student_id'
                ]);
                return;
            }

            // Check if grade record exists
            $existing = $this->db->table('activity_grades')
                                 ->where('activity_id', $activityId)
                                 ->where('student_id', $data['student_id'])
                                 ->get();

            $gradeData = [
                'grade' => $data['grade'] ?? null,
                'status' => $data['status'] ?? 'Pending',
                'updated_at' => app_now(),
            ];

            if ($existing) {
                // Update existing record
                $result = $this->db->table('activity_grades')
                                   ->where('activity_id', $activityId)
                                   ->where('student_id', $data['student_id'])
                                   ->update($gradeData);

                if ($result) {
                    $updated = $this->db->table('activity_grades')
                                        ->where('activity_id', $activityId)
                                        ->where('student_id', $data['student_id'])
                                        ->get();
                    http_response_code(200);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Grade updated successfully',
                        'data' => $updated
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to update grade'
                    ]);
                }
            } else {
                // Create new record
                $gradeData['activity_id'] = $activityId;
                $gradeData['student_id'] = $data['student_id'];
                $gradeData['created_at'] = app_now();

                $result = $this->db->table('activity_grades')
                                   ->insert($gradeData);

                if ($result) {
                    $created = $this->db->table('activity_grades')
                                        ->where('activity_id', $activityId)
                                        ->where('student_id', $data['student_id'])
                                        ->get();
                    http_response_code(201);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Grade created successfully',
                        'data' => $created
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to create grade'
                    ]);
                }
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
     * Export class record to CSV
     * GET /api/activities/export-class-record?course_id=6&section_id=1&academic_period_id=21
     */
    public function api_export_class_record()
    {
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
            // Load helper
            $this->call->helper('classrecord');
            
            // Get parameters
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $academicPeriodId = $_GET['academic_period_id'] ?? null;

            if (!$courseId || !$sectionId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: course_id and section_id'
                ]);
                return;
            }

            // Get course info with teacher name
            $course = $this->db->table('teacher_subjects ts')
                ->select('s.course_code, s.course_name, s.year_level, u.first_name as teacher_first_name, u.last_name as teacher_last_name')
                ->join('subjects s', 's.id = ts.subject_id')
                ->join('teachers t', 't.id = ts.teacher_id')
                ->join('users u', 'u.id = t.user_id')
                ->where('ts.id', $courseId)
                ->get();

            if (!$course) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Course not found'
                ]);
                return;
            }

            // Get section info
            $section = $this->db->table('sections')
                ->where('id', $sectionId)
                ->get();

            if (!$section) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Section not found'
                ]);
                return;
            }

            // Get academic period info
            $periodInfo = '';
            if ($academicPeriodId) {
                $period = $this->db->table('academic_periods')
                    ->where('id', $academicPeriodId)
                    ->get();
                if ($period) {
                    $periodInfo = $period['school_year'] . ' - ' . $period['semester'] . ' (' . $period['period_type'] . ')';
                }
            }

            // Get activities
            $activityFilters = [
                'course_id' => $courseId,
                'section_id' => $sectionId
            ];
            if ($academicPeriodId) {
                $activityFilters['academic_period_id'] = $academicPeriodId;
            }
            $activities = $this->ActivityModel->get_all($activityFilters);

            // Categorize activities
            $written = [];
            $performance = [];
            $exam = [];
            foreach ($activities as $act) {
                $type = strtolower($act['type'] ?? '');
                if (in_array($type, ['quiz', 'assignment', 'other'])) {
                    $written[] = $act;
                } elseif (in_array($type, ['project', 'laboratory', 'performance'])) {
                    $performance[] = $act;
                } elseif ($type === 'exam') {
                    $exam[] = $act;
                }
            }

            // Get students with grades
            $yearLevel = $course['year_level'] ?? null;
            $studentsQuery = $this->db->table('students st')
                ->select('st.id, st.student_id, u.first_name, u.last_name, u.email')
                ->join('users u', 'u.id = st.user_id')
                ->where('st.section_id', $sectionId);
            
            if ($yearLevel) {
                $studentsQuery->where('st.year_level', $yearLevel);
            }
            
            $students = $studentsQuery->get_all();

            // Get all grades for these students and activities
            $activityIds = array_column($activities, 'id');
            $studentIds = array_column($students, 'id');
            
            $grades = [];
            if (!empty($activityIds) && !empty($studentIds)) {
                // Build IN clauses manually since LavaLust doesn't have where_in()
                $activityPlaceholders = implode(',', array_fill(0, count($activityIds), '?'));
                $studentPlaceholders = implode(',', array_fill(0, count($studentIds), '?'));
                
                $query = "SELECT * FROM activity_grades 
                          WHERE activity_id IN ($activityPlaceholders) 
                          AND student_id IN ($studentPlaceholders)";
                
                $bindValues = array_merge($activityIds, $studentIds);
                $gradesData = $this->db->raw($query, $bindValues)->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($gradesData as $grade) {
                    $key = $grade['student_id'] . '_' . $grade['activity_id'];
                    $grades[$key] = $grade['grade'];
                }
            }

            // Build student rows data
            $studentRows = [];
            
            // Calculate max scores
            $writtenMax = array_sum(array_column($written, 'max_score'));
            $performanceMax = array_sum(array_column($performance, 'max_score'));
            $examMax = array_sum(array_column($exam, 'max_score'));

            foreach ($students as $idx => $student) {
                $row = [
                    $idx + 1,
                    $student['student_id'],
                    trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
                ];

                // Written Works
                $writtenTotal = 0;
                foreach ($written as $act) {
                    $key = $student['id'] . '_' . $act['id'];
                    $grade = $grades[$key] ?? 0;
                    $writtenTotal += $grade;
                    $row[] = $grade;
                }
                $row[] = $writtenTotal;
                $row[] = $writtenMax > 0 ? round(($writtenTotal / $writtenMax) * 100, 2) : 0;
                $row[] = $writtenMax > 0 ? round(($writtenTotal / $writtenMax) * 30, 2) : 0;

                // Performance Tasks
                $performanceTotal = 0;
                foreach ($performance as $act) {
                    $key = $student['id'] . '_' . $act['id'];
                    $grade = $grades[$key] ?? 0;
                    $performanceTotal += $grade;
                    $row[] = $grade;
                }
                $row[] = $performanceTotal;
                $row[] = $performanceMax > 0 ? round(($performanceTotal / $performanceMax) * 100, 2) : 0;
                $row[] = $performanceMax > 0 ? round(($performanceTotal / $performanceMax) * 40, 2) : 0;

                // Exam
                $examTotal = 0;
                foreach ($exam as $act) {
                    $key = $student['id'] . '_' . $act['id'];
                    $grade = $grades[$key] ?? 0;
                    $examTotal += $grade;
                }
                if (!empty($exam)) {
                    $row[] = $examTotal;
                    $row[] = $examMax > 0 ? round(($examTotal / $examMax) * 100, 2) : 0;
                    $row[] = $examMax > 0 ? round(($examTotal / $examMax) * 30, 2) : 0;
                }

                // Final Grade
                $writtenWS = $writtenMax > 0 ? ($writtenTotal / $writtenMax) * 30 : 0;
                $performanceWS = $performanceMax > 0 ? ($performanceTotal / $performanceMax) * 40 : 0;
                $examWS = $examMax > 0 ? ($examTotal / $examMax) * 30 : 0;
                $initialGrade = $writtenWS + $performanceWS + $examWS;
                
                $row[] = round($initialGrade, 2);
                $row[] = $this->transmute($initialGrade);

                $studentRows[] = $row;
            }

            // Prepare data for helper
            $courseInfo = [
                'course_code' => $course['course_code'] ?? '',
                'course_name' => $course['course_name'] ?? '',
                'teacher_name' => trim(($course['teacher_first_name'] ?? '') . ' ' . ($course['teacher_last_name'] ?? '')),
                'section_name' => $section['name'] ?? 'N/A',
                'period_info' => $periodInfo
            ];

            $categorizedActivities = [
                'written' => $written,
                'performance' => $performance,
                'exam' => $exam
            ];

            // Generate filename
            $courseCode = $course['course_code'] ?? 'Course';
            $sectionName = $section['name'] ?? 'Section';
            $timestamp = date('Ymd_His');
            $filename = "ClassRecord_{$courseCode}_{$sectionName}_{$timestamp}.csv";

            // Call helper to export CSV (this will exit)
            export_class_record_csv($courseInfo, $studentRows, $categorizedActivities, $filename);

        } catch (Exception $e) {
            // Log the error for debugging
            error_log('Export class record error: ' . $e->getMessage());
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Export failed: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Export class record to Excel with styling and formulas
     * GET /api/activities/export-class-record-excel?course_id=6&section_id=1&academic_period_id=21
     */
    public function api_export_class_record_excel()
    {
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
            // Load helper
            $this->call->helper('classrecord_excel');
            
            // Get parameters
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $academicPeriodId = $_GET['academic_period_id'] ?? null;

            if (!$courseId || !$sectionId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: course_id and section_id'
                ]);
                return;
            }

            // Get course info with teacher name
            $course = $this->db->table('teacher_subjects ts')
                ->select('s.course_code, s.course_name, s.year_level, u.first_name as teacher_first_name, u.last_name as teacher_last_name')
                ->join('subjects s', 's.id = ts.subject_id')
                ->join('teachers t', 't.id = ts.teacher_id')
                ->join('users u', 'u.id = t.user_id')
                ->where('ts.id', $courseId)
                ->get();

            if (!$course) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Course not found'
                ]);
                return;
            }

            // Get section info
            $section = $this->db->table('sections')
                ->where('id', $sectionId)
                ->get();

            if (!$section) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Section not found'
                ]);
                return;
            }

            // Get academic period info
            $periodInfo = '';
            if ($academicPeriodId) {
                $period = $this->db->table('academic_periods')
                    ->where('id', $academicPeriodId)
                    ->get();
                if ($period) {
                    $periodInfo = $period['school_year'] . ' - ' . $period['semester'] . ' (' . $period['period_type'] . ')';
                }
            }

            // Get activities
            $activityFilters = [
                'course_id' => $courseId,
                'section_id' => $sectionId
            ];
            if ($academicPeriodId) {
                $activityFilters['academic_period_id'] = $academicPeriodId;
            }
            $activities = $this->ActivityModel->get_all($activityFilters);

            // Categorize activities
            $written = [];
            $performance = [];
            $exam = [];
            foreach ($activities as $act) {
                $type = strtolower($act['type'] ?? '');
                if (in_array($type, ['quiz', 'assignment', 'other'])) {
                    $written[] = $act;
                } elseif (in_array($type, ['project', 'laboratory', 'performance'])) {
                    $performance[] = $act;
                } elseif ($type === 'exam') {
                    $exam[] = $act;
                }
            }

            // Get students
            $yearLevel = $course['year_level'] ?? null;
            $studentsQuery = $this->db->table('students st')
                ->select('st.id, st.student_id, u.first_name, u.last_name, u.email')
                ->join('users u', 'u.id = st.user_id')
                ->where('st.section_id', $sectionId);
            
            if ($yearLevel) {
                $studentsQuery->where('st.year_level', $yearLevel);
            }
            
            $students = $studentsQuery->get_all();

            // Get all grades
            $activityIds = array_column($activities, 'id');
            $studentIds = array_column($students, 'id');
            
            $grades = [];
            if (!empty($activityIds) && !empty($studentIds)) {
                $activityPlaceholders = implode(',', array_fill(0, count($activityIds), '?'));
                $studentPlaceholders = implode(',', array_fill(0, count($studentIds), '?'));
                
                $query = "SELECT * FROM activity_grades 
                          WHERE activity_id IN ($activityPlaceholders) 
                          AND student_id IN ($studentPlaceholders)";
                
                $bindValues = array_merge($activityIds, $studentIds);
                $gradesData = $this->db->raw($query, $bindValues)->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($gradesData as $grade) {
                    $key = $grade['student_id'] . '_' . $grade['activity_id'];
                    $grades[$key] = $grade['grade'];
                }
            }

            // Prepare data for helper
            $courseInfo = [
                'course_code' => $course['course_code'] ?? '',
                'course_name' => $course['course_name'] ?? '',
                'teacher_name' => trim(($course['teacher_first_name'] ?? '') . ' ' . ($course['teacher_last_name'] ?? '')),
                'section_name' => $section['name'] ?? 'N/A',
                'period_info' => $periodInfo
            ];

            $categorizedActivities = [
                'written' => $written,
                'performance' => $performance,
                'exam' => $exam
            ];

            // Generate filename
            $courseCode = $course['course_code'] ?? 'Course';
            $sectionName = $section['name'] ?? 'Section';
            $timestamp = date('Ymd_His');
            $filename = "ClassRecord_{$courseCode}_{$sectionName}_{$timestamp}.xlsx";

            // Call helper to export Excel (this will exit)
            export_class_record_excel($courseInfo, $students, $categorizedActivities, $grades, $filename);

        } catch (Exception $e) {
            // Log the error for debugging
            error_log('Export class record Excel error: ' . $e->getMessage());
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Export failed: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Transmute percentage to grade equivalent
     */
    private function transmute($percentage)
    {
        if ($percentage >= 97) return "1.00";
        if ($percentage >= 94) return "1.25";
        if ($percentage >= 91) return "1.50";
        if ($percentage >= 88) return "1.75";
        if ($percentage >= 85) return "2.00";
        if ($percentage >= 82) return "2.25";
        if ($percentage >= 79) return "2.50";
        if ($percentage >= 76) return "2.75";
        if ($percentage >= 75) return "3.00";
        return "5.00";
    }

    /**
     * OPTIMIZED: Get activities with grades for a specific student
     * GET /api/activities/student-grades?course_id=6&section_id=1&student_id=32
     * 
     * Returns activities with the student's grade embedded in each activity
     * This eliminates N+1 query problem by using a single JOIN query
     */
    public function api_get_student_activities_with_grades()
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
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $studentId = $_GET['student_id'] ?? null;

            if (!$courseId || !$studentId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: course_id and student_id'
                ]);
                return;
            }

            // Build query with LEFT JOIN to get activities and student's grades in one query
            // Note: Using raw query to ensure proper SQL syntax with LEFT JOIN
            $studentIdInt = (int)$studentId;
            $courseIdInt = (int)$courseId;
            
                $sql = "SELECT a.*, ag.grade as student_grade, ag.status as grade_status, ag.id as grade_id, ag.created_at as grade_created_at 
                    FROM activities a 
                    LEFT JOIN activity_grades ag ON a.id = ag.activity_id AND ag.student_id = ? 
                    WHERE a.subject_id = ?";
            
            $params = [$studentIdInt, $courseIdInt];
            
            if ($sectionId) {
                $sql .= " AND a.section_id = ?";
                $params[] = (int)$sectionId;
            }

            // Optional filters
            if (!empty($_GET['type'])) {
                $sql .= " AND a.type = ?";
                $params[] = $_GET['type'];
            }
            if (!empty($_GET['academic_period_id'])) {
                $sql .= " AND a.academic_period_id = ?";
                $params[] = (int)$_GET['academic_period_id'];
            }

            $sql .= " ORDER BY a.due_at ASC";

            // Execute raw query - LavaLust's raw() method returns PDOStatement
            $stmt = $this->db->raw($sql, $params);
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Transform the result to match expected frontend format
            $result = [];
            if (is_array($activities)) {
                foreach ($activities as $activity) {
                    $result[] = [
                        'id' => $activity['id'],
                        'subject_id' => $activity['subject_id'],
                        'academic_period_id' => $activity['academic_period_id'],
                        'title' => $activity['title'],
                        'description' => $activity['description'] ?? '',
                        'type' => $activity['type'],
                        'max_score' => $activity['max_score'],
                        'due_at' => $activity['due_at'],
                        'allow_late_submission' => $activity['allow_late_submission'],
                        'section_id' => $activity['section_id'],
                        'created_at' => $activity['created_at'],
                        // Student's grade info (null if not graded yet)
                        'student_grade' => $activity['student_grade'],
                        'grade_status' => $activity['grade_status'] ?? 'Pending',
                        'grade_id' => $activity['grade_id'],
                        'grade_created_at' => $activity['grade_created_at'] ?? null,
                        // Grading stats (optional, can be added if needed)
                        'grading_stats' => $this->ActivityModel->get_grading_stats($activity['id'])
                    ];
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result)
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
     * OPTIMIZED: Get teacher's activities with graded counts (single request)
     * GET /api/teacher/activities/with-grades
     * 
     * Returns activities for the logged-in teacher's courses with graded_count 
     * This eliminates N+1 query problem for Activities page by counting grades in one batch query
     */
    public function api_get_teacher_activities_with_graded_counts()
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
            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');

            // Get teacher's courses
            if ($userRole === 'admin') {
                // Admins see all activities
                $sql = "SELECT DISTINCT a.* FROM activities a ORDER BY a.due_at DESC";
                $stmt = $this->db->raw($sql, []);
                $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                // Teachers see only their assigned courses
                $sql = "SELECT DISTINCT a.* FROM activities a 
                        INNER JOIN teacher_subjects ts ON a.course_id = ts.id 
                        INNER JOIN teachers t ON ts.teacher_id = t.id 
                        WHERE t.user_id = ? 
                        ORDER BY a.due_at DESC";
                $stmt = $this->db->raw($sql, [(int)$userId]);
                $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            if (empty($activities)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'count' => 0
                ]);
                return;
            }

            // Extract activity IDs
            $activityIds = array_column($activities, 'id');

            // Count graded entries (WHERE grade IS NOT NULL) for each activity in a single query
            $placeholders = implode(',', array_fill(0, count($activityIds), '?'));
            $countSql = "SELECT activity_id, COUNT(*) as graded_count 
                        FROM activity_grades 
                        WHERE activity_id IN ($placeholders) AND grade IS NOT NULL 
                        GROUP BY activity_id";
            $countStmt = $this->db->raw($countSql, $activityIds);
            $gradedCounts = $countStmt->fetchAll(PDO::FETCH_ASSOC);

            // Build a map of activity_id => graded_count
            $gradedMap = [];
            foreach ($gradedCounts as $row) {
                $gradedMap[$row['activity_id']] = (int)$row['graded_count'];
            }

            // Enrich activities with graded_count
            $result = [];
            foreach ($activities as $activity) {
                $activity['graded_count'] = $gradedMap[$activity['id']] ?? 0;
                $result[] = $activity;
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result)
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
     * OPTIMIZED: Get activities for a specific course with grading stats (single request)
     * GET /api/activities/course/with-stats?course_id=6&section_id=1&academic_period_id=20&year_level=1
     * 
     * Returns activities for a specific course with graded_count and total student count
     * This eliminates N+1 query problem for CourseManagement page
     */
    public function api_get_course_activities_with_stats()
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
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $academicPeriodId = $_GET['academic_period_id'] ?? null;
            $yearLevel = $_GET['year_level'] ?? null;

            if (empty($courseId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'course_id is required'
                ]);
                return;
            }

            // Build activities query with filters
            $conditions = ['a.subject_id = ?'];
            $params = [(int)$courseId];

            if (!empty($sectionId)) {
                $conditions[] = 'a.section_id = ?';
                $params[] = (int)$sectionId;
            }
            if (!empty($academicPeriodId)) {
                $conditions[] = 'a.academic_period_id = ?';
                $params[] = (int)$academicPeriodId;
            }

            $whereClause = implode(' AND ', $conditions);
            $sql = "SELECT a.* FROM activities a WHERE $whereClause ORDER BY a.due_at DESC";
            $stmt = $this->db->raw($sql, $params);
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($activities)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'count' => 0
                ]);
                return;
            }

            // Count total students for this section/year_level
            $studentParams = [];
            $studentConditions = [];
            
            if (!empty($sectionId)) {
                $studentConditions[] = 's.section_id = ?';
                $studentParams[] = (int)$sectionId;
            }
            if (!empty($yearLevel)) {
                $studentConditions[] = 's.year_level = ?';
                $studentParams[] = (int)$yearLevel;
            }

            $totalStudents = 0;
            if (!empty($studentConditions)) {
                $studentWhere = implode(' AND ', $studentConditions);
                $studentSql = "SELECT COUNT(*) as total FROM students s WHERE $studentWhere";
                $studentStmt = $this->db->raw($studentSql, $studentParams);
                $studentResult = $studentStmt->fetch(PDO::FETCH_ASSOC);
                $totalStudents = (int)($studentResult['total'] ?? 0);
            }

            // Extract activity IDs for batch grade count query
            $activityIds = array_column($activities, 'id');

            // Count graded entries (WHERE grade IS NOT NULL) for each activity in a single query
            $placeholders = implode(',', array_fill(0, count($activityIds), '?'));
            $countSql = "SELECT activity_id, COUNT(*) as graded_count 
                        FROM activity_grades 
                        WHERE activity_id IN ($placeholders) AND grade IS NOT NULL 
                        GROUP BY activity_id";
            $countStmt = $this->db->raw($countSql, $activityIds);
            $gradedCounts = $countStmt->fetchAll(PDO::FETCH_ASSOC);

            // Build a map of activity_id => graded_count
            $gradedMap = [];
            foreach ($gradedCounts as $row) {
                $gradedMap[$row['activity_id']] = (int)$row['graded_count'];
            }

            // Enrich activities with grading_stats
            $result = [];
            foreach ($activities as $activity) {
                $graded = $gradedMap[$activity['id']] ?? 0;
                $pending = max($totalStudents - $graded, 0);
                $percentage = $totalStudents > 0 ? round(($graded / $totalStudents) * 100) : 0;

                $activity['graded_count'] = $graded;
                $activity['grading_stats'] = [
                    'total' => $totalStudents,
                    'graded' => $graded,
                    'pending' => $pending,
                    'percentage_graded' => $percentage
                ];
                $result[] = $activity;
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result),
                'total_students' => $totalStudents
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
     * OPTIMIZED: Get all activities with grades for a student (across all enrolled courses)
     * GET /api/activities/student-all?student_id=93
     * 
     * Returns all activities for all courses the student is enrolled in, with grades embedded
     * This eliminates N+1 query problem for MyActivities page
     */
    public function api_get_all_student_activities_with_grades()
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
            $studentId = $_GET['student_id'] ?? null;

            if (!$studentId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameter: student_id'
                ]);
                return;
            }

            $studentIdInt = (int)$studentId;

            // Get student to retrieve section_id. Accept either students.id or user_id (fallback).
            $studentSql = "SELECT * FROM students WHERE id = ?";
            $studentStmt = $this->db->raw($studentSql, [$studentIdInt]);
            $student = $studentStmt->fetch(PDO::FETCH_ASSOC);

            // If not found by students.id, try lookup by user_id (some callers pass user_id)
            if (!$student) {
                $studentSql2 = "SELECT * FROM students WHERE user_id = ?";
                $studentStmt2 = $this->db->raw($studentSql2, [$studentIdInt]);
                $student = $studentStmt2->fetch(PDO::FETCH_ASSOC);
            }

            if (!$student) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student not found'
                ]);
                return;
            }

            $sectionId = $student['section_id'];

            // Determine the student's courses from teacher assignments for the student's section.
            // Use teacher_subject_sections -> teacher_subjects -> subjects to find subject_ids for the section.
            $taSql = "SELECT ts.subject_id, s.course_code, s.course_name 
                      FROM teacher_subject_sections tss 
                      INNER JOIN teacher_subjects ts ON tss.teacher_subject_id = ts.id 
                      INNER JOIN subjects s ON ts.subject_id = s.id 
                      WHERE tss.section_id = ?";
            $taStmt = $this->db->raw($taSql, [(int)$sectionId]);
            $teacherAssignments = $taStmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($teacherAssignments)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'count' => 0
                ]);
                return;
            }

            // Build list of course IDs (subject IDs)
            $courseIds = array_map(function($ta) {
                return (int)$ta['subject_id'];
            }, $teacherAssignments);

            // Create a map of subject_id -> course_code for display
            $courseNameMap = [];
            foreach ($teacherAssignments as $ta) {
                $courseNameMap[$ta['subject_id']] = $ta['course_code'];
            }

            // Build SQL with IN clause to get all activities for enrolled courses
            $placeholders = implode(',', array_fill(0, count($courseIds), '?'));
            
                $sql = "SELECT a.*, ag.grade as student_grade, ag.status as grade_status, ag.id as grade_id, ag.created_at as grade_created_at 
                    FROM activities a 
                    LEFT JOIN activity_grades ag ON a.id = ag.activity_id AND ag.student_id = ? 
                    WHERE a.course_id IN ($placeholders) AND a.section_id = ?";
            
            $params = array_merge([$studentIdInt], $courseIds, [(int)$sectionId]);

            // Optional filters
            if (!empty($_GET['type'])) {
                $sql .= " AND a.type = ?";
                $params[] = $_GET['type'];
            }
            if (!empty($_GET['academic_period_id'])) {
                $sql .= " AND a.academic_period_id = ?";
                $params[] = (int)$_GET['academic_period_id'];
            }

            $sql .= " ORDER BY a.due_at DESC";

            // Execute raw query
            $stmt = $this->db->raw($sql, $params);
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Transform the result to match expected frontend format
            $result = [];
            if (is_array($activities)) {
                foreach ($activities as $activity) {
                    $result[] = [
                        'id' => $activity['id'],
                        'course_id' => $activity['course_id'],
                        'course_name' => $courseNameMap[$activity['course_id']] ?? 'N/A',
                        'academic_period_id' => $activity['academic_period_id'],
                        'title' => $activity['title'],
                        'type' => $activity['type'],
                        'max_score' => $activity['max_score'],
                        'due_at' => $activity['due_at'],
                        'section_id' => $activity['section_id'],
                        'created_at' => $activity['created_at'],
                        // Student's grade info (null if not graded yet)
                        'student_grade' => $activity['student_grade'],
                        'grade_status' => $activity['grade_status'] ?? 'Pending',
                        'grade_id' => $activity['grade_id'],
                        'grade_created_at' => $activity['grade_created_at'] ?? null
                    ];
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result)
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
     * Import class record from Excel file
     * POST /api/activities/import-class-record
     * FormData: file (Excel file), course_id, section_id, academic_period_id (optional)
     */
    public function api_import_class_record()
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

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: only teachers/admins can import grades'
            ]);
            return;
        }

        try {
            // Check if file is uploaded
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No file uploaded or upload error'
                ]);
                return;
            }

            // Get parameters
            $courseId = $_POST['course_id'] ?? null;
            $sectionId = $_POST['section_id'] ?? null;
            $academicPeriodId = $_POST['academic_period_id'] ?? null;

            if (!$courseId || !$sectionId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: course_id and section_id'
                ]);
                return;
            }

            // Validate file type
            $fileInfo = pathinfo($_FILES['file']['name']);
            $extension = strtolower($fileInfo['extension'] ?? '');
            
            if (!in_array($extension, ['xlsx', 'xls'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid file type. Only .xlsx and .xls files are allowed.'
                ]);
                return;
            }

            // Load PhpSpreadsheet
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($_FILES['file']['tmp_name']);
            $sheet = $spreadsheet->getActiveSheet();
            $highestRow = $sheet->getHighestRow();
            $highestCol = $sheet->getHighestColumn();
            $highestColIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);

            // Get activities for this course/section to map columns
            $activityFilters = [
                'course_id' => $courseId,
                'section_id' => $sectionId
            ];
            if ($academicPeriodId) {
                $activityFilters['academic_period_id'] = $academicPeriodId;
            }
            $activities = $this->ActivityModel->get_all($activityFilters);

            // Categorize activities
            $written = [];
            $performance = [];
            $exam = [];
            foreach ($activities as $act) {
                $type = strtolower($act['type'] ?? '');
                if (in_array($type, ['quiz', 'assignment', 'other'])) {
                    $written[] = $act;
                } elseif (in_array($type, ['project', 'laboratory', 'performance'])) {
                    $performance[] = $act;
                } elseif ($type === 'exam') {
                    $exam[] = $act;
                }
            }

            // Find header row (look for "No", "Student ID", "Name" pattern)
            $headerRow = 0;
            for ($row = 1; $row <= min($highestRow, 20); $row++) {
                $cellA = strtolower(trim($sheet->getCell('A' . $row)->getValue() ?? ''));
                $cellB = strtolower(trim($sheet->getCell('B' . $row)->getValue() ?? ''));
                $cellC = strtolower(trim($sheet->getCell('C' . $row)->getValue() ?? ''));
                
                if (($cellA === 'no' || $cellA === '#') && 
                    (strpos($cellB, 'student') !== false || strpos($cellB, 'id') !== false) && 
                    (strpos($cellC, 'name') !== false)) {
                    $headerRow = $row;
                    break;
                }
            }

            if ($headerRow === 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Could not find header row. Expected columns: No, Student ID, Name'
                ]);
                return;
            }

            // Skip HPS row if present (row after header)
            $dataStartRow = $headerRow + 1;
            $hpsCheck = strtolower(trim($sheet->getCell('B' . $dataStartRow)->getValue() ?? ''));
            if (strpos($hpsCheck, 'hps') !== false) {
                $dataStartRow++;
            }

            // Add debug info for row detection
            $debugInfo['header_row'] = $headerRow;
            $debugInfo['data_start_row'] = $dataStartRow;
            $debugInfo['highest_row'] = $highestRow;
            $debugInfo['written_count'] = count($written);
            $debugInfo['performance_count'] = count($performance);
            $debugInfo['exam_count'] = count($exam);

            // Map column positions based on header
            // Structure: No, Student ID, Name, [Written W1..Wn, Total, PS, WS], [Performance P1..Pn, Total, PS, WS], [Exam, PS, WS], Initial, Final
            
            // Build column map for activity grades
            $activityColumnMap = []; // activity_id => column_index
            $currentCol = 4; // Start after No, Student ID, Name (columns 1,2,3)
            
            // Written Works columns
            foreach ($written as $act) {
                $activityColumnMap[$act['id']] = $currentCol;
                $debugInfo['column_map'][] = [
                    'activity_id' => $act['id'],
                    'activity_name' => $act['title'],
                    'column_index' => $currentCol,
                    'column_letter' => \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($currentCol)
                ];
                $currentCol++;
            }
            $currentCol += 3; // Skip Total, PS, WS
            
            // Performance Tasks columns
            foreach ($performance as $act) {
                $activityColumnMap[$act['id']] = $currentCol;
                $debugInfo['column_map'][] = [
                    'activity_id' => $act['id'],
                    'activity_name' => $act['title'],
                    'column_index' => $currentCol,
                    'column_letter' => \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($currentCol)
                ];
                $currentCol++;
            }
            $currentCol += 3; // Skip Total, PS, WS
            
            // Exam columns
            if (!empty($exam)) {
                // For exam, we need to handle it differently since there's just one "Score" column
                // The exam score goes to all exam activities proportionally, or to the first one
                $examScoreCol = $currentCol;
                $currentCol += 3; // Skip Score, PS, WS
            }

            // Get student ID map (student_id code -> database id)
            $yearLevel = null;
            $course = $this->db->table('teacher_subjects ts')
                ->select('s.year_level')
                ->join('subjects s', 's.id = ts.subject_id')
                ->where('ts.id', $courseId)
                ->get();
            if ($course) {
                $yearLevel = $course['year_level'];
            }

            $studentsQuery = $this->db->table('students st')
                ->select('st.id, st.student_id')
                ->where('st.section_id', $sectionId);
            
            if ($yearLevel) {
                $studentsQuery->where('st.year_level', $yearLevel);
            }
            
            $studentsData = $studentsQuery->get_all();
            
            $studentIdMap = []; // student_id (code) => database id
            foreach ($studentsData as $st) {
                $studentIdMap[$st['student_id']] = $st['id'];
            }

            // Process data rows
            $inserted = 0;
            $updated = 0;
            $skipped = 0;
            $errors = [];
            $processedStudents = [];
            $debugInfo = [];

            for ($row = $dataStartRow; $row <= $highestRow; $row++) {
                $studentIdCode = trim($sheet->getCell('B' . $row)->getValue() ?? '');
                
                // Skip empty rows
                if (empty($studentIdCode)) {
                    continue;
                }

                // Find student database ID
                $studentDbId = $studentIdMap[$studentIdCode] ?? null;
                
                if (!$studentDbId) {
                    $errors[] = "Row {$row}: Student ID '{$studentIdCode}' not found in database";
                    continue;
                }

                $processedStudents[] = $studentIdCode;

                // Debug: Log first 3 students' data
                if (count($processedStudents) <= 3) {
                    $studentDebug = [
                        'row' => $row,
                        'student_id' => $studentIdCode,
                        'db_id' => $studentDbId,
                        'grades_read' => []
                    ];
                }

                // Process each activity grade
                foreach ($activityColumnMap as $activityId => $colIndex) {
                    $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex);
                    $cell = $sheet->getCell($colLetter . $row);
                    
                    // Get calculated value (handles formulas)
                    $cellValue = $cell->getCalculatedValue();
                    
                    // Debug first 3 students
                    if (count($processedStudents) <= 3) {
                        $studentDebug['grades_read'][] = [
                            'activity_id' => $activityId,
                            'column' => $colLetter,
                            'raw_value' => $cellValue
                        ];
                    }
                    
                    // Handle formula results
                    if ($cellValue === null || $cellValue === '' || $cellValue === '-') {
                        continue;
                    }

                    // Parse grade value - convert to integer since DB column is int
                    $grade = is_numeric($cellValue) ? intval(round(floatval($cellValue))) : null;
                    
                    if ($grade === null) {
                        continue;
                    }

                    // Check if grade record exists
                    $existingQuery = "SELECT * FROM activity_grades WHERE activity_id = ? AND student_id = ? LIMIT 1";
                    $existingStmt = $this->db->raw($existingQuery, [$activityId, $studentDbId]);
                    $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

                    if ($existing) {
                        // Update if grade changed (integer comparison)
                        $existingGrade = intval($existing['grade'] ?? 0);
                        if ($existingGrade !== $grade) {
                            $updateQuery = "UPDATE activity_grades SET grade = ?, updated_at = ? WHERE activity_id = ? AND student_id = ?";
                            $updateStmt = $this->db->raw($updateQuery, [$grade, app_now(), $activityId, $studentDbId]);
                            $affectedRows = $updateStmt->rowCount();
                            if ($affectedRows > 0) {
                                $updated++;
                                // Debug: Log the update
                                if (count($processedStudents) <= 3) {
                                    $debugInfo['updates'][] = [
                                        'student' => $studentIdCode,
                                        'activity_id' => $activityId,
                                        'old_grade' => $existingGrade,
                                        'new_grade' => $grade,
                                        'affected_rows' => $affectedRows,
                                        'query' => $updateQuery,
                                        'params' => [$grade, app_now(), $activityId, $studentDbId]
                                    ];
                                }
                            } else {
                                // Debug: Log failed update
                                if (count($processedStudents) <= 3) {
                                    $debugInfo['failed_updates'][] = [
                                        'student' => $studentIdCode,
                                        'activity_id' => $activityId,
                                        'old_grade' => $existingGrade,
                                        'new_grade' => $grade,
                                        'affected_rows' => $affectedRows
                                    ];
                                }
                            }
                        } else {
                            $skipped++;
                        }
                    } else {
                        // Insert new record
                        $insertQuery = "INSERT INTO activity_grades (activity_id, student_id, grade, created_at, updated_at) VALUES (?, ?, ?, ?, ?)";
                        $now = app_now();
                        $insertStmt = $this->db->raw($insertQuery, [$activityId, $studentDbId, $grade, $now, $now]);
                        if ($insertStmt) {
                            $inserted++;
                        }
                    }
                }

                // Store student debug info
                if (count($processedStudents) <= 3) {
                    $debugInfo['students'][] = $studentDebug;
                }

                // Handle exam scores if present
                if (!empty($exam) && isset($examScoreCol)) {
                    $examCell = $sheet->getCell(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($examScoreCol) . $row);
                    $examValue = $examCell->getCalculatedValue();
                    
                    if ($examValue !== null && $examValue !== '' && $examValue !== '-' && is_numeric($examValue)) {
                        $examGrade = floatval($examValue);
                        $totalExamMax = array_sum(array_column($exam, 'max_score'));
                        
                        // Distribute exam score proportionally across all exam activities
                        foreach ($exam as $examAct) {
                            $proportion = $totalExamMax > 0 ? ($examAct['max_score'] / $totalExamMax) : 1;
                            $actGrade = intval(round($examGrade * $proportion));
                            
                            $existing = $this->db->table('activity_grades')
                                ->where('activity_id', $examAct['id'])
                                ->where('student_id', $studentDbId)
                                ->get();

                            $gradeData = [
                                'grade' => $actGrade,
                                'updated_at' => app_now(),
                            ];

                            if ($existing) {
                                $existingExamGrade = intval($existing['grade'] ?? 0);
                                if ($existingExamGrade !== $actGrade) {
                                    $result = $this->db->table('activity_grades')
                                        ->where('activity_id', $examAct['id'])
                                        ->where('student_id', $studentDbId)
                                        ->update($gradeData);
                                    if ($result) {
                                        $updated++;
                                    }
                                } else {
                                    $skipped++;
                                }
                            } else {
                                $gradeData['activity_id'] = $examAct['id'];
                                $gradeData['student_id'] = $studentDbId;
                                $gradeData['created_at'] = app_now();

                                $result = $this->db->table('activity_grades')->insert($gradeData);
                                if ($result) {
                                    $inserted++;
                                }
                            }
                        }
                    }
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Import completed successfully',
                'inserted' => $inserted,
                'updated' => $updated,
                'skipped' => $skipped,
                'processed_students' => count($processedStudents),
                'total_activities' => count($activityColumnMap),
                'errors' => $errors,
                'debug' => $debugInfo
            ]);

        } catch (Exception $e) {
            error_log('Import class record error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Import failed: ' . $e->getMessage()
            ]);
        }
    }

    private function map_component_from_activity_type($type)
    {
        $t = strtolower(trim((string)$type));
        if (in_array($t, ['quiz', 'worksheet', 'assignment', 'other'])) return 'written';
        if (in_array($t, ['project', 'laboratory', 'performance', 'art', 'storytime', 'recitation', 'participation'])) return 'performance';
        if ($t === 'exam') return 'quarterly';
        return 'written'; // safe fallback
    }

    private function is_teacher_or_admin()
    {
        $role = $this->session->userdata('role');
        return $role === 'teacher' || $role === 'admin';
    }

    /**
     * Sync LMS activities into hybrid grading_input_items as source_type=activity
     * POST /api/grading-inputs/sync-lms
     */
    public function api_sync_grading_inputs_from_lms()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }
        if (!$this->is_teacher_or_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $courseId = (int)($data['course_id'] ?? 0);
            $sectionId = (int)($data['section_id'] ?? 0);
            $periodId = (int)($data['academic_period_id'] ?? 0);
            $quarter = isset($data['quarter']) ? trim((string)$data['quarter']) : null;

            if ($courseId <= 0 || $sectionId <= 0 || $periodId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'course_id, section_id, academic_period_id are required']);
                return;
            }

            $activitiesStmt = $this->db->raw(
                "SELECT id, title, type, max_score
                 FROM activities
                 WHERE subject_id = ? AND section_id = ? AND academic_period_id = ?
                 ORDER BY created_at ASC, id ASC",
                [$courseId, $sectionId, $periodId]
            );
            $activities = $activitiesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $inserted = 0;
            $updated = 0;
            $order = 1;
            $now = app_now();
            $userId = (int)($this->session->userdata('user_id') ?? 0);

            foreach ($activities as $activity) {
                $activityId = (int)$activity['id'];
                $existingStmt = $this->db->raw(
                    "SELECT id, component
                     FROM grading_input_items
                     WHERE source_type = 'activity'
                       AND source_activity_id = ?
                       AND subject_id = ?
                       AND section_id = ?
                       AND academic_period_id = ?
                     LIMIT 1",
                    [$activityId, $courseId, $sectionId, $periodId]
                );
                $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

                if ($existing) {
                    // Keep teacher-assigned component override; sync title/max/order only
                    $this->db->raw(
                        "UPDATE grading_input_items
                         SET title = ?, max_score = ?, display_order = ?, updated_at = ?
                         WHERE id = ?",
                        [
                            (string)$activity['title'],
                            (float)($activity['max_score'] ?? 0),
                            $order,
                            $now,
                            (int)$existing['id']
                        ]
                    );
                    $updated++;
                } else {
                    $this->db->raw(
                        "INSERT INTO grading_input_items
                            (subject_id, section_id, academic_period_id, quarter, title, component, max_score, source_type, source_activity_id, merge_strategy, display_order, is_active, created_by, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'activity', ?, 'sum', ?, 1, ?, ?, ?)",
                        [
                            $courseId,
                            $sectionId,
                            $periodId,
                            $quarter,
                            (string)$activity['title'],
                            $this->map_component_from_activity_type($activity['type'] ?? ''),
                            (float)($activity['max_score'] ?? 0),
                            $activityId,
                            $order,
                            $userId > 0 ? $userId : null,
                            $now,
                            $now,
                        ]
                    );
                    $inserted++;
                }

                $order++;
            }

            echo json_encode([
                'success' => true,
                'message' => 'LMS grading inputs synced',
                'inserted' => $inserted,
                'updated' => $updated,
                'count' => count($activities)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Sync failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Get hybrid grading input items and non-activity scores
     * GET /api/grading-inputs?course_id=&section_id=&academic_period_id=&quarter=
     */
    public function api_get_grading_inputs()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $courseId = (int)($_GET['course_id'] ?? 0);
            $sectionId = (int)($_GET['section_id'] ?? 0);
            $periodId = (int)($_GET['academic_period_id'] ?? 0);
            $quarter = isset($_GET['quarter']) ? trim((string)$_GET['quarter']) : null;

            if ($courseId <= 0 || $sectionId <= 0 || $periodId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'course_id, section_id, academic_period_id are required']);
                return;
            }

            $params = [$courseId, $sectionId, $periodId];
            $quarterSql = '';
            if ($quarter !== null && $quarter !== '') {
                $quarterSql = ' AND (quarter = ? OR quarter IS NULL OR quarter = \'\')';
                $params[] = $quarter;
            }

            $itemsStmt = $this->db->raw(
                "SELECT id, subject_id, section_id, academic_period_id, quarter, title, component, max_score, source_type, source_activity_id, merge_strategy, display_order, is_active
                 FROM grading_input_items
                 WHERE subject_id = ? AND section_id = ? AND academic_period_id = ? AND is_active = 1" . $quarterSql . "
                 ORDER BY component ASC, display_order ASC, id ASC",
                $params
            );
            $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $itemIds = array_map(function ($row) { return (int)$row['id']; }, $items);

            $scores = [];
            $manualScoreMap = [];
            if (!empty($itemIds)) {
                $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
                $scoreStmt = $this->db->raw(
                    "SELECT grading_input_item_id, student_id, score
                     FROM grading_input_scores
                     WHERE grading_input_item_id IN ($placeholders)",
                    $itemIds
                );
                $scoreRows = $scoreStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($scoreRows as $row) {
                    $iid = (int)$row['grading_input_item_id'];
                    $sid = (int)$row['student_id'];
                    $score = is_null($row['score']) ? null : (float)$row['score'];
                    $scores[] = ['item_id' => $iid, 'student_id' => $sid, 'score' => $score, 'source' => 'manual'];
                    if (!isset($manualScoreMap[$iid])) $manualScoreMap[$iid] = [];
                    $manualScoreMap[$iid][$sid] = $score;
                }
            }

            // Also load scores for inactive source items referenced by active merged items
            // so that merged score computation can sum them correctly
            $mergedItemsForSrc = array_values(array_filter($items, function ($item) {
                return ($item['source_type'] ?? '') === 'merged';
            }));
            $hiddenSourceItems = [];
            if (!empty($mergedItemsForSrc)) {
                $mergedIdsForSrc = array_map(fn($r) => (int)$r['id'], $mergedItemsForSrc);
                $mSrcPlaceholders = implode(',', array_fill(0, count($mergedIdsForSrc), '?'));
                $preSrcStmt = $this->db->raw(
                    "SELECT source_item_id FROM grading_input_item_sources
                     WHERE grading_input_item_id IN ($mSrcPlaceholders) AND source_item_id IS NOT NULL",
                    $mergedIdsForSrc
                );
                $preSrcRows = $preSrcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $inactiveSourceItemIds = array_values(array_unique(
                    array_filter(
                        array_map(fn($r) => (int)$r['source_item_id'], $preSrcRows),
                        fn($id) => $id > 0 && !in_array($id, $itemIds)
                    )
                ));
                if (!empty($inactiveSourceItemIds)) {
                    // Fetch the inactive source item metadata so frontend can map id → field
                    $iSrcPlaceholders = implode(',', array_fill(0, count($inactiveSourceItemIds), '?'));
                    $iSrcItemsStmt = $this->db->raw(
                        "SELECT id, subject_id, section_id, academic_period_id, quarter, title, component, max_score, source_type, source_activity_id, merge_strategy, display_order, is_active
                         FROM grading_input_items WHERE id IN ($iSrcPlaceholders)",
                        $inactiveSourceItemIds
                    );
                    $fetchedHiddenItems = $iSrcItemsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    foreach ($fetchedHiddenItems as &$hi) {
                        $hi['is_hidden'] = true; // signal to frontend: don't render as column
                    }
                    unset($hi);
                    $hiddenSourceItems = $fetchedHiddenItems;

                    // Fetch their scores so merged computation works
                    $iSrcScorePlaceholders = implode(',', array_fill(0, count($inactiveSourceItemIds), '?'));
                    $iSrcScoreStmt = $this->db->raw(
                        "SELECT grading_input_item_id, student_id, score
                         FROM grading_input_scores WHERE grading_input_item_id IN ($iSrcScorePlaceholders)",
                        $inactiveSourceItemIds
                    );
                    $iSrcScoreRows = $iSrcScoreStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    foreach ($iSrcScoreRows as $row) {
                        $iid = (int)$row['grading_input_item_id'];
                        $sid = (int)$row['student_id'];
                        $score = is_null($row['score']) ? null : (float)$row['score'];
                        if (!isset($manualScoreMap[$iid])) $manualScoreMap[$iid] = [];
                        $manualScoreMap[$iid][$sid] = $score;
                        // Also add to scores payload for frontend row hydration
                        $scores[] = ['item_id' => $iid, 'student_id' => $sid, 'score' => $score, 'source' => 'hidden_source'];
                    }
                }
            }

            // Load merged item sources + compute merged scores per student
            $mergedItems = array_values(array_filter($items, function ($item) {
                return ($item['source_type'] ?? '') === 'merged';
            }));

            if (!empty($mergedItems)) {
                $mergedIds = array_map(function ($row) { return (int)$row['id']; }, $mergedItems);
                $mPlaceholders = implode(',', array_fill(0, count($mergedIds), '?'));

                $srcStmt = $this->db->raw(
                    "SELECT grading_input_item_id, source_type, source_activity_id, source_item_id, weight
                     FROM grading_input_item_sources
                     WHERE grading_input_item_id IN ($mPlaceholders)
                     ORDER BY id ASC",
                    $mergedIds
                );
                $srcRows = $srcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $sourceByItem = [];
                foreach ($srcRows as $src) {
                    $iid = (int)$src['grading_input_item_id'];
                    if (!isset($sourceByItem[$iid])) $sourceByItem[$iid] = [];
                    $sourceByItem[$iid][] = $src;
                }

                // Expose merge_sources on main items payload (for edit UI)
                foreach ($items as &$baseItem) {
                    if (($baseItem['source_type'] ?? '') === 'merged') {
                        $baseItemId = (int)($baseItem['id'] ?? 0);
                        $baseItem['merge_sources'] = $sourceByItem[$baseItemId] ?? [];
                    }
                }
                unset($baseItem);

                // Activity scores map for source_type=activity
                $activityIds = [];
                foreach ($srcRows as $src) {
                    if (($src['source_type'] ?? '') === 'activity' && !empty($src['source_activity_id'])) {
                        $activityIds[] = (int)$src['source_activity_id'];
                    }
                }
                $activityIds = array_values(array_unique($activityIds));
                $activityScoreMap = [];
                if (!empty($activityIds)) {
                    $aPlaceholders = implode(',', array_fill(0, count($activityIds), '?'));
                    $aStmt = $this->db->raw(
                        "SELECT activity_id, student_id, grade
                         FROM activity_grades
                         WHERE activity_id IN ($aPlaceholders)",
                        $activityIds
                    );
                    $aRows = $aStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    foreach ($aRows as $ar) {
                        $aid = (int)$ar['activity_id'];
                        $sid = (int)$ar['student_id'];
                        if (!isset($activityScoreMap[$aid])) $activityScoreMap[$aid] = [];
                        $activityScoreMap[$aid][$sid] = is_null($ar['grade']) ? null : (float)$ar['grade'];
                    }
                }

                // Compute for all students in section
                $studentsStmt = $this->db->raw(
                    "SELECT DISTINCT id
                     FROM students
                     WHERE section_id = ?",
                    [$sectionId]
                );
                $studentIds = array_map(function ($r) { return (int)$r['id']; }, $studentsStmt->fetchAll(PDO::FETCH_ASSOC) ?: []);

                foreach ($mergedItems as &$item) {
                    $iid = (int)$item['id'];
                    $itemSources = $sourceByItem[$iid] ?? [];
                    $item['merge_sources'] = $itemSources;

                    foreach ($studentIds as $studentId) {
                        $sum = 0.0;
                        $count = 0;

                        foreach ($itemSources as $src) {
                            $weight = (float)($src['weight'] ?? 1);
                            $srcType = $src['source_type'] ?? '';
                            $sourceScore = null;

                            if ($srcType === 'activity') {
                                $aid = (int)($src['source_activity_id'] ?? 0);
                                $sourceScore = $activityScoreMap[$aid][$studentId] ?? null;
                            } elseif ($srcType === 'manual') {
                                $mid = (int)($src['source_item_id'] ?? 0);
                                $sourceScore = $manualScoreMap[$mid][$studentId] ?? null;
                            }

                            if ($sourceScore !== null) {
                                $sum += ((float)$sourceScore * $weight);
                                $count++;
                            }
                        }

                        $mergeStrategy = strtolower((string)($item['merge_strategy'] ?? 'sum'));
                        $computed = ($mergeStrategy === 'average' && $count > 0) ? ($sum / $count) : $sum;
                        $computed = round($computed, 2);

                        $scores[] = ['item_id' => $iid, 'student_id' => $studentId, 'score' => $computed, 'source' => 'merged'];
                    }
                }
                unset($item);
            }

            echo json_encode([
                'success' => true,
                'items' => $items,
                'hidden_source_items' => $hiddenSourceItems,
                'scores' => $scores,
                'count' => count($items)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to fetch grading inputs: ' . $e->getMessage()]);
        }
    }

    /**
     * Create hybrid grading input item
     * POST /api/grading-inputs
     */
    public function api_create_grading_input()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }
        if (!$this->is_teacher_or_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];

            $courseId = (int)($data['course_id'] ?? 0);
            $sectionId = (int)($data['section_id'] ?? 0);
            $periodId = (int)($data['academic_period_id'] ?? 0);
            $title = trim((string)($data['title'] ?? ''));
            $component = strtolower(trim((string)($data['component'] ?? 'written')));
            $maxScore = (float)($data['max_score'] ?? 0);
            $sourceType = strtolower(trim((string)($data['source_type'] ?? 'manual')));
            $sourceActivityId = isset($data['source_activity_id']) ? (int)$data['source_activity_id'] : null;
            $quarter = isset($data['quarter']) ? trim((string)$data['quarter']) : null;
            $mergeStrategy = strtolower(trim((string)($data['merge_strategy'] ?? 'sum')));
            $displayOrder = (int)($data['display_order'] ?? 0);

            if ($courseId <= 0 || $sectionId <= 0 || $periodId <= 0 || $title === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'course_id, section_id, academic_period_id, title are required']);
                return;
            }
            if (!in_array($component, ['written', 'performance', 'quarterly'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid component']);
                return;
            }
            if (!in_array($sourceType, ['activity', 'manual', 'merged'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid source_type']);
                return;
            }

            $now = app_now();
            $userId = (int)($this->session->userdata('user_id') ?? 0);

            $itemId = (int)$this->db->table('grading_input_items')->insert([
                'subject_id' => $courseId,
                'section_id' => $sectionId,
                'academic_period_id' => $periodId,
                'quarter' => $quarter,
                'title' => $title,
                'component' => $component,
                'max_score' => $maxScore,
                'source_type' => $sourceType,
                'source_activity_id' => $sourceActivityId,
                'merge_strategy' => $mergeStrategy,
                'display_order' => $displayOrder,
                'is_active' => 1,
                'created_by' => $userId > 0 ? $userId : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if ($sourceType === 'merged' && !empty($data['merge_sources']) && is_array($data['merge_sources'])) {
                $sourceItemIdsToDeactivate = [];
                foreach ($data['merge_sources'] as $src) {
                    $srcType = strtolower(trim((string)($src['source_type'] ?? '')));
                    $srcActivityId = isset($src['source_activity_id']) ? (int)$src['source_activity_id'] : null;
                    $srcItemId = isset($src['source_item_id']) ? (int)$src['source_item_id'] : null;
                    $weight = (float)($src['weight'] ?? 1);
                    if (!in_array($srcType, ['activity', 'manual'], true)) continue;

                    $this->db->table('grading_input_item_sources')->insert([
                        'grading_input_item_id' => $itemId,
                        'source_type' => $srcType,
                        'source_activity_id' => $srcActivityId,
                        'source_item_id' => $srcItemId,
                        'weight' => $weight,
                        'created_at' => $now,
                    ]);

                    // Track which grading_input_items to deactivate (hide from grid)
                    if ($srcItemId > 0) {
                        $sourceItemIdsToDeactivate[] = $srcItemId;
                    }
                }

                // Deactivate source items so they are hidden and not double-counted
                if (!empty($sourceItemIdsToDeactivate)) {
                    $deactivatePlaceholders = implode(',', array_fill(0, count($sourceItemIdsToDeactivate), '?'));
                    $deactivateParams = array_merge($sourceItemIdsToDeactivate, [$now]);
                    $this->db->raw(
                        "UPDATE grading_input_items SET is_active = 0, updated_at = ? WHERE id IN ($deactivatePlaceholders)",
                        array_merge([$now], $sourceItemIdsToDeactivate)
                    );
                }
            }

            echo json_encode([
                'success' => true,
                'message' => 'Grading input created',
                'id' => $itemId
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Create failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Update hybrid grading input item
     * PUT /api/grading-inputs/{id}
     */
    public function api_update_grading_input($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }
        if (!$this->is_teacher_or_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $itemId = (int)$id;
            $data = json_decode(file_get_contents('php://input'), true) ?: [];

            $existingStmt = $this->db->raw("SELECT * FROM grading_input_items WHERE id = ? LIMIT 1", [$itemId]);
            $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Grading input not found']);
                return;
            }

            $title = isset($data['title']) ? trim((string)$data['title']) : $existing['title'];
            $component = isset($data['component']) ? strtolower(trim((string)$data['component'])) : $existing['component'];
            $maxScore = isset($data['max_score']) ? (float)$data['max_score'] : (float)$existing['max_score'];
            $displayOrder = isset($data['display_order']) ? (int)$data['display_order'] : (int)$existing['display_order'];
            $quarter = array_key_exists('quarter', $data) ? (is_null($data['quarter']) ? null : trim((string)$data['quarter'])) : $existing['quarter'];
            $isActive = isset($data['is_active']) ? ((int)$data['is_active'] ? 1 : 0) : (int)$existing['is_active'];
            $mergeStrategy = isset($data['merge_strategy']) ? strtolower(trim((string)$data['merge_strategy'])) : (string)($existing['merge_strategy'] ?? 'sum');

            if (!in_array($component, ['written', 'performance', 'quarterly'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid component']);
                return;
            }

            $this->db->raw(
                "UPDATE grading_input_items
                 SET title = ?, component = ?, max_score = ?, merge_strategy = ?, display_order = ?, quarter = ?, is_active = ?, updated_at = ?
                 WHERE id = ?",
                [$title, $component, $maxScore, $mergeStrategy, $displayOrder, $quarter, $isActive, app_now(), $itemId]
            );

            if (($existing['source_type'] ?? '') === 'merged' && isset($data['merge_sources']) && is_array($data['merge_sources'])) {
                $now = app_now();

                // Re-activate items that were previously sources of this merge (before replacing)
                $oldSrcStmt = $this->db->raw(
                    "SELECT source_item_id FROM grading_input_item_sources WHERE grading_input_item_id = ? AND source_item_id IS NOT NULL",
                    [$itemId]
                );
                $oldSrcRows = $oldSrcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $oldSourceItemIds = array_filter(array_map(fn($r) => (int)$r['source_item_id'], $oldSrcRows));
                if (!empty($oldSourceItemIds)) {
                    $rePlaceholders = implode(',', array_fill(0, count($oldSourceItemIds), '?'));
                    $this->db->raw(
                        "UPDATE grading_input_items SET is_active = 1, updated_at = ? WHERE id IN ($rePlaceholders)",
                        array_merge([$now], array_values($oldSourceItemIds))
                    );
                }

                // Replace source rows
                $this->db->raw("DELETE FROM grading_input_item_sources WHERE grading_input_item_id = ?", [$itemId]);

                $newSourceItemIds = [];
                foreach ($data['merge_sources'] as $src) {
                    $srcType = strtolower(trim((string)($src['source_type'] ?? '')));
                    $srcActivityId = isset($src['source_activity_id']) ? (int)$src['source_activity_id'] : null;
                    $srcItemId = isset($src['source_item_id']) ? (int)$src['source_item_id'] : null;
                    $weight = (float)($src['weight'] ?? 1);
                    if (!in_array($srcType, ['activity', 'manual'], true)) continue;
                    $this->db->table('grading_input_item_sources')->insert([
                        'grading_input_item_id' => $itemId,
                        'source_type' => $srcType,
                        'source_activity_id' => $srcActivityId,
                        'source_item_id' => $srcItemId,
                        'weight' => $weight,
                        'created_at' => $now,
                    ]);
                    if ($srcItemId > 0) {
                        $newSourceItemIds[] = $srcItemId;
                    }
                }

                // Deactivate the new source items
                if (!empty($newSourceItemIds)) {
                    $newPlaceholders = implode(',', array_fill(0, count($newSourceItemIds), '?'));
                    $this->db->raw(
                        "UPDATE grading_input_items SET is_active = 0, updated_at = ? WHERE id IN ($newPlaceholders)",
                        array_merge([$now], $newSourceItemIds)
                    );
                }
            }

            echo json_encode(['success' => true, 'message' => 'Grading input updated']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Update failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Soft-delete grading input item
     * DELETE /api/grading-inputs/{id}
     */
    public function api_delete_grading_input($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }
        if (!$this->is_teacher_or_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $itemId = (int)$id;
            $now = app_now();

            // If this is a merged item, re-activate its source items before removing it
            $deletingItemStmt = $this->db->raw(
                "SELECT source_type FROM grading_input_items WHERE id = ? LIMIT 1",
                [$itemId]
            );
            $deletingItem = $deletingItemStmt->fetch(PDO::FETCH_ASSOC);
            if ($deletingItem && ($deletingItem['source_type'] ?? '') === 'merged') {
                $srcStmt = $this->db->raw(
                    "SELECT source_item_id FROM grading_input_item_sources WHERE grading_input_item_id = ? AND source_item_id IS NOT NULL",
                    [$itemId]
                );
                $srcRows = $srcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $restoreIds = array_filter(array_map(fn($r) => (int)$r['source_item_id'], $srcRows));
                if (!empty($restoreIds)) {
                    $restorePlaceholders = implode(',', array_fill(0, count($restoreIds), '?'));
                    $this->db->raw(
                        "UPDATE grading_input_items SET is_active = 1, updated_at = ? WHERE id IN ($restorePlaceholders)",
                        array_merge([$now], array_values($restoreIds))
                    );
                }
            }

            $this->db->raw(
                "UPDATE grading_input_items SET is_active = 0, updated_at = ? WHERE id = ?",
                [$now, $itemId]
            );
            echo json_encode(['success' => true, 'message' => 'Grading input deleted']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Delete failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Upsert score for non-activity grading input
     * POST /api/grading-inputs/{id}/score
     */
    public function api_set_grading_input_score($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }
        if (!$this->is_teacher_or_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $itemId = (int)$id;
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $studentId = (int)($data['student_id'] ?? 0);
            $score = isset($data['score']) ? (float)$data['score'] : null;

            if ($studentId <= 0 || $score === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'student_id and score are required']);
                return;
            }

            $itemStmt = $this->db->raw("SELECT id, source_type, max_score FROM grading_input_items WHERE id = ? AND is_active = 1 LIMIT 1", [$itemId]);
            $item = $itemStmt->fetch(PDO::FETCH_ASSOC);
            if (!$item) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Grading input item not found']);
                return;
            }
            if (($item['source_type'] ?? '') === 'merged') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Merged columns are computed and cannot be edited directly']);
                return;
            }

            $maxScore = (float)($item['max_score'] ?? 0);
            $score = max(0, $score);
            if ($maxScore > 0) $score = min($score, $maxScore);

            $existingStmt = $this->db->raw(
                "SELECT id FROM grading_input_scores WHERE grading_input_item_id = ? AND student_id = ? LIMIT 1",
                [$itemId, $studentId]
            );
            $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $this->db->raw(
                    "UPDATE grading_input_scores SET score = ?, updated_at = ? WHERE id = ?",
                    [$score, app_now(), (int)$existing['id']]
                );
            } else {
                $now = app_now();
                $this->db->raw(
                    "INSERT INTO grading_input_scores (grading_input_item_id, student_id, score, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?)",
                    [$itemId, $studentId, $score, $now, $now]
                );
            }

            echo json_encode(['success' => true, 'message' => 'Grading input score saved', 'score' => $score]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Score save failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Bulk fetch activity grades + manual grading input scores for the student sidebar.
     * Single request replaces N individual grade lookups.
     * GET /api/activities/student-sidebar-grades
     *   ?student_id=MCAF2025-0253   (student_code OR numeric students.id)
     *   &course_id=51
     *   &section_id=11
     *   &academic_period_id=30      (optional)
     */
    public function api_get_student_sidebar_grades()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $rawStudentId = $_GET['student_id'] ?? null;
            $courseId     = isset($_GET['course_id'])  ? (int)$_GET['course_id']  : 0;
            $sectionId    = isset($_GET['section_id']) ? (int)$_GET['section_id'] : 0;
            $periodId     = isset($_GET['academic_period_id']) ? (int)$_GET['academic_period_id'] : 0;

            if (!$rawStudentId || !$courseId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'student_id and course_id are required']);
                return;
            }

            // Resolve numeric students.id — accept both student_code and numeric PK
            $studentIdInt = (int)$rawStudentId;
            if ($studentIdInt === 0 || !ctype_digit(ltrim((string)$rawStudentId, ' '))) {
                // It's a student_code string like "MCAF2025-0253"
                $stRow = $this->db->raw(
                    "SELECT id FROM students WHERE student_id = ? LIMIT 1",
                    [$rawStudentId]
                )->fetch(PDO::FETCH_ASSOC);
                if ($stRow) {
                    $studentIdInt = (int)$stRow['id'];
                } else {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Student not found']);
                    return;
                }
            }

            // ------------------------------------------------------------------
            // 1. Activity grades (LMS activities via activity_grades table)
            // ------------------------------------------------------------------
            $actSql = "SELECT a.id, a.title, a.type, a.max_score, a.academic_period_id, a.due_at,
                              ag.grade  AS student_grade,
                              ag.status AS grade_status,
                              ag.id     AS grade_id
                       FROM activities a
                       LEFT JOIN activity_grades ag
                              ON a.id = ag.activity_id AND ag.student_id = ?
                       WHERE a.subject_id = ?";
            $actParams = [$studentIdInt, $courseId];

            if ($sectionId) {
                $actSql .= " AND a.section_id = ?";
                $actParams[] = $sectionId;
            }
            if ($periodId) {
                $actSql .= " AND a.academic_period_id = ?";
                $actParams[] = $periodId;
            }
            $actSql .= " ORDER BY a.created_at ASC";

            $actRows = $this->db->raw($actSql, $actParams)->fetchAll(PDO::FETCH_ASSOC);

            $activityGrades   = [];
            $gradedActivityCount = 0;
            foreach ($actRows as $row) {
                $graded = ($row['student_grade'] !== null);
                if ($graded) $gradedActivityCount++;
                $activityGrades[] = [
                    'id'            => (int)$row['id'],
                    'title'         => $row['title'],
                    'type'          => $row['type'],
                    'max_score'     => (float)$row['max_score'],
                    'due_at'        => $row['due_at'],
                    'student_grade' => $graded ? (float)$row['student_grade'] : null,
                    'grade_status'  => $row['grade_status'] ?? null,
                    'source'        => 'activity',
                ];
            }

            // ------------------------------------------------------------------
            // 2. Manual / merged grading input scores
            // ------------------------------------------------------------------
            $giSql = "SELECT gi.id, gi.title, gi.source_type, gi.component, gi.max_score,
                             gi.academic_period_id,
                             gs.score AS student_grade,
                             gs.id    AS score_id
                      FROM grading_input_items gi
                      LEFT JOIN grading_input_scores gs
                             ON gi.id = gs.grading_input_item_id AND gs.student_id = ?
                      WHERE gi.subject_id = ?
                        AND gi.is_active  = 1
                        AND gi.source_type IN ('manual', 'merged')";
            $giParams = [$studentIdInt, $courseId];

            if ($sectionId) {
                $giSql .= " AND gi.section_id = ?";
                $giParams[] = $sectionId;
            }
            if ($periodId) {
                $giSql .= " AND gi.academic_period_id = ?";
                $giParams[] = $periodId;
            }
            $giSql .= " ORDER BY gi.created_at ASC";

            $giRows = $this->db->raw($giSql, $giParams)->fetchAll(PDO::FETCH_ASSOC);

            $manualGrades      = [];
            $gradedManualCount = 0;
            foreach ($giRows as $row) {
                $graded = ($row['student_grade'] !== null);
                if ($graded) $gradedManualCount++;
                $manualGrades[] = [
                    'id'            => (int)$row['id'],
                    'title'         => $row['title'],
                    'source_type'   => $row['source_type'],
                    'component'     => $row['component'],
                    'max_score'     => (float)$row['max_score'],
                    'student_grade' => $graded ? (float)$row['student_grade'] : null,
                    'source'        => 'manual_input',
                ];
            }

            // ------------------------------------------------------------------
            // 3. Summary statistics
            // ------------------------------------------------------------------
            $totalActivities = count($activityGrades);
            $totalManual     = count($manualGrades);
            $gradedTotal     = $gradedActivityCount + $gradedManualCount;
            $totalItems      = $totalActivities + $totalManual;

            // Weighted average percentage across all graded items
            $sumScores    = 0;
            $sumMaxScores = 0;
            foreach (array_merge($activityGrades, $manualGrades) as $g) {
                if ($g['student_grade'] !== null && $g['max_score'] > 0) {
                    $sumScores    += $g['student_grade'];
                    $sumMaxScores += $g['max_score'];
                }
            }
            $averagePercent = $sumMaxScores > 0 ? round(($sumScores / $sumMaxScores) * 100, 1) : null;

            http_response_code(200);
            echo json_encode([
                'success'        => true,
                'summary'        => [
                    'total_activities'  => $totalActivities,
                    'graded_activities' => $gradedActivityCount,
                    'total_items'       => $totalItems,
                    'graded_total'      => $gradedTotal,
                    'average_percent'   => $averagePercent,
                ],
                'activity_grades' => $activityGrades,
                'manual_grades'   => $manualGrades,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get activity submissions (for file upload activities)
     * GET /api/activities/{id}/submissions
     */
    public function api_get_submissions($activityId)
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
            // Get activity details
            $activity = $this->db->table('activities')
                ->where('id', $activityId)
                ->get();

            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            // Get students for this course/section
            $students = [];
            if ($activity['section_id']) {
                // Get students from section (students table has section_id column)
                // Names are in users table, joined by user_id
                $students = $this->db->table('students')
                    ->select('students.id, students.student_id, users.first_name, users.last_name, users.email')
                    ->join('users', 'users.id = students.user_id')
                    ->where('students.section_id', $activity['section_id'])
                    ->get_all();
            } else {
                // Get all students enrolled in the course
                $students = $this->db->table('students')
                    ->select('students.id, students.student_id, users.first_name, users.last_name, users.email')
                    ->join('users', 'users.id = students.user_id')
                    ->join('student_subjects', 'student_subjects.student_id = students.id')
                    ->where('student_subjects.subject_id', $activity['course_id'])
                    ->get_all();
            }

            // Get submissions for this activity
            $submissions = $this->db->table('activity_submissions')
                ->where('activity_id', $activityId)
                ->get_all();

            // Get grades for this activity
            $grades = $this->db->table('activity_grades')
                ->where('activity_id', $activityId)
                ->get_all();

            // Create maps by student_id
            $submissionMap = [];
            foreach ($submissions as $sub) {
                $submissionMap[$sub['student_id']] = $sub;
                
                // Get files for this submission
                $files = $this->db->table('activity_submission_files')
                    ->where('submission_id', $sub['id'])
                    ->get_all();
                
                $submissionMap[$sub['student_id']]['files'] = $files;
            }

            $gradeMap = [];
            foreach ($grades as $grade) {
                $gradeMap[$grade['student_id']] = $grade;
            }

            // Build response with all students and their submission status
            $result = [];
            foreach ($students as $student) {
                $submission = $submissionMap[$student['id']] ?? null;
                $grade = $gradeMap[$student['id']] ?? null;
                
                // Prepare file data
                $fileUrl = null;
                $fileName = null;
                $fileSize = null;
                
                if ($submission && !empty($submission['files'])) {
                    $files = $submission['files'];
                    // Create JSON arrays for multiple files
                    $fileUrls = array_column($files, 'file_path');
                    $fileNames = array_column($files, 'file_name');
                    $fileSizes = array_column($files, 'file_size');
                    
                    $fileUrl = count($fileUrls) > 1 ? json_encode($fileUrls) : $fileUrls[0];
                    $fileName = count($fileNames) > 1 ? json_encode($fileNames) : $fileNames[0];
                    $fileSize = count($fileSizes) > 0 ? $fileSizes[0] : null;
                }
                
                $result[] = [
                    'student_id' => $student['id'],
                    'student_name' => $student['first_name'] . ' ' . $student['last_name'],
                    'student_number' => $student['student_id'],
                    'file_url' => $fileUrl,
                    'file_name' => $fileName,
                    'file_size' => $fileSize,
                    'submission_type' => $submission['submission_type'] ?? 'none',
                    'submission_text' => $submission['submission_text'] ?? null,
                    'submission_url' => $submission['submission_url'] ?? null,
                    'submitted_at' => $submission['submitted_at'] ?? null,
                    'grade' => $grade['grade'] ?? null,
                    'feedback' => $grade['feedback'] ?? null,
                    'status' => $this->getSubmissionStatus($submission, $grade, $activity['due_at'])
                ];
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);

        } catch (Exception $e) {
            error_log('Get submissions error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get student's own submission for an activity
     * GET /api/activities/{id}/my-submission
     */
    public function api_get_my_submission($activityId)
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
            $userId = $this->session->userdata('user_id');
            
            // Get student record from user_id
            $student = $this->db->table('students')
                ->where('user_id', $userId)
                ->get();

            if (!$student) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student record not found'
                ]);
                return;
            }

            $studentId = $student['id'];

            // Get submission for this student
            $submission = $this->db->table('activity_submissions')
                ->where('activity_id', $activityId)
                ->where('student_id', $studentId)
                ->get();

            if (!$submission) {
                // No submission exists yet
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => null
                ]);
                return;
            }

            // Get files for this submission
            $files = $this->db->table('activity_submission_files')
                ->where('submission_id', $submission['id'])
                ->get_all();

            // Prepare file data
            $fileUrl = null;
            $fileName = null;
            $fileSize = null;
            
            if (!empty($files)) {
                // Create JSON arrays for multiple files
                $fileUrls = array_column($files, 'file_path');
                $fileNames = array_column($files, 'file_name');
                $fileSizes = array_column($files, 'file_size');
                
                $fileUrl = count($fileUrls) > 1 ? json_encode($fileUrls) : ($fileUrls[0] ?? null);
                $fileName = count($fileNames) > 1 ? json_encode($fileNames) : ($fileNames[0] ?? null);
                $fileSize = count($fileSizes) > 0 ? $fileSizes[0] : null;
            }

            $result = [
                'id' => $submission['id'],
                'activity_id' => $submission['activity_id'],
                'student_id' => $submission['student_id'],
                'submission_type' => $submission['submission_type'],
                'submission_text' => $submission['submission_text'],
                'submission_url' => $submission['submission_url'],
                'submitted_at' => $submission['submitted_at'],
                'is_late' => $submission['is_late'],
                'file_url' => $fileUrl,
                'file_name' => $fileName,
                'file_size' => $fileSize
            ];

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);

        } catch (Exception $e) {
            error_log('Get my submission error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Save grade for a student submission
     * POST /api/activities/{id}/grade
     */
    public function api_save_grade($activityId)
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
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['student_id']) || !isset($input['grade'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'student_id and grade are required'
                ]);
                return;
            }

            $studentId = $input['student_id'];
            $grade = $input['grade'];
            $feedback = $input['feedback'] ?? null;
            $status = $input['status'] ?? 'graded';

            // Check if grade already exists
            $existing = $this->db->table('activity_grades')
                ->where('activity_id', $activityId)
                ->where('student_id', $studentId)
                ->get();

            $data = [
                'grade' => $grade,
                'feedback' => $feedback,
                'status' => $status,
            ];

            if ($existing) {
                // Update existing grade
                $result = $this->db->table('activity_grades')
                    ->where('activity_id', $activityId)
                    ->where('student_id', $studentId)
                    ->update($data);
            } else {
                // Insert new grade
                $data['activity_id'] = $activityId;
                $data['student_id'] = $studentId;
                $data['created_at'] = app_now();
                
                $result = $this->db->table('activity_grades')->insert($data);
            }

            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Grade saved successfully',
                    'data' => array_merge($data, ['activity_id' => $activityId, 'student_id' => $studentId])
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to save grade'
                ]);
            }

        } catch (Exception $e) {
            error_log('Save grade error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Helper function to determine submission status
     */
    private function getSubmissionStatus($submission, $grade, $dueDate)
    {
        // Check if graded
        if ($grade && isset($grade['grade']) && $grade['grade'] !== null) {
            return 'graded';
        }

        // Check if submitted
        if (!$submission || !$submission['submitted_at']) {
            return 'not_submitted';
        }

        // Check if late
        if ($submission['is_late'] || ($dueDate && strtotime($submission['submitted_at']) > strtotime($dueDate))) {
            return 'late';
        }

        return 'submitted';
    }

    /**
     * Submit activity (for file uploads and text submissions)
     * POST /api/activities/{id}/submit
     */
    public function api_submit_activity($activityId)
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
            // Get activity details
            $activity = $this->db->table('activities')
                ->where('id', $activityId)
                ->get();

            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            // Get student_id from POST data
            $studentId = $_POST['student_id'] ?? null;
            $submissionText = $_POST['submission_text'] ?? '';

            if (!$studentId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student ID is required'
                ]);
                return;
            }

            // Check if student exists
            $student = $this->db->table('students')
                ->where('id', $studentId)
                ->get();

            if (!$student) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student not found'
                ]);
                return;
            }

            // Check if due date has passed
            $isLate = false;
            if ($activity['due_at']) {
                $isLate = strtotime('now') > strtotime($activity['due_at']);
            }

            if ($isLate && empty($activity['allow_late_submission'])) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'Late submissions are not allowed for this activity'
                ]);
                return;
            }

            // Check if submission already exists
            $existingSubmission = $this->db->table('activity_submissions')
                ->where('activity_id', $activityId)
                ->where('student_id', $studentId)
                ->get();

            if ($existingSubmission) {
                // Update existing submission
                $updateData = [
                    'submission_text' => $submissionText,
                    'submitted_at' => app_now(),
                    'is_late' => $isLate ? 1 : 0
                ];

                $this->db->table('activity_submissions')
                    ->where('id', $existingSubmission['id'])
                    ->update($updateData);

                $submissionId = $existingSubmission['id'];

                // Delete old files
                $this->db->table('activity_submission_files')
                    ->where('submission_id', $submissionId)
                    ->delete();
            } else {
                // Create new submission
                $submissionId = (int)$this->db->table('activity_submissions')->insert([
                    'activity_id' => $activityId,
                    'student_id' => $studentId,
                    'submission_text' => $submissionText,
                    'submitted_at' => app_now(),
                    'is_late' => $isLate ? 1 : 0
                ]);
            }

            // Handle file uploads
            if (isset($_FILES['files']) && !empty($_FILES['files']['name'][0])) {
                $uploadPath = 'public/uploads/submissions/';
                
                // Create directory if it doesn't exist
                if (!is_dir($uploadPath)) {
                    mkdir($uploadPath, 0755, true);
                }

                $fileCount = count($_FILES['files']['name']);
                
                for ($i = 0; $i < $fileCount; $i++) {
                    if ($_FILES['files']['error'][$i] === UPLOAD_ERR_OK) {
                        $tmpName = $_FILES['files']['tmp_name'][$i];
                        $originalName = basename($_FILES['files']['name'][$i]);
                        $fileSize = $_FILES['files']['size'][$i];
                        $fileType = $_FILES['files']['type'][$i] ?? null;
                        
                        // Generate unique filename
                        $extension = pathinfo($originalName, PATHINFO_EXTENSION);
                        $filename = uniqid() . '_' . time() . '.' . $extension;
                        $filePath = $uploadPath . $filename;

                        if (move_uploaded_file($tmpName, $filePath)) {
                            // Save file record
                            $this->db->table('activity_submission_files')->insert([
                                'submission_id' => $submissionId,
                                'file_name' => $originalName,
                                'file_path' => $filePath,
                                'file_type' => $fileType,
                                'file_size' => $fileSize,
                                'uploaded_at' => app_now()
                            ]);
                        }
                    }
                }
            }

            echo json_encode([
                'success' => true,
                'message' => 'Activity submitted successfully',
                'submission_id' => $submissionId
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error submitting activity: ' . $e->getMessage()
            ]);
        }
    }

}