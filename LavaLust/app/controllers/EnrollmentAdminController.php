<?php

/**
 * EnrollmentAdminController.php - Admin Enrollment Management
 * 
 * This controller handles all admin enrollment operations:
 * - View all enrollments
 * - View enrollment details
 * - Approve enrollments
 * - Reject enrollments
 * - Verify/reject documents
 */

class EnrollmentAdminController extends Controller
{
    private $enrollmentModel;

    public function __construct()
    {
        parent::__construct();
        $this->enrollmentModel = new EnrollmentModel();
        $this->call->model('DocumentRequirement_model');
        $this->call->model('UserModel');
        $this->call->helper('notification_templates');
    }

    private function send_enrollment_status_email($enrollmentId, $status)
    {
        try {
            $row = $this->db->raw(
                "SELECT e.id, e.grade_level, ap.school_year, u.email, u.first_name, u.last_name,
                        el.first_name AS learner_first_name, el.last_name AS learner_last_name
                 FROM enrollments e
                 LEFT JOIN users u ON e.created_user_id = u.id
                 LEFT JOIN enrollment_learners el ON e.id = el.enrollment_id
                 LEFT JOIN academic_periods ap ON e.academic_period_id = ap.id
                 WHERE e.id = ?
                 LIMIT 1",
                [$enrollmentId]
            )->fetch();

            if (!$row || empty($row['email'])) {
                return;
            }

            $this->call->helper('mail');

            $displayName = trim((string)(($row['learner_first_name'] ?? '') . ' ' . ($row['learner_last_name'] ?? '')));
            if ($displayName === '') {
                $displayName = trim((string)(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')));
            }
            if ($displayName === '') {
                $displayName = 'Student';
            }

            $statusText = (string)$status;
            $grade = $row['grade_level'] ?? 'N/A';
            $schoolYear = $row['school_year'] ?? 'N/A';

            $subject = "Enrollment Status Update: {$statusText}";
            $body = "
                <div style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;\">
                  <h2 style=\"margin-bottom: 8px;\">Enrollment Status Update</h2>
                  <p>Hello <strong>{$displayName}</strong>,</p>
                  <p>Your enrollment status has been updated.</p>
                  <table style=\"border-collapse: collapse; margin: 12px 0;\">
                    <tr><td style=\"padding: 4px 12px 4px 0; color: #6b7280;\">Enrollment ID:</td><td><strong>#{$enrollmentId}</strong></td></tr>
                    <tr><td style=\"padding: 4px 12px 4px 0; color: #6b7280;\">Status:</td><td><strong>{$statusText}</strong></td></tr>
                    <tr><td style=\"padding: 4px 12px 4px 0; color: #6b7280;\">Grade Level:</td><td><strong>{$grade}</strong></td></tr>
                    <tr><td style=\"padding: 4px 12px 4px 0; color: #6b7280;\">School Year:</td><td><strong>{$schoolYear}</strong></td></tr>
                  </table>
                  <p>Please check your portal for more details.</p>
                  <p style=\"margin-top: 20px; color: #6b7280; font-size: 12px;\">This is an automated message from Maranatha Enrollment System.</p>
                </div>
            ";

            sendNotif($row['email'], $subject, $body);
        } catch (Exception $e) {
            error_log('Failed to send enrollment status email (admin): ' . $e->getMessage());
        }
    }

    private function get_adviser_scope()
    {
        if (!$this->session->userdata('logged_in')) {
            return null;
        }

        $role = $this->session->userdata('role');
        if ($role === 'admin') {
            return null;
        }

        if ($role !== 'teacher') {
            return [];
        }

        $userId = $this->session->userdata('user_id');
        if (!$userId) {
            return [];
        }

        $this->call->model('TeacherModel');
        $teacher = $this->TeacherModel->get_by_user_id($userId);
        if (!$teacher || empty($teacher['id'])) {
            return [];
        }

        $this->call->model('AcademicPeriodModel');
        $period = $this->AcademicPeriodModel->get_active_period();
        $schoolYear = $period['school_year'] ?? null;
        if (!$schoolYear) {
            return [];
        }

        $rows = $this->db->table('teacher_adviser_assignments')
            ->select('level')
            ->where('teacher_id', $teacher['id'])
            ->where('school_year', $schoolYear)
            ->get_all();

        if (!is_array($rows) || empty($rows)) {
            return [];
        }

        $levels = array_values(array_unique(array_filter(array_map(function ($row) {
            return $row['level'] ?? null;
        }, $rows))));

        return [
            'levels' => $levels,
            'school_year' => $schoolYear
        ];
    }

    private function is_admin_or_adviser()
    {
        $scope = $this->get_adviser_scope();
        if ($scope === null) {
            return true;
        }

        return !empty($scope['levels']);
    }

    private function can_access_enrollment($enrollmentId)
    {
        $scope = $this->get_adviser_scope();
        if ($scope === null) {
            return true;
        }

        if (empty($scope['levels'])) {
            return false;
        }

        $enrollment = $this->db->table('enrollments')
            ->select('id, grade_level')
            ->where('id', $enrollmentId)
            ->get();

        if (!$enrollment) {
            return null;
        }

        return in_array($enrollment['grade_level'], $scope['levels'], true);
    }

    private function get_document_enrollment_id($documentId)
    {
        $document = $this->db->table('enrollment_documents')
            ->select('enrollment_id')
            ->where('id', $documentId)
            ->get();

        return $document['enrollment_id'] ?? null;
    }

    private function get_previous_level($level)
    {
        $map = [
            'Nursery 1' => null,
            'Nursery 2' => 'Nursery 1',
            'Kinder' => 'Nursery 2',
            'Grade 1' => 'Kinder',
            'Grade 2' => 'Grade 1',
            'Grade 3' => 'Grade 2',
            'Grade 4' => 'Grade 3',
            'Grade 5' => 'Grade 4',
            'Grade 6' => 'Grade 5'
        ];

        return $map[$level] ?? null;
    }

    private function normalize_optional_string($value)
    {
        $value = trim((string)$value);
        return $value === '' ? null : $value;
    }

    private function resolve_account_contacts(array $input)
    {
        $accountEmail = $this->normalize_optional_string($input['account_email'] ?? null);
        $accountPhone = $this->normalize_optional_string($input['account_phone'] ?? null);
        $guardianPhone = $this->normalize_optional_string($input['guardian_phone'] ?? null);

        if ($accountEmail === null && $accountPhone === null) {
            $accountPhone = $guardianPhone;
        }

        return [$accountEmail, $accountPhone];
    }

    private function create_enrollee_account(array $input, array $options = [])
    {
        [$accountEmail, $accountPhone] = $this->resolve_account_contacts($input);

        $role = $options['role'] ?? 'enrollee';
        $status = $options['status'] ?? 'active';

        if ($accountEmail === null && $accountPhone === null) {
            return [
                'success' => false,
                'message' => 'Account email or phone is required when creating account',
                'user_id' => null
            ];
        }

        if ($accountEmail !== null && $this->UserModel->email_exists($accountEmail)) {
            return [
                'success' => false,
                'message' => 'Email address already exists',
                'user_id' => null
            ];
        }

        $userData = [
            'email' => $accountEmail,
            'password' => null,
            'role' => $role,
            'first_name' => $input['learner_first_name'] ?? '',
            'middle_name' => $input['learner_middle_name'] ?? '',
            'last_name' => $input['learner_last_name'] ?? '',
            'phone' => $accountPhone,
            'status' => $status,
            'must_change_password' => 1
        ];

        $createdUserId = $this->UserModel->create($userData);

        if (!$createdUserId) {
            return [
                'success' => false,
                'message' => 'Failed to create user account',
                'user_id' => null
            ];
        }

        if ($accountEmail !== null) {
            $token = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime(app_now() . ' +1 hour'));

            $tokenData = [
                'email' => $accountEmail,
                'user_id' => $createdUserId,
                'token' => $token,
                'type' => 'account_setup',
                'expires_at' => $expiresAt,
                'used' => 0,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ];
            $this->db->table('password_resets')->insert($tokenData);

            $portalUrl = rtrim(config_item('portal_url') ?: 'https://mcaportal.online', '/');
            $resetLink = $portalUrl . "/set-password?token=" . urlencode($token);
            $emailBody = generate_set_password_email($input['learner_first_name'] ?? '', $resetLink);
            $emailResult = sendNotif($accountEmail, 'Set Your Password - Maranatha Enrollment', $emailBody);

            if (empty($emailResult['success'])) {
                error_log('Failed to send password setup email: ' . ($emailResult['message'] ?? 'unknown error'));
            }
        }

        return [
            'success' => true,
            'message' => 'User account created',
            'user_id' => $createdUserId
        ];
    }

    private function normalize_enrollment_type_for_requirements($enrollmentType)
    {
        $rawType = strtolower(trim((string)($enrollmentType ?? '')));

        if ($rawType === '') {
            return '';
        }

        if (strpos($rawType, 'transf') !== false) {
            return 'transferee';
        }

        if (strpos($rawType, 'return') !== false || strpos($rawType, 'continu') !== false) {
            return 'returning student';
        }

        if (strpos($rawType, 'new') !== false) {
            return 'new student';
        }

        return $rawType;
    }

    private function normalize_grade_level_name($gradeLevel)
    {
        return strtolower(trim(preg_replace('/\s+/', ' ', (string)$gradeLevel)));
    }

    /**
     * Resolve section assignment for a given grade level.
     * If preferredSectionId is provided and valid for that grade level, it is used.
     * Otherwise, falls back to the first active mapped section, then any mapped section.
     */
    private function resolve_section_id_for_grade_level($gradeLevel, $preferredSectionId = null)
    {
        $normalized = $this->normalize_grade_level_name($gradeLevel);
        if ($normalized === '') {
            return null;
        }

        $yearLevel = $this->db->raw(
            "SELECT id, name FROM year_levels WHERE LOWER(TRIM(name)) = ? LIMIT 1",
            [$normalized]
        )->fetch();

        if (!$yearLevel || empty($yearLevel['id'])) {
            return null;
        }

        $yearLevelId = (int)$yearLevel['id'];

        if (!empty($preferredSectionId)) {
            $preferred = $this->db->raw(
                "SELECT s.id
                 FROM year_level_sections yls
                 INNER JOIN sections s ON s.id = yls.section_id
                 WHERE yls.year_level_id = ?
                   AND yls.section_id = ?
                   AND s.status = 'active'
                 LIMIT 1",
                [$yearLevelId, (int)$preferredSectionId]
            )->fetch();

            if ($preferred && !empty($preferred['id'])) {
                return (int)$preferred['id'];
            }
        }

        $activeMapped = $this->db->raw(
            "SELECT s.id
             FROM year_level_sections yls
             INNER JOIN sections s ON s.id = yls.section_id
             WHERE yls.year_level_id = ?
               AND s.status = 'active'
             ORDER BY s.id ASC
             LIMIT 1",
            [$yearLevelId]
        )->fetch();

        if ($activeMapped && !empty($activeMapped['id'])) {
            return (int)$activeMapped['id'];
        }

        $anyMapped = $this->db->raw(
            "SELECT section_id
             FROM year_level_sections
             WHERE year_level_id = ?
             ORDER BY section_id ASC
             LIMIT 1",
            [$yearLevelId]
        )->fetch();

        return ($anyMapped && !empty($anyMapped['section_id'])) ? (int)$anyMapped['section_id'] : null;
    }

    private function get_required_document_count_for_enrollment($requirements, $gradeLevel, $enrollmentType)
    {
        $targetGrade = strtolower(trim((string)($gradeLevel ?? '')));
        if ($targetGrade === '') {
            return 0;
        }

        $normalizedTargetType = $this->normalize_enrollment_type_for_requirements($enrollmentType);
        if ($normalizedTargetType === '') {
            $normalizedTargetType = 'new student';
        }

        if ($normalizedTargetType === 'continuing student') {
            $normalizedTargetType = 'returning student';
        }

        $bestByDocument = [];

        foreach ($requirements as $req) {
            if (empty($req['is_active'])) {
                continue;
            }

            $rowGrade = strtolower(trim((string)($req['grade_level'] ?? '')));
            if ($rowGrade !== $targetGrade) {
                continue;
            }

            $rowTypeRaw = trim((string)($req['enrollment_type'] ?? ''));
            $rowTypeLower = strtolower($rowTypeRaw);
            $rowTypeNormalized = $this->normalize_enrollment_type_for_requirements($rowTypeRaw);

            $isGeneric = ($rowTypeRaw === '' || $rowTypeLower === 'all types');
            $isSpecificMatch = ($rowTypeNormalized !== '' && $rowTypeNormalized === $normalizedTargetType);

            if (!$isGeneric && !$isSpecificMatch) {
                continue;
            }

            $docKey = strtolower(trim((string)($req['document_name'] ?? '')));
            if ($docKey === '') {
                continue;
            }

            $score = $isSpecificMatch ? 2 : 1;

            if (!isset($bestByDocument[$docKey]) || $score > $bestByDocument[$docKey]['score']) {
                $bestByDocument[$docKey] = [
                    'score' => $score,
                ];
            }
        }

        return count($bestByDocument);
    }

    private function apply_required_document_counts(array $rows)
    {
        if (empty($rows)) {
            return $rows;
        }

        $requirements = $this->DocumentRequirement_model->get_active_requirements();

        if (!is_array($requirements)) {
            $requirements = [];
        }

        foreach ($rows as &$row) {
            $requiredCount = $this->get_required_document_count_for_enrollment(
                $requirements,
                $row['grade_level'] ?? '',
                $row['enrollment_type'] ?? ''
            );

            $verifiedCount = (int)($row['documents_verified'] ?? 0);
            if ($requiredCount > 0 && $verifiedCount > $requiredCount) {
                $verifiedCount = $requiredCount;
            }

            $row['documents_count'] = $requiredCount;
            $row['documents_verified'] = $verifiedCount;
        }
        unset($row);

        return $rows;
    }

    private function validate_enrollment_input($input)
    {
        $errors = [];

        if (empty($input['learner_first_name'])) {
            $errors['learner_first_name'] = 'First name is required';
        }
        if (empty($input['learner_last_name'])) {
            $errors['learner_last_name'] = 'Last name is required';
        }
        if (empty($input['birth_date'])) {
            $errors['birth_date'] = 'Birth date is required';
        }
        if (empty($input['gender'])) {
            $errors['gender'] = 'Gender is required';
        }
        if (empty($input['grade_level'])) {
            $errors['grade_level'] = 'Grade level is required';
        }

        if (empty($input['current_address'])) {
            $errors['current_address'] = 'Current address is required';
        }
        if (empty($input['current_province'])) {
            $errors['current_province'] = 'Current province is required';
        }
        if (empty($input['current_municipality'])) {
            $errors['current_municipality'] = 'Current municipality is required';
        }
        if (empty($input['current_phone'])) {
            $errors['current_phone'] = 'Contact number is required';
        }

        if (empty($input['father_name']) && empty($input['mother_name']) && empty($input['guardian_name'])) {
            $errors['contacts'] = 'At least one parent or guardian contact is required';
        }

        return $errors;
    }

    /**
     * Process document uploads
     * @param array $files FILES array
     * @param array $input POST input
     * @return array Processed document metadata
     */
    private function process_document_uploads($files, $input)
    {
        $documents = [];
        $uploadDir = ROOT_DIR . 'public/uploads/enrollments/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx'];
        $maxFileSize = 5 * 1024 * 1024;

        $fileArray = is_array($files['name']) ? $files : [$files];

        foreach ($fileArray as $key => $file) {
            if (!isset($file['tmp_name']) || empty($file['tmp_name'])) {
                continue;
            }

            $fileInfo = pathinfo($file['name']);
            $ext = strtolower($fileInfo['extension']);

            if (!in_array($ext, $allowedTypes)) {
                continue;
            }

            if ($file['size'] > $maxFileSize) {
                continue;
            }

            $newFileName = 'enrollment_' . uniqid() . '.' . $ext;
            $uploadPath = $uploadDir . $newFileName;

            if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
                $documents[] = [
                    'file_name' => $file['name'],
                    'file_path' => '/uploads/enrollments/' . $newFileName,
                    'file_type' => $file['type'],
                    'file_size' => $file['size'],
                    'document_type' => $input['document_type'] ?? 'General'
                ];
            }
        }

        return $documents;
    }

    /**
     * GET /api/admin/enrollments
     * Fetch all enrollments with stats
     */
    public function api_admin_enrollments()
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $scope = $this->get_adviser_scope();
            if (is_array($scope) && empty($scope['levels'])) {
                http_response_code(200);
                echo json_encode(['success' => true, 'data' => []]);
                return;
            }

            $where = '';
            $params = [];
            if (is_array($scope) && !empty($scope['levels'])) {
                $placeholders = implode(',', array_fill(0, count($scope['levels']), '?'));
                $where = "WHERE e.grade_level IN ($placeholders) AND ap.school_year = ?";
                $params = array_merge($scope['levels'], [$scope['school_year']]);
            }

            $query = "
                SELECT 
                    e.id,
                    e.academic_period_id,
                    ap.school_year,
                    ap.quarter,
                    e.grade_level,
                    e.enrollment_type,
                    e.status,
                    COALESCE(e.submitted_date, e.created_at) AS submitted_date,
                    e.approved_date,
                    e.rejected_date,
                    e.rejection_reason,
                    e.created_user_id,
                    e.created_student_id,
                    s.student_id as formatted_student_id,
                    e.enrollment_period_id,
                    CONCAT(el.first_name, ' ', COALESCE(el.middle_name, ''), ' ', el.last_name) as student_name,
                    COUNT(DISTINCT ed.id) as documents_count,
                    SUM(CASE WHEN ed.verification_status = 'Verified' AND ed.is_current_version = 1 THEN 1 ELSE 0 END) as documents_verified,
                    SUM(CASE WHEN ed.verification_status = 'Rejected' AND ed.is_current_version = 1 THEN 1 ELSE 0 END) as documents_rejected
                FROM enrollments e
                LEFT JOIN enrollment_learners el ON e.id = el.enrollment_id
                LEFT JOIN academic_periods ap ON ap.id = e.academic_period_id
                LEFT JOIN enrollment_documents ed ON e.id = ed.enrollment_id AND ed.is_current_version = 1
                LEFT JOIN students s ON e.created_student_id = s.id
                $where
                GROUP BY e.id, ap.id, el.first_name, el.middle_name, el.last_name, s.student_id
                ORDER BY 
                    CASE 
                        WHEN e.status = 'Pending' THEN 1
                        WHEN e.status = 'Incomplete' THEN 2
                        WHEN e.status = 'Under Review' THEN 3
                        WHEN e.status = 'Approved' THEN 4
                        WHEN e.status = 'Rejected' THEN 5
                    END,
                    e.submitted_date DESC
            ";
            
            $result = $this->db->raw($query, $params)->fetchAll();
            $result = $this->apply_required_document_counts($result);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching enrollments: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/adviser/enrollments?level=Grade%201
     * Fetch enrollments scoped to a single grade level in the active school year
     */
    public function api_adviser_enrollments()
    {
        api_set_json_headers();

        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $level = trim($_GET['level'] ?? '');
            if ($level === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'level parameter is required']);
                return;
            }

            $scope = $this->get_adviser_scope();
            if (is_array($scope)) {
                if (empty($scope['levels'])) {
                    http_response_code(200);
                    echo json_encode(['success' => true, 'data' => []]);
                    return;
                }

                if (!in_array($level, $scope['levels'], true)) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                    return;
                }

                $schoolYear = $scope['school_year'];
            } else {
                $this->call->model('AcademicPeriodModel');
                $period = $this->AcademicPeriodModel->get_active_period();
                $schoolYear = $period['school_year'] ?? null;
            }

            if (!$schoolYear) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Active school year not found']);
                return;
            }

            $query = "
                SELECT 
                    e.id,
                    e.academic_period_id,
                    ap.school_year,
                    ap.quarter,
                    e.grade_level,
                    e.enrollment_type,
                    e.status,
                    COALESCE(e.submitted_date, e.created_at) AS submitted_date,
                    e.approved_date,
                    e.rejected_date,
                    e.rejection_reason,
                    e.created_user_id,
                    e.created_student_id,
                    s.student_id as formatted_student_id,
                    e.enrollment_period_id,
                    CONCAT(el.first_name, ' ', COALESCE(el.middle_name, ''), ' ', el.last_name) as student_name,
                    COUNT(DISTINCT ed.id) as documents_count,
                    SUM(CASE WHEN ed.verification_status = 'Verified' AND ed.is_current_version = 1 THEN 1 ELSE 0 END) as documents_verified,
                    SUM(CASE WHEN ed.verification_status = 'Rejected' AND ed.is_current_version = 1 THEN 1 ELSE 0 END) as documents_rejected
                FROM enrollments e
                LEFT JOIN enrollment_learners el ON e.id = el.enrollment_id
                LEFT JOIN academic_periods ap ON ap.id = e.academic_period_id
                LEFT JOIN enrollment_documents ed ON e.id = ed.enrollment_id AND ed.is_current_version = 1
                LEFT JOIN students s ON e.created_student_id = s.id
                WHERE e.grade_level = ? AND ap.school_year = ?
                GROUP BY e.id, ap.id, el.first_name, el.middle_name, el.last_name, s.student_id
                ORDER BY 
                    CASE 
                        WHEN e.status = 'Pending' THEN 1
                        WHEN e.status = 'Incomplete' THEN 2
                        WHEN e.status = 'Under Review' THEN 3
                        WHEN e.status = 'Approved' THEN 4
                        WHEN e.status = 'Rejected' THEN 5
                    END,
                    e.submitted_date DESC
            ";

            $result = $this->db->raw($query, [$level, $schoolYear])->fetchAll();
            $result = $this->apply_required_document_counts($result);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching enrollments: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/adviser/enrollments/eligible-students?level=Grade%201
     * Fetch eligible continuing students from the previous level for advisers
     */
    public function api_adviser_eligible_students()
    {
        api_set_json_headers();

        try {
            $scope = $this->get_adviser_scope();
            if ($scope === null) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            if (empty($scope['levels'])) {
                http_response_code(200);
                echo json_encode(['success' => true, 'data' => []]);
                return;
            }

            $level = trim($_GET['level'] ?? '');
            if ($level === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'level parameter is required']);
                return;
            }

            if (!in_array($level, $scope['levels'], true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $schoolYear = $scope['school_year'] ?? null;
            if (!$schoolYear) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Active school year not found']);
                return;
            }

            $startYear = null;
            $parts = preg_split('/\s*-\s*/', $schoolYear);
            if (!empty($parts[0]) && ctype_digit($parts[0])) {
                $startYear = (int) $parts[0];
            }
            if (!$startYear && preg_match('/(\d{4})/', $schoolYear, $matches)) {
                $startYear = (int) $matches[1];
            }
            if (!$startYear) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Invalid school year format']);
                return;
            }

            $previousLevel = $this->get_previous_level($level);
            if (!$previousLevel) {
                http_response_code(200);
                echo json_encode(['success' => true, 'data' => []]);
                return;
            }

                        $query = "
                                SELECT
                                        s.id,
                                        s.student_id,
                                        s.year_level,
                                        s.enrollment_date,
                                        u.first_name,
                                        u.middle_name,
                                        u.last_name
                                FROM students s
                                INNER JOIN users u ON u.id = s.user_id
                                WHERE s.year_level = ?
                                    AND (s.enrollment_date IS NULL OR YEAR(s.enrollment_date) != ?)
                                ORDER BY u.last_name, u.first_name
                        ";

            $result = $this->db->raw($query, [$previousLevel, $startYear])->fetchAll();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching eligible students: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/adviser/enrollments/{id}/payments
     * Fetch payments for an enrollment scoped to adviser grade levels
     */
    public function api_adviser_enrollment_payments()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $enrollmentId = segment(3);
            if (!is_numeric($enrollmentId)) {
                $uri = trim($_SERVER['REQUEST_URI'], '/');
                $parts = explode('/', $uri);
                foreach ($parts as $part) {
                    if (is_numeric($part)) {
                        $enrollmentId = $part;
                        break;
                    }
                }
            }

            if (!is_numeric($enrollmentId)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid enrollment ID']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access === null) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            if ($access === false) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $data = $this->enrollmentModel->get_enrollment_payments($enrollmentId);

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/adviser/enrollments/submit
     * Submit manual enrollment scoped to adviser grade level
     */
    public function api_adviser_submit_enrollment()
    {
        api_set_json_headers();

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            return;
        }

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $scope = $this->get_adviser_scope();
            if ($scope === null || empty($scope['levels'])) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $input = $_POST;

            if (empty($input)) {
                $jsonInput = json_decode(file_get_contents('php://input'), true);
                if ($jsonInput) {
                    $input = $jsonInput;
                }
            }

            if (!$input) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No input data provided']);
                return;
            }

            $allowedTypes = ['New Student', 'Transferee', 'Continuing Student', 'Returning Student'];
            $enrollmentType = trim($input['enrollment_type'] ?? '');
            if (!in_array($enrollmentType, $allowedTypes, true)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'Invalid enrollment type']);
                return;
            }

            $gradeLevel = trim($input['grade_level'] ?? '');
            if ($gradeLevel === '' || !in_array($gradeLevel, $scope['levels'], true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $errors = $this->validate_enrollment_input($input);
            if (!empty($errors)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'Validation failed', 'errors' => $errors]);
                return;
            }

            if ($enrollmentType === 'Continuing Student') {
                $selectedStudentId = $input['selected_student_id'] ?? null;
                if (empty($selectedStudentId)) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => 'Selected student is required']);
                    return;
                }

                $previousLevel = $this->get_previous_level($gradeLevel);
                if (!$previousLevel) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => 'Invalid previous level for continuing enrollment']);
                    return;
                }

                $schoolYear = $scope['school_year'] ?? null;
                $startYear = null;
                if ($schoolYear) {
                    $parts = preg_split('/\s*-\s*/', $schoolYear);
                    if (!empty($parts[0]) && ctype_digit($parts[0])) {
                        $startYear = (int) $parts[0];
                    }
                    if (!$startYear && preg_match('/(\d{4})/', $schoolYear, $matches)) {
                        $startYear = (int) $matches[1];
                    }
                }

                $student = $this->db->table('students')
                    ->select('id, year_level, enrollment_date')
                    ->where('id', $selectedStudentId)
                    ->get();

                if (!$student) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => 'Selected student not found']);
                    return;
                }

                if ($student['year_level'] !== $previousLevel) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => 'Selected student is not in the expected previous level']);
                    return;
                }

                if (!empty($student['enrollment_date']) && $startYear) {
                    $enrollmentYear = (int) date('Y', strtotime($student['enrollment_date']));
                    if ($enrollmentYear === $startYear) {
                        http_response_code(422);
                        echo json_encode(['success' => false, 'message' => 'Selected student is already enrolled for the current school year']);
                        return;
                    }
                }
            }

            // Handle account creation if requested or auto-triggered (for adviser-created enrollments)
            $createdUserId = null;
            $createdStudentId = null;
            $isCreateAccountRequested = isset($input['create_account']) && $input['create_account'] === '1';
            $autoAccountTypes = ['New Student', 'Transferee'];
            $shouldAutoCreateAccount = !$isCreateAccountRequested
                && in_array($enrollmentType, $autoAccountTypes, true);

            $createMissingAccount = $enrollmentType === 'Returning Student'
                && isset($input['create_missing_account'])
                && $input['create_missing_account'] === '1';

            if ($createMissingAccount) {
                $returningStudentId = isset($input['returning_student_id']) ? (int)$input['returning_student_id'] : 0;
                if ($returningStudentId <= 0) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => 'Returning student ID is required to create an account']);
                    return;
                }

                $studentRow = $this->db->table('students')
                    ->select('id, user_id')
                    ->where('id', $returningStudentId)
                    ->get();

                if (!$studentRow) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Student record not found']);
                    return;
                }

                if (!empty($studentRow['user_id'])) {
                    http_response_code(409);
                    echo json_encode(['success' => false, 'message' => 'Student already has an account']);
                    return;
                }

                $accountResult = $this->create_enrollee_account($input, [
                    'role' => 'student',
                    'status' => 'pending'
                ]);
                if (empty($accountResult['success'])) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => $accountResult['message']]);
                    return;
                }
                $createdUserId = $accountResult['user_id'];
                $createdStudentId = $returningStudentId;
                $this->StudentModel->update($returningStudentId, ['user_id' => $createdUserId]);
            } elseif ($isCreateAccountRequested || $shouldAutoCreateAccount) {
                $accountResult = $this->create_enrollee_account($input);
                if (empty($accountResult['success'])) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => $accountResult['message']]);
                    return;
                }
                $createdUserId = $accountResult['user_id'];
            }

            $enrollmentData = [
                'user_id' => $userId,
                'created_user_id' => $createdUserId,
                'created_student_id' => $createdStudentId,
                'enrollment_type' => $enrollmentType,
                'grade_level' => $gradeLevel,
                'status' => 'Under Review',
                'enrollment_period_id' => $input['enrollment_period_id'] ?? null,
                'guardian_name' => trim((string)($input['guardian_name'] ?? '')),
                'guardian_contact' => trim((string)($input['guardian_contact'] ?? '')),
                'guardian_email' => trim((string)($input['guardian_email'] ?? '')),
                'learner' => [
                    'first_name' => $input['learner_first_name'] ?? '',
                    'middle_name' => $input['learner_middle_name'] ?? '',
                    'last_name' => $input['learner_last_name'] ?? '',
                    'birth_date' => $input['birth_date'] ?? null,
                    'gender' => $input['gender'] ?? '',
                    'guardian_phone' => $this->normalize_optional_string($input['guardian_phone'] ?? null)
                ],
                'addresses' => [
                    'current' => [
                        'street' => $input['current_address'] ?? '',
                        'barangay' => $input['current_barangay'] ?? '',
                        'municipality' => $input['current_municipality'] ?? '',
                        'province' => $input['current_province'] ?? '',
                        'zip_code' => $input['current_zip_code'] ?? '',
                        'phone' => $input['current_phone'] ?? ''
                    ],
                    'permanent' => [
                        'street' => $input['permanent_address'] ?? '',
                        'barangay' => $input['permanent_barangay'] ?? '',
                        'municipality' => $input['permanent_municipality'] ?? '',
                        'province' => $input['permanent_province'] ?? '',
                        'zip_code' => $input['permanent_zip_code'] ?? '',
                        'phone' => $input['permanent_phone'] ?? ''
                    ]
                ],
                'flags' => [
                    'is_indigenous_ip' => $input['is_indigenous_ip'] ?? 0,
                    'is_4ps_beneficiary' => $input['is_4ps_beneficiary'] ?? 0,
                    'has_disability' => $input['has_disability'] ?? 0,
                    'disability_type' => $input['disability_type'] ?? null,
                    'special_language' => $input['special_language'] ?? null
                ],
                'contacts' => [
                    [
                        'type' => 'Father',
                        'name' => $input['father_name'] ?? '',
                        'phone' => $input['father_contact'] ?? '',
                        'email' => $input['father_email'] ?? '',
                        'is_primary' => 1
                    ],
                    [
                        'type' => 'Mother',
                        'name' => $input['mother_name'] ?? '',
                        'phone' => $input['mother_contact'] ?? '',
                        'email' => $input['mother_email'] ?? '',
                        'is_primary' => 0
                    ]
                ]
            ];

            $guardianName = trim((string)($input['guardian_name'] ?? ''));
            $guardianContact = trim((string)($input['guardian_contact'] ?? ''));
            $guardianEmail = trim((string)($input['guardian_email'] ?? ''));
            if ($guardianName !== '' || $guardianContact !== '' || $guardianEmail !== '') {
                $enrollmentData['contacts'][] = [
                    'type' => 'Guardian',
                    'name' => $guardianName !== '' ? $guardianName : 'Guardian',
                    'phone' => $guardianContact,
                    'email' => $guardianEmail,
                    'is_primary' => 0
                ];
            }

            $enrollmentData['documents'] = [];
            if (isset($_FILES['documents'])) {
                $uploadedDocs = $this->process_document_uploads($_FILES['documents'], $input);
                $enrollmentData['documents'] = $uploadedDocs;
            }

            $enrollmentId = $this->EnrollmentModel->create_enrollment($enrollmentData);

            if (!$enrollmentId) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create enrollment']);
                return;
            }

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment submitted successfully',
                'enrollment_id' => $enrollmentId,
                'status' => 'Under Review'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/admin/enrollments/{id}
     * Fetch detailed enrollment information
     */
    public function api_admin_enrollment_detail($enrollmentId)
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access === false) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }
            if ($access === null) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }
            
            $enrollmentData = $this->enrollmentModel->get_enrollment_with_details($enrollmentId);
            
            if (!$enrollmentData) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            // Flatten the enrollment data structure to match frontend expectations
            $flattened = $this->flatten_enrollment_data($enrollmentData);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $flattened
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching enrollment: ' . $e->getMessage()]);
        }
    }

    /**
     * Flatten nested enrollment data structure to flat array
     * Transforms the hierarchical structure from the model into flat field names
     */
    private function flatten_enrollment_data($enrollment)
    {
        $flattened = [
            // Enrollment info
            'id' => $enrollment['id'] ?? null,
            'student_id' => $enrollment['student_id'] ?? null,
            'school_year' => $enrollment['school_year'] ?? null,
            'grade_level' => $enrollment['grade_level'] ?? null,
            'enrollment_type' => $enrollment['enrollment_type'] ?? null,
            'status' => $enrollment['status'] ?? null,
            'submitted_date' => $enrollment['submitted_date'] ?? null,
            'approved_date' => $enrollment['approved_date'] ?? null,
            'rejected_date' => $enrollment['rejected_date'] ?? null,
            'rejection_reason' => $enrollment['rejection_reason'] ?? null,
            
            // Learner info
            'learner_first_name' => null,
            'learner_middle_name' => null,
            'learner_last_name' => null,
            'birth_date' => null,
            'gender' => null,
            'psa_birth_cert_number' => null,
            
            // Address defaults
            'current_address' => null,
            'current_barangay' => null,
            'current_municipality' => null,
            'current_province' => null,
            'current_zip_code' => null,
            'current_phone' => null,
            'permanent_address' => null,
            'permanent_barangay' => null,
            'permanent_municipality' => null,
            'permanent_province' => null,
            'permanent_zip_code' => null,
            'same_as_current' => 0,
            
            // Parent defaults
            'father_name' => null,
            'father_contact' => null,
            'father_email' => null,
            'mother_name' => null,
            'mother_contact' => null,
            'mother_email' => null,
            
            // Flags defaults
            'is_returning_student' => 0,
            'is_indigenous_ip' => 0,
            'is_4ps_beneficiary' => 0,
            'has_disability' => 0,
            'disability_type' => null,
            
            // Documents
            'documents' => []
        ];

        // Learner info
        if ($enrollment['learner']) {
            $flattened['learner_first_name'] = $enrollment['learner']['first_name'] ?? null;
            $flattened['learner_middle_name'] = $enrollment['learner']['middle_name'] ?? null;
            $flattened['learner_last_name'] = $enrollment['learner']['last_name'] ?? null;
            $flattened['birth_date'] = $enrollment['learner']['birth_date'] ?? null;
            $flattened['gender'] = $enrollment['learner']['gender'] ?? null;
            $flattened['psa_birth_cert_number'] = $enrollment['learner']['psa_birth_cert_number'] ?? null;
        }

        // Addresses (find by address_type = 'Current' or 'Permanent')
        if (is_array($enrollment['addresses'])) {
            foreach ($enrollment['addresses'] as $addr) {
                $addrType = strtolower($addr['address_type'] ?? '');
                if ($addrType === 'current') {
                    $flattened['current_address'] = $addr['address'] ?? null;
                    $flattened['current_barangay'] = $addr['barangay'] ?? null;
                    $flattened['current_municipality'] = $addr['municipality'] ?? null;
                    $flattened['current_province'] = $addr['province'] ?? null;
                    $flattened['current_zip_code'] = $addr['zip_code'] ?? null;
                    $flattened['current_phone'] = $addr['phone'] ?? null;
                } elseif ($addrType === 'permanent') {
                    $flattened['permanent_address'] = $addr['address'] ?? null;
                    $flattened['permanent_barangay'] = $addr['barangay'] ?? null;
                    $flattened['permanent_municipality'] = $addr['municipality'] ?? null;
                    $flattened['permanent_province'] = $addr['province'] ?? null;
                    $flattened['permanent_zip_code'] = $addr['zip_code'] ?? null;
                }
            }
            
            // Determine if permanent address is the same as current
            if ($flattened['permanent_address'] !== null && $flattened['current_address'] !== null) {
                $flattened['same_as_current'] = (
                    $flattened['permanent_address'] === $flattened['current_address'] &&
                    $flattened['permanent_barangay'] === $flattened['current_barangay'] &&
                    $flattened['permanent_municipality'] === $flattened['current_municipality'] &&
                    $flattened['permanent_province'] === $flattened['current_province'] &&
                    $flattened['permanent_zip_code'] === $flattened['current_zip_code']
                ) ? 1 : 0;
            }
        }

        // Flags
        if ($enrollment['flags']) {
            $flattened['is_returning_student'] = (int)($enrollment['flags']['is_returning_student'] ?? 0);
            $flattened['is_indigenous_ip'] = (int)($enrollment['flags']['is_indigenous_ip'] ?? 0);
            $flattened['is_4ps_beneficiary'] = (int)($enrollment['flags']['is_4ps_beneficiary'] ?? 0);
            $flattened['has_disability'] = (int)($enrollment['flags']['has_disability'] ?? 0);
            $flattened['disability_type'] = $enrollment['flags']['disability_type'] ?? null;
        }

        // Parent contacts (find by contact_type: Father, Mother)
        if (is_array($enrollment['contacts'])) {
            foreach ($enrollment['contacts'] as $contact) {
                $contactType = $contact['contact_type'] ?? null;
                if ($contactType === 'Father') {
                    $flattened['father_name'] = $contact['name'] ?? null;
                    $flattened['father_contact'] = $contact['phone'] ?? null;
                    $flattened['father_email'] = $contact['email'] ?? null;
                } elseif ($contactType === 'Mother') {
                    $flattened['mother_name'] = $contact['name'] ?? null;
                    $flattened['mother_contact'] = $contact['phone'] ?? null;
                    $flattened['mother_email'] = $contact['email'] ?? null;
                }
            }
        }

        // Documents
        $flattened['documents'] = $enrollment['documents'] ?? [];

        return $flattened;
    }

    /**
     * POST /api/admin/enrollments/{id}/approve
     * Approve an enrollment and create student record
     */
    public function api_admin_enrollment_approve($enrollmentId)
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access === false) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }
            if ($access === null) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            // Get request body to check for preserveStudentId flag
            $input = json_decode(file_get_contents('php://input'), true);
            $preserveStudentId = $input['preserveStudentId'] ?? false;
            $preferredSectionId = $input['section_id'] ?? ($input['sectionId'] ?? null);
            
            // Debug: Log the incoming flag
            error_log("DEBUG: preserveStudentId flag = " . ($preserveStudentId ? 'true' : 'false') . ", input: " . json_encode($input));

            // Fetch enrollment with academic period info to get school year
            $enrollment = $this->db->table('enrollments as e')
                ->join('academic_periods as ap', 'e.academic_period_id = ap.id')
                ->select('e.*, ap.school_year')
                ->where('e.id', $enrollmentId)
                ->get();
            
            if (!$enrollment) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            $userId = $enrollment['created_user_id'];
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Associated user (created_user_id) not found for this enrollment']);
                return;
            }

            // 2. Update User Role to 'student'
            $this->db->table('users')
                ->where('id', $userId)
                ->update(['role' => 'student']);

            // 3. Create/Update Student Profile
            $studentData = [
                'user_id' => $userId,
                'year_level' => $enrollment['grade_level'],
                'status' => 'active',
                'enrollment_id' => $enrollmentId,
                'enrollment_date' => app_today(),
                'updated_at' => app_now()
            ];

            $resolvedSectionId = $this->resolve_section_id_for_grade_level($enrollment['grade_level'], $preferredSectionId);
            if (!empty($resolvedSectionId)) {
                $studentData['section_id'] = $resolvedSectionId;
            }
            
            // Check if student profile already exists for this user
            $existingStudent = $this->db->table('students')->where('user_id', $userId)->get();
            
            if ($existingStudent) {
                // Student record already exists
                // ALWAYS preserve the existing student_id to avoid duplicate key errors
                // The preserveStudentId flag is just for additional confirmation/logging
                $finalStudentIdStr = $existingStudent['student_id'];
                
                // Log if we're overriding the preserve flag
                if (!$preserveStudentId) {
                    error_log("DEBUG: Student exists for user_id=$userId, preserving ID {$existingStudent['student_id']} even though preserveStudentId=false");
                }
                
                // Update existing record WITHOUT changing student_id
                $this->db->table('students')
                    ->where('id', $existingStudent['id'])
                    ->update($studentData);
                $newStudentPk = $existingStudent['id'];
            } else {
                // No existing student record - create new one with generated ID
                $schoolYear = $enrollment['school_year'];
                $yearParts = explode('-', $schoolYear);
                $startYear = $yearParts[0];
                
                error_log("DEBUG: Creating new student record for user_id=$userId using startYear=$startYear");

                // Use StudentModel safe create to avoid duplicate-key under concurrency
                $this->call->model('StudentModel');
                $created = $this->StudentModel->create_student_with_generated_id($studentData, $startYear);
                if ($created) {
                    $newStudentPk = $created['id'];
                    $finalStudentIdStr = $created['student_id'];
                    error_log("DEBUG: Created student with ID={$finalStudentIdStr}");
                } else {
                    throw new Exception('Failed to create student record after retries');
                }
            }

            // 4. Update Final Enrollment Status
            $this->db->table('enrollments')
                ->where('id', $enrollmentId)
                ->update([
                    'status' => 'Approved',
                    'approved_date' => app_now(),
                    'approved_by' => $this->session->userdata('user_id'),
                    'created_student_id' => $newStudentPk
                ]);

            http_response_code(200);
            $this->send_enrollment_status_email($enrollmentId, 'Approved');
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment approved and student profile created.',
                'student_id' => $finalStudentIdStr,
                'id' => $newStudentPk,
                'section_id' => $resolvedSectionId
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error approving enrollment: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/admin/enrollments/{id}/reject
     * Reject an enrollment
     */
    public function api_admin_enrollment_reject($enrollmentId)
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access === false) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }
            if ($access === null) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $reason = $input['reason'] ?? 'No reason provided';

            $enrollment = $this->db->table('enrollments')
                ->where('id', $enrollmentId)
                ->get();
            
            if (!$enrollment) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            $this->db->table('enrollments')
                ->where('id', $enrollmentId)
                ->update([
                    'status' => 'Rejected',
                    'rejection_reason' => $reason,
                    'rejected_date' => app_now()
                ]);

            $this->send_enrollment_status_email($enrollmentId, 'Rejected');

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment rejected'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error rejecting enrollment: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/admin/documents/{id}/verify
     * Verify a document
     */
    public function api_admin_document_verify($documentId)
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $enrollmentId = $this->get_document_enrollment_id($documentId);
            if (!$enrollmentId) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Document not found']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access !== true) {
                http_response_code($access === null ? 404 : 403);
                echo json_encode(['success' => false, 'message' => $access === null ? 'Enrollment not found' : 'Unauthorized']);
                return;
            }

            $this->db->table('enrollment_documents')
                ->where('id', $documentId)
                ->update([
                    'verification_status' => 'Verified',
                    'verified_date' => app_now()
                ]);

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Document verified']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error verifying document: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/admin/documents/{id}/reject
     * Reject a document and request resubmission
     */
    public function api_admin_document_reject($documentId)
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $enrollmentId = $this->get_document_enrollment_id($documentId);
            if (!$enrollmentId) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Document not found']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access !== true) {
                http_response_code($access === null ? 404 : 403);
                echo json_encode(['success' => false, 'message' => $access === null ? 'Enrollment not found' : 'Unauthorized']);
                return;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = $input['rejection_reason'] ?? 'Other';
            $notes = $input['notes'] ?? 'No additional notes provided';
            $adminId = $this->session->userdata('user_id');

            // Get the document to check enrollment_id
            $document = $this->db->table('enrollment_documents')
                ->where('id', $documentId)
                ->get();
            
            if (!$document) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Document not found']);
                return;
            }

            // Update document status
            $this->db->table('enrollment_documents')
                ->where('id', $documentId)
                ->update([
                    'verification_status' => 'Rejected',
                    'rejection_reason' => $rejectionReason,
                    'verification_notes' => $notes,
                    'verified_by' => $adminId,
                    'verified_date' => app_now(),
                    'resubmission_requested_date' => app_now()
                ]);

            // Update enrollment status to Incomplete if it has rejected documents
            $this->db->table('enrollments')
                ->where('id', $document['enrollment_id'])
                ->update(['status' => 'Incomplete']);

            http_response_code(200);
            echo json_encode([
                'success' => true, 
                'message' => 'Document rejected. Resubmission requested.'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error rejecting document: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/admin/documents/{id}/verify-physical
     * Mark physical document as checked
     */
    public function api_admin_document_verify_physical($documentId)
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $enrollmentId = $this->get_document_enrollment_id($documentId);
            if (!$enrollmentId) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Document not found']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access !== true) {
                http_response_code($access === null ? 404 : 403);
                echo json_encode(['success' => false, 'message' => $access === null ? 'Enrollment not found' : 'Unauthorized']);
                return;
            }

            $adminId = $this->session->userdata('user_id');

            $this->db->table('enrollment_documents')
                ->where('id', $documentId)
                ->update([
                    'physical_verification_status' => 'Checked',
                    'physical_verified_by' => $adminId,
                    'physical_verified_date' => app_now()
                ]);

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Physical document verified']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error verifying physical document: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/admin/documents/{enrollmentId}/history/{documentType}
     * Get version history for a specific document type
     */
    public function api_admin_document_history($enrollmentId, $documentType)
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access === false) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }
            if ($access === null) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            $query = "
                SELECT 
                    ed.id,
                    ed.file_name,
                    ed.file_path,
                    ed.verification_status,
                    ed.rejection_reason,
                    ed.verification_notes,
                    ed.resubmission_count,
                    ed.is_current_version,
                    ed.upload_date,
                    ed.verified_date,
                    ed.resubmission_requested_date,
                    ed.resubmitted_date,
                    u.full_name as verified_by_name
                FROM enrollment_documents ed
                LEFT JOIN users u ON u.id = ed.verified_by
                WHERE ed.enrollment_id = ?
                  AND ed.document_type = ?
                ORDER BY ed.upload_date DESC
            ";
            
            $history = $this->db->raw($query, [$enrollmentId, urldecode($documentType)])->fetchAll();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $history
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching document history: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/admin/enrollments/stats
     * Fetch enrollment statistics
     */
    public function api_admin_enrollments_stats()
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $scope = $this->get_adviser_scope();
            if (is_array($scope) && empty($scope['levels'])) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'total' => 0,
                        'pending' => 0,
                        'approved' => 0,
                        'rejected' => 0
                    ]
                ]);
                return;
            }

            $where = '';
            $params = [];
            if (is_array($scope) && !empty($scope['levels'])) {
                $placeholders = implode(',', array_fill(0, count($scope['levels']), '?'));
                $where = "WHERE grade_level IN ($placeholders) AND academic_period_id IN (SELECT id FROM academic_periods WHERE school_year = ?)";
                $params = array_merge($scope['levels'], [$scope['school_year']]);
            }

            $stats = $this->db->raw("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
                FROM enrollments
                $where
            ", $params)->fetch();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => [
                    'total' => (int)($stats['total'] ?? 0),
                    'pending' => (int)($stats['pending'] ?? 0),
                    'approved' => (int)($stats['approved'] ?? 0),
                    'rejected' => (int)($stats['rejected'] ?? 0)
                ]
            ]);
        } catch (Exception $e) {
             http_response_code(500);
             echo json_encode(['success' => false, 'message' => 'Error fetching stats: ' . $e->getMessage()]);
         }
     }
 
    /**
     * POST /api/admin/documents/toggle-manual
     * Toggle physical verification of a document (Insert/Delete)
     */
    public function api_admin_document_toggle_manual()
    {
        api_set_json_headers();
        
        try {
            if (!$this->is_admin_or_adviser()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $enrollmentId = $input['enrollment_id'] ?? null;
            $documentType = $input['document_type'] ?? null;
            
            if (!$enrollmentId || !$documentType) {
                 http_response_code(400);
                 echo json_encode(['success' => false, 'message' => 'Missing enrollment_id or document_type']);
                 return;
            }

            $access = $this->can_access_enrollment($enrollmentId);
            if ($access === false) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }
            if ($access === null) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }
            
            // Check if physical record exists
            $existing = $this->db->table('enrollment_documents')
                ->where('enrollment_id', $enrollmentId)
                ->where('document_type', $documentType)
                ->where('submission_method', 'Physical')
                ->get();

            if ($existing) {
                // DELETE (Uncheck)
                $this->db->table('enrollment_documents')
                    ->where('id', $existing['id'])
                    ->delete();
                
                 http_response_code(200);
                 echo json_encode(['success' => true, 'action' => 'deleted', 'message' => 'Physical document verification removed']);
            } else {
                // INSERT (Check)
                $data = [
                    'enrollment_id' => $enrollmentId,
                    'document_type' => $documentType,
                    'file_name' => 'Physical Copy', 
                    'file_path' => '',
                    'file_type' => 'N/A',
                    'submission_method' => 'Physical',
                    'verification_status' => 'Verified',
                    'upload_date' => app_now(),
                    'verified_by' => $this->session->userdata('user_id'),
                    'verified_date' => app_now(),
                    'is_current_version' => 1
                ];
                
                $this->db->table('enrollment_documents')->insert($data);
                
                http_response_code(200);
                echo json_encode(['success' => true, 'action' => 'inserted', 'message' => 'Physical document verified manually']);
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error toggling manual document: ' . $e->getMessage()]);
        }
    }
}

