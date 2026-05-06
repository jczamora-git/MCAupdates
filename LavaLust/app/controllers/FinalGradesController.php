<?php

/**
 * FinalGradesController - Manage final grades submission
 * Handles submission of final grades to the final_grades table
 */
class FinalGradesController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('AuditLogger');
        $this->call->database();
    }

    private function normalizeQuarter($value)
    {
        $raw = trim((string)$value);
        if ($raw === '') return null;

        $map = [
            '1st' => '1st',
            '1st quarter' => '1st',
            '2nd' => '2nd',
            '2nd quarter' => '2nd',
            '3rd' => '3rd',
            '3rd quarter' => '3rd',
            '4th' => '4th',
            '4th quarter' => '4th',
            'midterm' => '2nd',
            'final' => '4th',
        ];

        $key = strtolower($raw);
        return $map[$key] ?? null;
    }

    private function getActorName()
    {
        $first = trim((string)$this->session->userdata('first_name'));
        $last = trim((string)$this->session->userdata('last_name'));
        return trim($first . ' ' . $last);
    }

    private function getSubmissionControl()
    {
        $row = $this->db->table('grade_submission_controls')
            ->where('id', 1)
            ->get();

        if (!$row) {
            $now = app_now();
            $this->db->table('grade_submission_controls')->insert([
                'id' => 1,
                'is_enabled' => 1,
                'updated_by' => $this->session->userdata('user_id') ?: null,
                'updated_at' => $now,
                'created_at' => $now,
            ]);

            $row = $this->db->table('grade_submission_controls')
                ->where('id', 1)
                ->get();
        }

        return $row;
    }

    /**
     * Submit final grades for a course/section/period
     * POST /api/final-grades/submit
     * 
     * Body: {
     *   "subject_id": 6,
     *   "section_id": 1,
     *   "academic_period_id": 10,
    *   "quarter": "1st Quarter",
     *   "grades": [
     *     {"student_id": 5, "final_grade_num": 87.5, "final_grade": "1.50"},
     *     ...
     *   ]
     * }
     */
    public function api_submit_grades()
    {
        api_set_json_headers();

        // Check authorization - must be logged in and be a teacher/admin
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        $user_id = $this->session->userdata('user_id');
        $role = $this->session->userdata('role');

        if (!in_array($role, ['teacher', 'admin'], true)) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Only teachers or admins can submit grades'
            ]);
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);

            if (!$input) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid input'
                ]);
                return;
            }

            $subject_id = $input['subject_id'] ?? null;
            $section_id = $input['section_id'] ?? null;
            $academic_period_id = $input['academic_period_id'] ?? null;
            $quarterRaw = $input['quarter'] ?? ($input['term'] ?? null);
            $quarter = $this->normalizeQuarter($quarterRaw);
            $grades = $input['grades'] ?? [];

            // Validate required fields
            if (!$subject_id || !$section_id || !$academic_period_id || !$quarter || empty($grades)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields (subject_id, section_id, academic_period_id, quarter, grades)'
                ]);
                return;
            }

            $submissionControl = $this->getSubmissionControl();
            if (empty($submissionControl) || (int)($submissionControl['is_enabled'] ?? 0) !== 1) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'Grade submission is currently disabled by admin.'
                ]);
                return;
            }

            if ($role === 'teacher') {
                // Resolve teacher record (teacher.id) from current session user_id
                $teacher = $this->TeacherModel->get_by_user_id($user_id);
                if (empty($teacher) || empty($teacher['id'])) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Teacher profile not found for current user'
                    ]);
                    return;
                }

                $teacher_id = $teacher['id'];

                // Verify teacher assignment for this subject/section
                $schoolYear = null;
                $periodRow = $this->db->table('academic_periods')
                    ->where('id', $academic_period_id)
                    ->get();
                if (!empty($periodRow['school_year'])) {
                    $schoolYear = $periodRow['school_year'];
                }

                $assignmentSql = "SELECT tsa.id
                     FROM teacher_subject_assignments tsa
                     WHERE tsa.teacher_id = ? AND tsa.subject_id = ?";
                $assignmentParams = [$teacher_id, $subject_id];

                if ($schoolYear) {
                    $assignmentSql .= " AND tsa.school_year = ?";
                    $assignmentParams[] = $schoolYear;
                }

                $stmt = $this->db->raw($assignmentSql, $assignmentParams);

                // LavaLust raw returns PDOStatement; fetch a row to check existence
                $assignment = null;
                if ($stmt) {
                    try {
                        $assignment = $stmt->fetch(PDO::FETCH_ASSOC);
                    } catch (Exception $e) {
                        $assignment = null;
                    }
                }

                if (empty($assignment)) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'message' => 'You are not assigned to teach this subject and section.'
                    ]);
                    return;
                }

                $sectionSql = "SELECT yls.section_id
                     FROM subjects s
                     INNER JOIN year_levels yl ON yl.name COLLATE utf8mb4_unicode_ci = s.level COLLATE utf8mb4_unicode_ci
                     INNER JOIN year_level_sections yls ON yls.year_level_id = yl.id
                     WHERE s.id = ? AND yls.section_id = ?
                     LIMIT 1";
                $sectionStmt = $this->db->raw($sectionSql, [$subject_id, $section_id]);
                $sectionMatch = null;
                if ($sectionStmt) {
                    try {
                        $sectionMatch = $sectionStmt->fetch(PDO::FETCH_ASSOC);
                    } catch (Exception $e) {
                        $sectionMatch = null;
                    }
                }

                if (empty($sectionMatch)) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'message' => 'The selected section does not match this subject\'s grade level.'
                    ]);
                    return;
                }
            }

            $studentIds = array_values(array_unique(array_filter(array_map(function ($g) {
                return isset($g['student_id']) ? (int)$g['student_id'] : 0;
            }, $grades), fn($id) => $id > 0)));

            if (empty($studentIds)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No students provided for grade submission'
                ]);
                return;
            }

            $quarterValues = array_values(array_filter(array_unique([
                isset($quarterRaw) ? trim((string)$quarterRaw) : null,
                $quarter
            ]), fn($v) => $v !== null && $v !== ''));
            $params = [(int)$subject_id, (int)$section_id, (int)$academic_period_id];
            $quarterSql = ' AND (quarter IS NULL OR quarter = \'\')';
            if (!empty($quarterValues)) {
                $qPlaceholders = implode(',', array_fill(0, count($quarterValues), '?'));
                $quarterSql = " AND (quarter IN ($qPlaceholders) OR quarter IS NULL OR quarter = '')";
                $params = array_merge($params, $quarterValues);
            }

            $quarterlyStmt = $this->db->raw(
                "SELECT id, source_type, source_activity_id, max_score
                 FROM grading_input_items
                 WHERE subject_id = ? AND section_id = ? AND academic_period_id = ?
                   AND component = 'quarterly' AND is_active = 1" . $quarterSql,
                $params
            );
            $quarterlyItems = $quarterlyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if (empty($quarterlyItems)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quarterly Assessment scores are required before submitting grades.'
                ]);
                return;
            }

            $quarterlyHps = array_sum(array_map(fn($i) => (float)($i['max_score'] ?? 0), $quarterlyItems));
            if ($quarterlyHps <= 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quarterly Assessment scores are required before submitting grades.'
                ]);
                return;
            }

            $manualItemIds = array_values(array_unique(array_map(
                fn($i) => (int)$i['id'],
                array_filter($quarterlyItems, fn($i) => (($i['source_type'] ?? '') !== 'activity'))
            )));
            $activityIds = array_values(array_unique(array_map(
                fn($i) => (int)$i['source_activity_id'],
                array_filter($quarterlyItems, fn($i) => (($i['source_type'] ?? '') === 'activity') && !empty($i['source_activity_id']))
            )));

            $manualScoreMap = [];
            if (!empty($manualItemIds)) {
                $itemPlaceholders = implode(',', array_fill(0, count($manualItemIds), '?'));
                $studentPlaceholders = implode(',', array_fill(0, count($studentIds), '?'));
                $scoreStmt = $this->db->raw(
                    "SELECT grading_input_item_id, student_id, score
                     FROM grading_input_scores
                     WHERE grading_input_item_id IN ($itemPlaceholders)
                       AND student_id IN ($studentPlaceholders)",
                    array_merge($manualItemIds, $studentIds)
                );
                $scoreRows = $scoreStmt ? ($scoreStmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
                foreach ($scoreRows as $row) {
                    $iid = (int)$row['grading_input_item_id'];
                    $sid = (int)$row['student_id'];
                    if (!isset($manualScoreMap[$iid])) $manualScoreMap[$iid] = [];
                    $manualScoreMap[$iid][$sid] = $row['score'];
                }
            }

            $activityScoreMap = [];
            if (!empty($activityIds)) {
                $actPlaceholders = implode(',', array_fill(0, count($activityIds), '?'));
                $studentPlaceholders = implode(',', array_fill(0, count($studentIds), '?'));
                $actStmt = $this->db->raw(
                    "SELECT activity_id, student_id, grade
                     FROM activity_grades
                     WHERE activity_id IN ($actPlaceholders)
                       AND student_id IN ($studentPlaceholders)",
                    array_merge($activityIds, $studentIds)
                );
                $actRows = $actStmt ? ($actStmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
                foreach ($actRows as $row) {
                    $aid = (int)$row['activity_id'];
                    $sid = (int)$row['student_id'];
                    if (!isset($activityScoreMap[$aid])) $activityScoreMap[$aid] = [];
                    $activityScoreMap[$aid][$sid] = $row['grade'];
                }
            }

            $missingStudents = [];
            $validScoreCount = 0;
            foreach ($studentIds as $sid) {
                foreach ($quarterlyItems as $item) {
                    $sourceType = $item['source_type'] ?? '';
                    if ($sourceType === 'activity' && !empty($item['source_activity_id'])) {
                        $activityId = (int)$item['source_activity_id'];
                        if (!isset($activityScoreMap[$activityId]) || !array_key_exists($sid, $activityScoreMap[$activityId])) {
                            $missingStudents[$sid] = true;
                            continue;
                        }
                        $score = $activityScoreMap[$activityId][$sid];
                    } else {
                        $itemId = (int)$item['id'];
                        if (!isset($manualScoreMap[$itemId]) || !array_key_exists($sid, $manualScoreMap[$itemId])) {
                            $missingStudents[$sid] = true;
                            continue;
                        }
                        $score = $manualScoreMap[$itemId][$sid];
                    }

                    if ($score === null || $score === '' || !is_numeric($score)) {
                        $missingStudents[$sid] = true;
                        continue;
                    }

                    $validScoreCount++;
                }
            }

            if ($validScoreCount === 0 || !empty($missingStudents)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Quarterly Assessment scores are required before submitting grades.'
                ]);
                return;
            }

            $usedTx = null;
            if (method_exists($this->db, 'transaction')) {
                $this->db->transaction();
                $usedTx = 'transaction';
            } elseif (method_exists($this->db, 'beginTransaction')) {
                $this->db->beginTransaction();
                $usedTx = 'beginTransaction';
            }

            // Create or update submission header
            $existingSubmission = $this->FinalGradesModel->get_submission_by_scope(
                $subject_id,
                $section_id,
                $academic_period_id,
                $quarter
            );

            $submissionId = null;
            if (!empty($existingSubmission) && !empty($existingSubmission['id'])) {
                $submissionId = (int)$existingSubmission['id'];
                $this->FinalGradesModel->update_submission($submissionId, [
                    'status' => 'submitted',
                    'submitted_by' => (int)$user_id,
                    'submitted_at' => app_now(),
                    'approved_by' => null,
                    'approved_at' => null,
                    'rejection_reason' => null,
                ]);
            } else {
                $submissionId = $this->FinalGradesModel->create_submission([
                    'subject_id' => (int)$subject_id,
                    'section_id' => (int)$section_id,
                    'academic_period_id' => (int)$academic_period_id,
                    'quarter' => $quarter,
                    'submitted_by' => (int)$user_id,
                    'submitted_at' => app_now(),
                    'status' => 'submitted',
                ]);

                if (!$submissionId) {
                    throw new Exception('Failed to create final grade submission header');
                }
            }

            // Insert or update grade items
            $inserted = 0;
            $updated = 0;
            $errors = [];

            foreach ($grades as $grade_data) {
                $student_id = $grade_data['student_id'] ?? null;
                $final_grade_num = $grade_data['final_grade_num'] ?? null;
                $final_grade = $grade_data['final_grade'] ?? null;
                $remarks = $grade_data['remarks'] ?? null;

                if (!$student_id || !$final_grade) {
                    $errors[] = "Invalid grade data for student {$student_id}";
                    continue;
                }

                $result = $this->FinalGradesModel->upsert_submission_item($submissionId, (int)$student_id, [
                    'final_grade_num' => $final_grade_num,
                    'final_grade' => $final_grade,
                    'remarks' => $remarks,
                ]);

                if (!empty($result['success'])) {
                    if (($result['action'] ?? '') === 'updated') {
                        $updated++;
                    } else {
                        $inserted++;
                    }
                } else {
                    $errors[] = "Failed to save grade for student {$student_id}";
                }
            }

            if (($usedTx === 'transaction' || $usedTx === 'beginTransaction') && method_exists($this->db, 'commit')) {
                $this->db->commit();
            }

            try {
                $this->AuditLogger->log([
                    'action' => 'grades.submitted',
                    'entity_type' => 'final_grade_submission',
                    'entity_id' => $submissionId,
                    'actor_user_id' => $user_id,
                    'actor_role' => $role,
                    'actor_name' => $this->getActorName(),
                    'description' => "Submitted final grades for subject {$subject_id}, section {$section_id}, period {$academic_period_id}, quarter {$quarter}",
                    'metadata' => [
                        'subject_id' => (int)$subject_id,
                        'section_id' => (int)$section_id,
                        'academic_period_id' => (int)$academic_period_id,
                        'quarter' => $quarter,
                        'submission_id' => (int)$submissionId,
                        'inserted' => (int)$inserted,
                        'updated' => (int)$updated,
                        'errors_count' => count($errors),
                    ],
                ]);
            } catch (Exception $auditError) {
                error_log('Failed to create grade submission audit log: ' . $auditError->getMessage());
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => "Grades submitted successfully ({$inserted} inserted, {$updated} updated)",
                'submission_id' => $submissionId,
                'inserted' => $inserted,
                'updated' => $updated,
                'errors' => $errors
            ]);
        } catch (Exception $e) {
            if (method_exists($this->db, 'rollback')) {
                $this->db->rollback();
            } elseif (method_exists($this->db, 'rollBack')) {
                $this->db->rollBack();
            }

            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get final grades for a student in a subject/period
     * GET /api/final-grades?student_id=5&subject_id=6&academic_period_id=10
     */
    public function api_get_final_grades()
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
            $filters = [];
            
            if (!empty($_GET['student_id'])) {
                $filters['student_id'] = $_GET['student_id'];
            }
            if (!empty($_GET['subject_id'])) {
                $filters['subject_id'] = $_GET['subject_id'];
            }
            if (!empty($_GET['academic_period_id'])) {
                $filters['academic_period_id'] = $_GET['academic_period_id'];
            }
            if (!empty($_GET['section_id'])) {
                $filters['section_id'] = $_GET['section_id'];
            }
            if (!empty($_GET['quarter'])) {
                $filters['quarter'] = $this->normalizeQuarter($_GET['quarter']);
            }

            $result = $this->FinalGradesModel->get_grades($filters);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result ?? [],
                'count' => is_array($result) ? count($result) : 0
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
     * Get grade submission control (enabled/disabled)
     * GET /api/final-grades/submission-control
     */
    public function api_get_submission_control()
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
            $row = $this->getSubmissionControl();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => [
                    'is_enabled' => (int)($row['is_enabled'] ?? 0) === 1,
                    'updated_by' => $row['updated_by'] ?? null,
                    'updated_at' => $row['updated_at'] ?? null,
                ]
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
     * Update grade submission control (admin only)
     * PUT /api/final-grades/submission-control
     * Body: { "is_enabled": true|false }
     */
    public function api_update_submission_control()
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

        $role = $this->session->userdata('role');
        if ($role !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Only admin can update grade submission control'
            ]);
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!is_array($input) || !array_key_exists('is_enabled', $input)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required field: is_enabled'
                ]);
                return;
            }

            $enabled = (int)((bool)$input['is_enabled']);
            $user_id = (int)$this->session->userdata('user_id');

            $existing = $this->getSubmissionControl();

            $payload = [
                'is_enabled' => $enabled,
                'updated_by' => $user_id,
                'updated_at' => app_now(),
            ];

            if ($existing && !empty($existing['id'])) {
                $ok = $this->db->table('grade_submission_controls')
                    ->where('id', 1)
                    ->update($payload);
            } else {
                $payload['id'] = 1;
                $payload['created_at'] = app_now();
                $ok = $this->db->table('grade_submission_controls')->insert($payload);
            }

            if (!$ok) {
                throw new Exception('Failed to update grade submission control');
            }

            try {
                $this->AuditLogger->log([
                    'action' => 'grades.submission_control_updated',
                    'entity_type' => 'grade_submission_control',
                    'entity_id' => 1,
                    'actor_user_id' => $user_id,
                    'actor_role' => 'admin',
                    'actor_name' => $this->getActorName(),
                    'description' => $enabled ? 'Enabled grade submission' : 'Disabled grade submission',
                    'metadata' => [
                        'is_enabled' => $enabled === 1,
                    ],
                ]);
            } catch (Exception $auditError) {
                error_log('Failed to create grade submission control audit log: ' . $auditError->getMessage());
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => $enabled ? 'Grade submission enabled' : 'Grade submission disabled',
                'data' => [
                    'is_enabled' => $enabled === 1,
                ]
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
?>
