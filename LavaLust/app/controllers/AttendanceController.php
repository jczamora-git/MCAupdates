<?php

/**
 * AttendanceController - Manage student attendance
 * Handles QR code validation and attendance record insertion
 */
class AttendanceController extends Controller
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Mark attendance (swipe-based interface)
     * POST /api/attendance/mark
     * 
     * Expected payload:
     * {
     *   "session_id": "timestamp-random" (string - groups records from single session),
     *   "student_id": "MCC2025-00359" (string - student code),
     *   "teacher_id": <int>,
     *   "course_id": <int>,
     *   "status": "present|late|absent|out_of_range"
     * }
     */
    public function api_mark_attendance()
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
            $json = file_get_contents('php://input');
            $data = json_decode($json, true);

            if (!$data) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid JSON payload'
                ]);
                return;
            }

            // Validate required fields
            $session_id = $data['session_id'] ?? null; // String: groups records from single session
            $student_id = $data['student_id'] ?? null; // String: "MCC2025-00359"
            $teacher_id = $data['teacher_id'] ?? null;
            $course_id = $data['course_id'] ?? null;
            $status = $data['status'] ?? 'present';

            if (!$session_id || !$student_id || !$teacher_id || !$course_id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields: session_id, student_id, teacher_id, course_id'
                ]);
                return;
            }

            // Validate status
            $valid_statuses = ['present', 'late', 'absent', 'excused'];
            if (!in_array($status, $valid_statuses)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid status. Must be: ' . implode(', ', $valid_statuses)
                ]);
                return;
            }

            // Insert attendance record
            $attendance = [
                'session_id' => strval($session_id), // Groups records from single session
                'student_id' => strval($student_id), // Keep as string
                'teacher_id' => intval($teacher_id),
                'course_id' => intval($course_id),
                'status' => $status,
                'created_at' => app_now()
            ];

            $inserted_id = $this->db->table('attendance')->insert($attendance);

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Attendance marked successfully',
                'attendance_id' => $inserted_id,
                'status' => $status,
                'timestamp' => app_now()
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
     * Get attendance records for a student
     * GET /api/attendance/student/{student_id}
     */
    public function api_get_student_attendance($student_id)
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
            // Join with students and users to return readable student info
            $records = $this->db->table('attendance')
                ->select('attendance.*, students.student_id as student_code, users.first_name, users.last_name')
                ->join('students', 'students.student_id = attendance.student_id')
                ->join('users', 'users.id = students.user_id')
                ->where('attendance.student_id', $student_id)
                ->order_by('attendance.created_at', 'DESC')
                ->get_all();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $records
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
     * Get attendance records for a course
     * GET /api/attendance/course/{course_id}?teacher_id={teacher_id}
     * Optional filter: teacher_id to get only records for a specific teacher
     */
    public function api_get_course_attendance($course_id)
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
            $teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;
            $date = isset($_GET['date']) ? trim($_GET['date']) : null;

            // Start from attendance and join student info using student_id (which is the student code string)
            // Then join with users to get first_name and last_name
            $query = $this->db->table('attendance')
                ->select('attendance.*, users.first_name, users.last_name')
                ->join('students', 'students.student_id = attendance.student_id')
                ->join('users', 'users.id = students.user_id')
                ->where('attendance.course_id', $course_id);

            // Filter by teacher_id if provided
            if ($teacher_id) {
                $query->where('attendance.teacher_id', $teacher_id);
            }

            // If a date is provided (YYYY-MM-DD), filter records for that date
            if ($date) {
                $start = $date . ' 00:00:00';
                $end = date('Y-m-d 00:00:00', strtotime($date . ' +1 day'));
                $query->where('attendance.created_at >=', $start)->where('attendance.created_at <', $end);
            }

            $records = $query->order_by('attendance.created_at', 'DESC')->get_all();

            // Map student name from first_name and last_name
            $mapped = array_map(function($record) {
                $record['student_name'] = trim(($record['first_name'] ?? '') . ' ' . ($record['last_name'] ?? ''));
                return $record;
            }, $records);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $mapped
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
     * Get today's attendance records for a teacher
     * GET /api/attendance/today?teacher_id={teacher_id}&course_id={course_id}&section_id={section_id}
     * 
     * Filters:
     * - teacher_id (required): teacher's user id
     * - course_id (required): course id
     * - section_id (optional): section id to filter by section
     * - date (optional): date in YYYY-MM-DD format, defaults to today
     * 
     * Returns: { success, data: [ { id, student_id, teacher_id, course_id, status, created_at }, ... ] }
     */
    public function api_get_today_attendance()
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
            $teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;
            $course_id = isset($_GET['course_id']) ? intval($_GET['course_id']) : null;
            $section_id = isset($_GET['section_id']) ? intval($_GET['section_id']) : null;
            $date = isset($_GET['date']) ? trim($_GET['date']) : app_today();

            // Validate required parameters
            if (!$teacher_id || !$course_id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: teacher_id and course_id'
                ]);
                return;
            }

            // Build the query
            $query = $this->db->table('attendance')
                ->select('attendance.id, attendance.student_id, attendance.teacher_id, attendance.course_id, attendance.status, attendance.created_at, students.student_id as student_code, students.section_id, users.first_name, users.last_name')
                ->join('students', 'students.student_id = attendance.student_id')
                ->join('users', 'users.id = students.user_id')
                ->where('attendance.teacher_id', $teacher_id)
                ->where('attendance.course_id', $course_id);

            // Filter by section if provided
            if ($section_id) {
                $query->where('students.section_id', $section_id);
            }

            // Filter by date (today by default)
            $start = $date . ' 00:00:00';
            $end = date('Y-m-d 00:00:00', strtotime($date . ' +1 day'));
            $query->where('attendance.created_at', '>=', $start)
                  ->where('attendance.created_at', '<', $end);

            $records = $query->order_by('attendance.created_at', 'DESC')->get_all();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $records
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
     * Get attendance logs grouped by course for a given date
     * GET /api/attendance/logs?date=YYYY-MM-DD
     */
    public function api_get_attendance_logs()
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

        $role = (string)($this->session->userdata('role') ?? '');
        if ($role !== 'teacher') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden'
            ]);
            return;
        }

        try {
            $teacher_id = (int)$this->session->userdata('user_id');
            $date = isset($_GET['date']) ? trim((string)$_GET['date']) : app_today();

            if ($teacher_id <= 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid teacher id'
                ]);
                return;
            }

            $sql = "
                SELECT
                    a.course_id,
                    s.course_code,
                    s.name AS subject_name,
                    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
                    SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
                    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
                    SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) AS excused,
                    COUNT(*) AS total
                FROM attendance a
                LEFT JOIN subjects s ON s.id = a.course_id
                WHERE a.teacher_id = ?
                  AND DATE(a.created_at) = ?
                GROUP BY a.course_id, s.course_code, s.name
                ORDER BY s.course_code ASC
            ";

            $stmt = $this->db->raw($sql, [$teacher_id, $date]);
            $logs = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'date' => $date,
                'logs' => $logs
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
     * Bulk insert attendance records
     * POST /api/attendance/bulk
     * 
     * Expected payload:
     * {
     *   "records": [
     *     {
     *       "session_id": "MCA-20260127-ABC123",
     *       "student_id": "123",
     *       "course_id": 5,
     *       "status": "present|late|absent|excused",
     *       "attendance_date": "2026-01-27"
     *     },
     *     ...
     *   ]
     * }
     */
    public function api_bulk_insert_attendance()
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
            $json = file_get_contents('php://input');
            $data = json_decode($json, true);

            if (!$data || !isset($data['records']) || !is_array($data['records'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid payload. Expected { "records": [...] }'
                ]);
                return;
            }

            $records = $data['records'];
            
            if (empty($records)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No records provided'
                ]);
                return;
            }

            // Get teacher_id from the first record (all records should have the same teacher_id)
            // Or optionally from session, but request payload is preferred for bulk operations
            $teacher_id = null;
            if (!empty($records) && isset($records[0]['teacher_id'])) {
                $teacher_id = intval($records[0]['teacher_id']);
            }

            if (!$teacher_id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Teacher ID is required in attendance records'
                ]);
                return;
            }

            $inserted_count = 0;
            $errors = [];
            $valid_statuses = ['present', 'late', 'absent', 'excused'];

            foreach ($records as $idx => $record) {
                // Validate required fields
                if (!isset($record['student_id']) || !isset($record['course_id']) || !isset($record['status']) || !isset($record['session_id'])) {
                    $errors[] = "Record $idx: Missing required fields";
                    continue;
                }

                // Validate status
                if (!in_array($record['status'], $valid_statuses)) {
                    $errors[] = "Record $idx: Invalid status '{$record['status']}'";
                    continue;
                }

                // Prepare attendance record
                $attendance = [
                    'session_id' => $record['session_id'],
                    'student_id' => strval($record['student_id']),
                    'teacher_id' => intval($teacher_id),
                    'course_id' => intval($record['course_id']),
                    'status' => $record['status'],
                    'created_at' => isset($record['attendance_date']) 
                        ? $record['attendance_date'] . ' ' . date('H:i:s')
                        : app_now()
                ];

                try {
                    $this->db->table('attendance')->insert($attendance);
                    $inserted_count++;
                } catch (Exception $e) {
                    $errors[] = "Record $idx: " . $e->getMessage();
                }
            }

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => "Successfully inserted $inserted_count attendance records",
                'inserted_count' => $inserted_count,
                'total_records' => count($records),
                'errors' => $errors
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
}
