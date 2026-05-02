<?php

/**
 * EnrollmentController - Handle enrollment submissions and management
 * Manages student enrollment applications and status
 */
class EnrollmentController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('NotificationService');
        $this->call->library('AuditLogger');
        $this->call->helper('notification_templates');
        $this->call->model('EnrollmentModel');
        $this->call->model('StudentModel');
        $this->call->model('UserModel');
        $this->call->model('DocumentRequirement_model');
    }

    /**
     * Best-effort rollback for partially created enrollments.
     */
    private function cleanup_failed_enrollment_submission($enrollmentId, $createdStudentId = null)
    {
        if (empty($enrollmentId)) {
            return;
        }

        try {
            $this->db->table('enrollment_documents')->where('enrollment_id', $enrollmentId)->delete();
            $this->db->table('enrollment_parent_contacts')->where('enrollment_id', $enrollmentId)->delete();
            $this->db->table('enrollment_flags')->where('enrollment_id', $enrollmentId)->delete();
            $this->db->table('enrollment_addresses')->where('enrollment_id', $enrollmentId)->delete();
            $this->db->table('enrollment_learners')->where('enrollment_id', $enrollmentId)->delete();
            $this->db->table('enrollments')->where('id', $enrollmentId)->delete();

            if (!empty($createdStudentId)) {
                $this->StudentModel->update($createdStudentId, ['enrollment_id' => null]);
            }
        } catch (Throwable $cleanupError) {
            error_log('Failed to cleanup partially created enrollment #' . $enrollmentId . ': ' . $cleanupError->getMessage());
        }
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
            error_log('Failed to send enrollment status email: ' . $e->getMessage());
        }
    }

    /**
     * Submit new enrollment
     * POST /api/enrollments/submit
     * 
     * Expected JSON body with form data
     */
    public function api_submit_enrollment()
    {
        api_set_json_headers();
        
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            return;
        }

        $enrollmentId = null;
        try {
            // Check authentication
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $userEmail = $this->session->userdata('email');
            $userRole = $this->session->userdata('role');
            $userName = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');

            // Get form input (FormData from frontend)
            // Extract from $_POST and $_FILES since FormData sends multipart/form-data
            $input = $_POST; // Get all POST fields
            
            // If no POST data and JSON headers, try JSON
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

            // Check if this is admin-created enrollment
            $isAdminCreated = isset($input['is_admin_created']) && $input['is_admin_created'] === '1';
            if ($isAdminCreated) {
                $userId = null; // Admin-created enrollments don't have a user_id
            }

            // Handle account creation if requested or auto-triggered
            $createdUserId = null;
            $createdStudentId = null;
            $enrollmentType = trim((string)($input['enrollment_type'] ?? ''));
            $isCreateAccountRequested = isset($input['create_account']) && $input['create_account'] === '1';
            $autoAccountTypes = ['New Student', 'Transferee'];
            $shouldAutoCreateAccount = $isAdminCreated
                && !$isCreateAccountRequested
                && in_array($enrollmentType, $autoAccountTypes, true);

            $createMissingAccount = $isAdminCreated
                && $enrollmentType === 'Returning Student'
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
            } elseif ($isAdminCreated && ($isCreateAccountRequested || $shouldAutoCreateAccount)) {
                $accountResult = $this->create_enrollee_account($input);
                if (empty($accountResult['success'])) {
                    http_response_code(422);
                    echo json_encode(['success' => false, 'message' => $accountResult['message']]);
                    return;
                }
                $createdUserId = $accountResult['user_id'];
            }

            // Create student record (only for regular enrollments, not admin-created)
            if (!$isAdminCreated && $createdUserId) {
                $studentData = [
                    'user_id' => $createdUserId,
                    'student_id' => null,
                    'year_level' => $input['grade_level'] ?? '',
                    'enrollment_id' => null
                ];
                $createdStudentId = $this->StudentModel->insert($studentData);

                if (!$createdStudentId) {
                    $this->UserModel->delete_user($createdUserId);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Failed to create student record']);
                    return;
                }
            }

            if ($isAdminCreated && ($input['enrollment_type'] ?? '') === 'Continuing Student') {
                if (!empty($input['created_user_id'])) {
                    $createdUserId = (int)$input['created_user_id'];
                }
                if (!empty($input['created_student_id'])) {
                    $createdStudentId = (int)$input['created_student_id'];
                }
            }

            // For student-submitted continuing student enrollments, fetch student ID from database
            // Note: Only applies to role='student'. Enrollees with 'Continuing Student' will have
            // created_student_id=NULL since they don't have a student record yet (no legacy data available)
            if (!$isAdminCreated && $userRole === 'student' && ($input['enrollment_type'] ?? '') === 'Continuing Student') {
                $studentRecord = $this->StudentModel->get_by_user_id($userId);
                if ($studentRecord) {
                    $createdStudentId = (int)$studentRecord['id'];
                }
            }

            // Validate required fields
            $errors = $this->validate_enrollment_input($input);
            if (!empty($errors)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'Validation failed', 'errors' => $errors]);
                return;
            }

            // Prepare enrollment data structure
            $enrollmentData = [
                'user_id' => $userId,
                'created_user_id' => $createdUserId,
                'created_student_id' => $createdStudentId,
                'enrollment_type' => $input['enrollment_type'] ?? 'New Student',
                'grade_level' => $input['grade_level'] ?? '',
                'status' => $isAdminCreated ? 'Under Review' : 'Pending',
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

            // Add guardian if provided
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

            // Handle document uploads if present
            $enrollmentData['documents'] = [];
            if (isset($_FILES['documents'])) {
                $uploadedDocs = $this->process_document_uploads($_FILES['documents'], $input);
                $enrollmentData['documents'] = $uploadedDocs;
            }

            // Create enrollment
            $enrollmentId = $this->EnrollmentModel->create_enrollment($enrollmentData);

            if (!$enrollmentId) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create enrollment']);
                return;
            }

            // Update student record with enrollment_id if account was created
            if ($createdStudentId) {
                $this->StudentModel->update($createdStudentId, ['enrollment_id' => $enrollmentId]);
            }

            // Send notification to admins about new enrollment submission
            // Strict mode: this must succeed, otherwise enrollment is rolled back.
            try {
                $student_name = trim(($input['learner_first_name'] ?? '') . ' ' . ($input['learner_last_name'] ?? ''));
                $grade_level = $input['grade_level'] ?? 'Unknown';
                $enrollment_type = $input['enrollment_type'] ?? 'New Student';
                
                // Build current user context
                $currentUser = [
                    'user_id' => $userId,
                    'role' => $userRole,
                    'email' => $userEmail,
                    'name' => $userName
                ];

                // Notify all admins about the new enrollment
                $recipients = $this->NotificationService->getRecipientsByRole('admin');
                if (empty($recipients)) {
                    // Fallback for environments with inconsistent role/status values.
                    $adminRows = $this->db->raw(
                        'SELECT id as user_id FROM users WHERE role IN (?, ?, ?)',
                        ['admin', 'Admin', 'ADMIN']
                    )->fetchAll(\PDO::FETCH_ASSOC);

                    if (!empty($adminRows)) {
                        $recipients = array_map(function($row) {
                            return [
                                'user_id' => $row['user_id'],
                                'role' => 'admin'
                            ];
                        }, $adminRows);
                    }
                }
                
                $notificationData = [
                    'type' => NotificationService::TYPE_ENROLLMENT_SUBMITTED,
                    'title' => 'New Enrollment Submitted',
                    'body' => "{$student_name} submitted an enrollment application for Grade {$grade_level}",
                    'icon' => 'user-plus',
                    'action_url' => '/admin/enrollments',
                    'push_data' => [
                        'screen' => 'EnrollmentDetails',
                        'enrollment_id' => $enrollmentId
                    ],
                    'metadata' => [
                        'enrollment_id' => $enrollmentId,
                        'grade_level' => $grade_level,
                        'enrollment_type' => $enrollment_type,
                        'student_name' => $student_name
                    ],
                    'action' => 'enrollment.submitted',
                    'entity_type' => 'enrollment',
                    'entity_id' => $enrollmentId,
                    'actor_user_id' => $currentUser['user_id'],
                    'actor_role' => $currentUser['role'],
                    'actor_name' => $currentUser['name'],
                    'description' => "{$student_name} submitted a {$enrollment_type} enrollment for Grade {$grade_level}",
                    'recipients' => $recipients
                ];

                $notificationResult = $this->NotificationService->create($notificationData);

                if (empty($notificationResult['success'])) {
                    throw new Exception('NotificationService failed: ' . ($notificationResult['error'] ?? 'unknown error'));
                }
            } catch (Throwable $notifError) {
                error_log('Failed to send enrollment notification: ' . $notifError->getMessage());
                error_log('Notification error stack: ' . $notifError->getTraceAsString());

                // Required side effects failed: rollback enrollment and return error.
                $this->cleanup_failed_enrollment_submission($enrollmentId, $createdStudentId);
                throw $notifError;
            }

            http_response_code(201);
            $submittedStatus = $isAdminCreated ? 'Under Review' : 'Pending';
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment submitted successfully',
                'enrollment_id' => $enrollmentId,
                'status' => $submittedStatus,
                'next_steps' => 'Your enrollment is under review. Please check back for updates.'
            ]);
        } catch (Throwable $e) {
            if (!empty($enrollmentId)) {
                $this->cleanup_failed_enrollment_submission($enrollmentId, $createdStudentId ?? null);
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get enrollment by ID
     * GET /api/enrollments/{id}
     */
    public function api_get_enrollment()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');

            $enrollmentId = uri_segments(3);

            if (!is_numeric($enrollmentId)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid enrollment ID']);
                return;
            }

            $enrollment = $this->EnrollmentModel->get_enrollment_with_details($enrollmentId);

            if (!$enrollment) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            // Check authorization (user can only view their own enrollments unless admin)
            if ($userId != $enrollment['created_user_id'] && $userRole !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $requiredDocumentsCount = $this->get_required_document_count_for_enrollment(
                $enrollment['grade_level'] ?? '',
                $enrollment['enrollment_type'] ?? ''
            );

            $verifiedDocumentsCount = 0;
            if (!empty($enrollment['documents']) && is_array($enrollment['documents'])) {
                foreach ($enrollment['documents'] as $doc) {
                    $isVerified = (($doc['verification_status'] ?? null) === 'Verified');
                    $isCurrentVersion = !isset($doc['is_current_version']) || (int)$doc['is_current_version'] === 1;

                    if ($isVerified && $isCurrentVersion) {
                        $verifiedDocumentsCount++;
                    }
                }
            }

            if ($requiredDocumentsCount > 0 && $verifiedDocumentsCount > $requiredDocumentsCount) {
                $verifiedDocumentsCount = $requiredDocumentsCount;
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $enrollment]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get enrollment status details
     * GET /api/enrollments/{id}/status
     * 
     * Returns enrollment details with timeline and document verification status
     */
    public function api_get_enrollment_status()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');

            // Robustly extract enrollment ID from URL: /api/enrollments/{id}/status
            $enrollmentId = segment(3);
            
            if (!is_numeric($enrollmentId)) {
                $uri = trim($_SERVER['REQUEST_URI'], '/');
                $parts = explode('/', $uri);
                // Search for the first numeric part assume it's the ID
                foreach ($parts as $part) {
                    if (is_numeric($part)) {
                        $enrollmentId = $part;
                        break;
                    }
                }
            }

            if (!is_numeric($enrollmentId)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid enrollment ID: ' . $enrollmentId]);
                return;
            }

            // Debug: Log the enrollment ID being searched
            error_log("Searching for enrollment ID: " . $enrollmentId);

            $enrollment = $this->EnrollmentModel->get_enrollment_with_details($enrollmentId);
            
            // Debug: Log what was found
            error_log("Enrollment found: " . ($enrollment ? "YES" : "NO"));
            if ($enrollment) {
                error_log("Enrollment data: " . print_r($enrollment, true));
            }

            if (!$enrollment) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            // Check authorization (user can only view their own enrollments unless admin)
            if ($userId != $enrollment['created_user_id'] && $userRole !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $requiredDocumentsCount = $this->get_required_document_count_for_enrollment(
                $enrollment['grade_level'] ?? '',
                $enrollment['enrollment_type'] ?? ''
            );

            $verifiedDocumentsCount = 0;
            if (!empty($enrollment['documents']) && is_array($enrollment['documents'])) {
                foreach ($enrollment['documents'] as $doc) {
                    $isVerified = (($doc['verification_status'] ?? null) === 'Verified');
                    $isCurrentVersion = !isset($doc['is_current_version']) || (int)$doc['is_current_version'] === 1;

                    if ($isVerified && $isCurrentVersion) {
                        $verifiedDocumentsCount++;
                    }
                }
            }

            if ($requiredDocumentsCount > 0 && $verifiedDocumentsCount > $requiredDocumentsCount) {
                $verifiedDocumentsCount = $requiredDocumentsCount;
            }

            // Determine latest document verification timestamp for this enrollment
            $latestDocumentVerifiedDate = null;
            if (!empty($enrollment['documents']) && is_array($enrollment['documents'])) {
                foreach ($enrollment['documents'] as $doc) {
                    $docStatus = $doc['verification_status'] ?? null;
                    if ($docStatus !== 'Verified') {
                        continue;
                    }

                    $candidateDate = $doc['verified_date'] ?? $doc['updated_at'] ?? null;
                    if (empty($candidateDate)) {
                        continue;
                    }

                    if (
                        $latestDocumentVerifiedDate === null ||
                        strtotime($candidateDate) > strtotime($latestDocumentVerifiedDate)
                    ) {
                        $latestDocumentVerifiedDate = $candidateDate;
                    }
                }
            }

            // Fallback for records marked as Verified with no per-document verified_date available
            if (
                $latestDocumentVerifiedDate === null &&
                ($enrollment['status'] ?? null) === 'Verified' &&
                !empty($enrollment['updated_at'])
            ) {
                $latestDocumentVerifiedDate = $enrollment['updated_at'];
            }

            // Build timeline based on enrollment status
            $timeline = [];
            if (!empty($enrollment['created_date'])) {
                $timeline[] = [
                    'date' => $enrollment['created_date'],
                    'event' => 'Application submitted'
                ];
            } elseif (!empty($enrollment['created_at'])) {
                $timeline[] = [
                    'date' => $enrollment['created_at'],
                    'event' => 'Application submitted'
                ];
            }
            if (!empty($latestDocumentVerifiedDate)) {
                $documentsTimelineEvent = 'Documents verified';

                if ($requiredDocumentsCount > 0) {
                    if ($verifiedDocumentsCount >= $requiredDocumentsCount) {
                        $documentsTimelineEvent = 'All required documents verified';
                    } else {
                        $documentsTimelineEvent = "Document verification in progress ({$verifiedDocumentsCount}/{$requiredDocumentsCount})";
                    }
                }

                $timeline[] = [
                    'date' => $latestDocumentVerifiedDate,
                    'event' => $documentsTimelineEvent
                ];
            }
            if (!empty($enrollment['first_reviewed_date'])) {
                $timeline[] = [
                    'date' => $enrollment['first_reviewed_date'],
                    'event' => 'Application under review'
                ];
            }
            if (!empty($enrollment['approved_date'])) {
                $timeline[] = [
                    'date' => $enrollment['approved_date'],
                    'event' => 'Application approved'
                ];
            }
            if (!empty($enrollment['rejected_date'])) {
                $timeline[] = [
                    'date' => $enrollment['rejected_date'],
                    'event' => 'Application rejected'
                ];
            }

            // Prepare response with enrollment status details
            $confirmationNumber = isset($enrollment['confirmation_number']) ? $enrollment['confirmation_number'] : null;
            if (!$confirmationNumber) {
                $sy = $enrollment['school_year'] ?? '';
                // Extract 4 digits from school_year (e.g. "2025-2026" -> "2025")
                preg_match('/\d{4}/', $sy, $matches);
                $year = !empty($matches) ? $matches[0] : '0000';
                $confirmationNumber = 'APP-' . $year . str_pad($enrollmentId, 3, '0', STR_PAD_LEFT);
            }

            $enrollmentStatus = [
                'id' => $enrollment['id'],
                'confirmation_number' => $confirmationNumber,
                'status' => $enrollment['status'] ?? 'Pending',
                'enrollment_type' => $enrollment['enrollment_type'] ?? null,
                'submitted_date' => $enrollment['submitted_date'] ?? $enrollment['created_at'] ?? $enrollment['created_date'] ?? null,
                'first_reviewed_date' => $enrollment['first_reviewed_date'] ?? null,
                'approved_date' => $enrollment['approved_date'] ?? null,
                'rejected_date' => $enrollment['rejected_date'] ?? null,
                'student_name' => $enrollment['student_name'] ?? (trim(($enrollment['learner']['first_name'] ?? '') . ' ' . ($enrollment['learner']['last_name'] ?? '')) ?: (trim(($enrollment['user_first_name'] ?? '') . ' ' . ($enrollment['user_last_name'] ?? '')) ?: 'Unknown')),
                'grade_level' => $enrollment['grade_level'] ?? '',
                'school_year' => $enrollment['school_year'] ?? '',
                'timeline' => $timeline,
                'next_steps' => $this->get_next_steps($enrollment['status'] ?? 'Pending'),
                'rejection_reason' => $enrollment['rejection_reason'] ?? null,
                'documents' => array_map(function($doc) {
                    return [
                        'type' => $doc['document_type'],
                        'status' => $doc['verification_status'],
                        'uploaded' => $doc['upload_date'],
                        'verified' => $doc['verified_date'] ?? null
                    ];
                }, $enrollment['documents'] ?? []),
                'documents_count' => $requiredDocumentsCount,
                'documents_verified' => $verifiedDocumentsCount,
                'created_student_id' => $enrollment['created_student_id'] ?? null
            ];

            http_response_code(200);
            $json = json_encode(['success' => true, 'enrollment' => $enrollmentStatus]);
            if ($json === false) {
                echo json_encode(['success' => false, 'message' => 'JSON Error: ' . json_last_error_msg()]);
            } else {
                echo $json;
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get all enrollments (admin only or user's own)
     * GET /api/enrollments
     */
    public function api_get_enrollments()
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

            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');

            $page = $_GET['page'] ?? 1;
            $limit = $_GET['limit'] ?? 20;
            $status = $_GET['status'] ?? null;

            if ($userRole === 'admin') {
                // Admins see all enrollments
                $result = $this->EnrollmentModel->get_enrollments($page, $limit, $status);
            } else {
                // Users see only their own enrollments
                $enrollments = $this->EnrollmentModel->get_enrollments_by_user($userId);
                // Ensure enrollments is an array, default to empty array if false/null
                $enrollmentsArray = is_array($enrollments) ? $enrollments : [];
                $totalCount = count($enrollmentsArray);
                $result = [
                    'data' => $enrollmentsArray,
                    'total' => $totalCount,
                    'page' => 1,
                    'limit' => $totalCount,
                    'pages' => $totalCount > 0 ? 1 : 0
                ];
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $result]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get enrollment statistics (admin only)
     * GET /api/enrollments/stats
     */
    public function api_get_enrollment_stats()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userRole = $this->session->userdata('role');
            if ($userRole !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $stats = $this->EnrollmentModel->get_enrollment_stats();

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $stats]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get payments for an enrollment
     * GET /api/enrollments/{id}/payments
     */
    public function api_get_enrollment_payments()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');
            
            $enrollmentId = segment(3);
            
            // If segment retrieval fails (depending on routing setup), try parsing URI
            if (!is_numeric($enrollmentId)) {
                $uri = trim($_SERVER['REQUEST_URI'], '/');
                $parts = explode('/', $uri);
                // Look for numeric part assuming /api/enrollments/{id}/payments
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

            // Verify enrollment exists and user has access
            // We use get_enrollment_with_details to check ownership
            $enrollment = $this->EnrollmentModel->get_enrollment_with_details($enrollmentId);

            if (!$enrollment) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            if ($userId != $enrollment['created_user_id'] && $userRole !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $data = $this->EnrollmentModel->get_enrollment_payments($enrollmentId);

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Update enrollment status (admin only)
     * PUT /api/enrollments/{id}/status
     */
    public function api_update_enrollment_status()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');
            if ($userRole !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $enrollmentId = segment(3);
            $input = json_decode(file_get_contents('php://input'), true);

            if (!isset($input['status'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Status is required']);
                return;
            }

            $validStatuses = ['Pending', 'Incomplete', 'Under Review', 'Verified', 'Approved', 'Rejected'];
            if (!in_array($input['status'], $validStatuses)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid status']);
                return;
            }

            $updated = $this->EnrollmentModel->update_status($enrollmentId, $input['status'], $userId);

            if (!$updated) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            // Mark ALL admin notifications as read when any admin takes action
            // This ensures Admin2 doesn't see stale notifications after Admin1 processed the enrollment
            try {
                $this->markAllAdminNotificationsAsRead('enrollment', $enrollmentId);
            } catch (Exception $notifError) {
                error_log('Failed to mark enrollment notification as read: ' . $notifError->getMessage());
                // Don't fail the status update if notification update fails
            }

            // log_activity($userId, 'enrollment_status_updated', "Enrollment {$enrollmentId} status changed to {$input['status']}", ['enrollment_id' => $enrollmentId]);

            // Notify enrollee/student via email for each admin step status update.
            $this->send_enrollment_status_email($enrollmentId, $input['status']);

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Enrollment status updated']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Validate enrollment input
     * @param array $input
     * @return array Errors array
     */
    private function validate_enrollment_input($input)
    {
        $errors = [];

        // Learner info validation
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

        // Address validation
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

        // Parent contact validation
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

        // Create upload directory if it doesn't exist
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Allowed file types
        $allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx'];
        $maxFileSize = 5 * 1024 * 1024; // 5MB

        // Handle single file or array of files
        $fileArray = is_array($files['name']) ? $files : [$files];

        foreach ($fileArray as $key => $file) {
            if (!isset($file['tmp_name']) || empty($file['tmp_name'])) {
                continue;
            }

            // Validate file
            $fileInfo = pathinfo($file['name']);
            $ext = strtolower($fileInfo['extension']);

            if (!in_array($ext, $allowedTypes)) {
                continue; // Skip invalid file types
            }

            if ($file['size'] > $maxFileSize) {
                continue; // Skip oversized files
            }

            // Generate unique filename
            $newFileName = 'enrollment_' . uniqid() . '.' . $ext;
            $uploadPath = $uploadDir . $newFileName;

            // Move uploaded file
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
     * Get next steps message based on enrollment status
     * 
     * @param string $status The enrollment status
     * @return string Next steps message
     */
    private function get_next_steps($status)
    {
        $nextSteps = [
            'Pending' => 'Please wait for our review. We will contact you soon with updates.',
            'Incomplete' => 'Please submit all required documents to proceed with your application.',
            'Under Review' => 'Your application is being reviewed. We will notify you of the decision shortly.',
            'Verified' => 'Your documents are verified. Your enrollment is waiting for final approval.',
            'Approved' => 'Congratulations! Your enrollment has been approved. Please proceed to payment.',
            'Rejected' => 'Unfortunately, your application was not approved. Please contact the admissions office for more information.'
        ];

        return $nextSteps[$status] ?? 'Please wait for further updates on your application.';
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

    private function get_required_document_count_for_enrollment($gradeLevel, $enrollmentType)
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

        $requirements = $this->DocumentRequirement_model->get_active_requirements();

        if (!is_array($requirements) || empty($requirements)) {
            return 0;
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

            if (!isset($bestByDocument[$docKey]) || $score > $bestByDocument[$docKey]) {
                $bestByDocument[$docKey] = $score;
            }
        }

        return count($bestByDocument);
    }

    /**
     * Get latest enrollment for a user (for pre-populating returning student forms)
     * GET /api/enrollments/latest
     */
    public function api_get_latest_enrollment()
    {
        api_set_json_headers();
        
        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');
            $studentName = isset($_GET['student_name']) ? trim($_GET['student_name']) : null;
            $studentId = isset($_GET['student_id']) ? trim($_GET['student_id']) : null;
            $lookupUserId = isset($_GET['user_id']) ? trim($_GET['user_id']) : null;

            // Build WHERE clause based on context
            $whereClause = '';
            $params = [];

            if ($userRole === 'admin' && !empty($studentId)) {
                $whereClause = "WHERE e.created_student_id = ? AND e.status IN ('Approved', 'Verified', 'Pending')";
                $params = [$studentId];
            } elseif ($userRole === 'admin' && !empty($lookupUserId)) {
                $whereClause = "WHERE e.created_user_id = ? AND e.status IN ('Approved', 'Verified', 'Pending')";
                $params = [$lookupUserId];
            } elseif ($studentName && $userRole === 'admin') {
                // Admin searching by student name - split into words for better matching
                $nameParts = preg_split('/\s+/', $studentName, -1, PREG_SPLIT_NO_EMPTY);
                $searchTerms = array_map(fn($part) => '%' . $part . '%', $nameParts);
                
                // Build dynamic WHERE clause with OR conditions for each name part
                $orConditions = [];
                foreach ($searchTerms as $searchTerm) {
                    $orConditions[] = "(el.first_name LIKE ? OR el.last_name LIKE ? OR el.middle_name LIKE ?)";
                    $params[] = $searchTerm;
                    $params[] = $searchTerm;
                    $params[] = $searchTerm;
                }
                
                $whereClause = "
                    WHERE (" . implode(" OR ", $orConditions) . ")
                    AND e.status IN ('Approved', 'Verified', 'Pending')
                ";
            } else {
                // Regular user - search their own enrollments
                $whereClause = "WHERE e.created_user_id = ? AND e.status IN ('Approved', 'Verified')";
                $params = [$userId];
            }

            // Get the latest enrollment
            $query = "
                SELECT 
                    e.id,
                    e.grade_level,
                    e.enrollment_type,
                    e.status,
                    COALESCE(e.submitted_date, e.created_at) AS submitted_date,
                    el.first_name as learner_first_name,
                    el.middle_name as learner_middle_name,
                    el.last_name as learner_last_name,
                    el.birth_date,
                    el.gender,
                    el.psa_birth_cert_number,
                    ef.is_indigenous_ip,
                    ef.is_4ps_beneficiary,
                    ef.has_disability,
                    ef.disability_type,
                    ef.special_language
                FROM enrollments e
                LEFT JOIN enrollment_learners el ON e.id = el.enrollment_id
                LEFT JOIN enrollment_flags ef ON e.id = ef.enrollment_id
                $whereClause
                ORDER BY e.id DESC
                LIMIT 1
            ";
            
            $stmt = $this->db->raw($query, $params);
            $enrollment = $stmt->fetch();

            if (!$enrollment) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'has_previous_enrollment' => false,
                    'is_first_timer' => true,
                    'data' => null
                ]);
                return;
            }

            // Get addresses
            $addressQuery = "
                SELECT address_type, address, barangay, municipality, province, zip_code, phone
                FROM enrollment_addresses
                WHERE enrollment_id = ?
            ";
            $addressStmt = $this->db->raw($addressQuery, [$enrollment['id']]);
            $addresses = $addressStmt->fetchAll();

            // Get parent contacts
            $contactQuery = "
                SELECT contact_type, name, phone, email
                FROM enrollment_parent_contacts
                WHERE enrollment_id = ?
            ";
            $contactStmt = $this->db->raw($contactQuery, [$enrollment['id']]);
            $contacts = $contactStmt->fetchAll();

            // Flatten addresses
            $flattenedData = [
                'enrollment_id' => $enrollment['id'],
                'enrollment_type' => $enrollment['enrollment_type'],
                'status' => $enrollment['status'],
                'grade_level' => $enrollment['grade_level'],
                'submitted_date' => $enrollment['submitted_date'],
                'learner_first_name' => $enrollment['learner_first_name'],
                'learner_middle_name' => $enrollment['learner_middle_name'],
                'learner_last_name' => $enrollment['learner_last_name'],
                'birth_date' => $enrollment['birth_date'],
                'gender' => $enrollment['gender'],
                'psa_birth_cert_number' => $enrollment['psa_birth_cert_number'],
                'is_indigenous_ip' => (bool)$enrollment['is_indigenous_ip'],
                'is_4ps_beneficiary' => (bool)$enrollment['is_4ps_beneficiary'],
                'has_disability' => (bool)$enrollment['has_disability'],
                'disability_type' => $enrollment['disability_type'],
                'special_language' => $enrollment['special_language'],
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
                'same_as_current' => false,
                'father_name' => null,
                'father_contact' => null,
                'father_email' => null,
                'mother_name' => null,
                'mother_contact' => null,
                'mother_email' => null,
                'guardian_name' => null,
                'guardian_contact' => null,
                'guardian_email' => null
            ];

            // Process addresses
            foreach ($addresses as $addr) {
                if ($addr['address_type'] === 'Current') {
                    $flattenedData['current_address'] = $addr['address'];
                    $flattenedData['current_barangay'] = $addr['barangay'];
                    $flattenedData['current_municipality'] = $addr['municipality'];
                    $flattenedData['current_province'] = $addr['province'];
                    $flattenedData['current_zip_code'] = $addr['zip_code'];
                    $flattenedData['current_phone'] = $addr['phone'];
                } elseif ($addr['address_type'] === 'Permanent') {
                    $flattenedData['permanent_address'] = $addr['address'];
                    $flattenedData['permanent_barangay'] = $addr['barangay'];
                    $flattenedData['permanent_municipality'] = $addr['municipality'];
                    $flattenedData['permanent_province'] = $addr['province'];
                    $flattenedData['permanent_zip_code'] = $addr['zip_code'];
                }
            }

            // Check if same as current
            if ($flattenedData['permanent_address'] && $flattenedData['current_address']) {
                $flattenedData['same_as_current'] = (
                    $flattenedData['permanent_address'] === $flattenedData['current_address'] &&
                    $flattenedData['permanent_barangay'] === $flattenedData['current_barangay'] &&
                    $flattenedData['permanent_municipality'] === $flattenedData['current_municipality'] &&
                    $flattenedData['permanent_province'] === $flattenedData['current_province']
                );
            }

            // Process contacts
            foreach ($contacts as $contact) {
                if ($contact['contact_type'] === 'Father') {
                    $flattenedData['father_name'] = $contact['name'];
                    $flattenedData['father_contact'] = $contact['phone'];
                    $flattenedData['father_email'] = $contact['email'];
                } elseif ($contact['contact_type'] === 'Mother') {
                    $flattenedData['mother_name'] = $contact['name'];
                    $flattenedData['mother_contact'] = $contact['phone'];
                    $flattenedData['mother_email'] = $contact['email'];
                } elseif ($contact['contact_type'] === 'Guardian') {
                    $flattenedData['guardian_name'] = $contact['name'];
                    $flattenedData['guardian_contact'] = $contact['phone'];
                    $flattenedData['guardian_email'] = $contact['email'];
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'has_previous_enrollment' => true,
                'is_first_timer' => false,
                'data' => $flattenedData
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get current grade and calculate next grade for returning students
     * GET /api/students/current-grade
     */
    public function api_get_current_grade()
    {
        api_set_json_headers();
        
        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');

            // Get current grade from students table
            $query = "SELECT year_level, status FROM students WHERE user_id = ? LIMIT 1";
            $stmt = $this->db->raw($query, [$userId]);
            $student = $stmt->fetch();

            if (!$student) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Student record not found']);
                return;
            }

            $currentGrade = $student['year_level'];
            $studentStatus = $student['status'] ?? 'active';
            
            // Grade progression mapping
            $gradeProgression = [
                'Nursery 1' => 'Nursery 2',
                'Nursery 2' => 'Kinder',
                'Kinder' => 'Grade 1',
                'Grade 1' => 'Grade 2',
                'Grade 2' => 'Grade 3',
                'Grade 3' => 'Grade 4',
                'Grade 4' => 'Grade 5',
                'Grade 5' => 'Grade 6',
                'Grade 6' => 'Graduated'
            ];

            $nextGrade = $gradeProgression[$currentGrade] ?? $currentGrade;
            $canEnroll = $studentStatus !== 'graduated' && $nextGrade !== 'Graduated';

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'current_grade' => $currentGrade,
                'next_grade' => $nextGrade,
                'can_enroll' => $canEnroll
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Auto-create enrollment for continuing student from past enrollment
     * POST /api/enrollments/auto-create-continuing
     * 
     * Body: {
     *   "past_enrollment_id": 12,
     *   "enrollment_period_id": 2,
     *   "new_grade_level": "Grade 2"
     * }
     */
    public function api_auto_create_continuing()
    {
        api_set_json_headers();

        try {
            // Check authentication
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $input = json_decode(file_get_contents('php://input'), true) ?? [];

            if (empty($input)) {
                $input = $_POST; // Fallback to POST
            }

            // Validate required fields
            $pastEnrollmentId = $input['past_enrollment_id'] ?? null;
            $enrollmentPeriodId = $input['enrollment_period_id'] ?? null;
            $newGradeLevel = $input['new_grade_level'] ?? null;

            if (!$pastEnrollmentId || !$enrollmentPeriodId || !$newGradeLevel) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields: past_enrollment_id, enrollment_period_id, new_grade_level'
                ]);
                return;
            }

            // Create enrollment from past enrollment
            $newEnrollmentId = $this->EnrollmentModel->create_continuing_from_past(
                $pastEnrollmentId,
                $enrollmentPeriodId,
                $newGradeLevel,
                $userId
            );

            if (!$newEnrollmentId) {
                throw new Exception('Failed to create continuing enrollment');
            }

            // Get the new enrollment details
            $newEnrollment = $this->EnrollmentModel->get_enrollment_with_details($newEnrollmentId);

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment created successfully',
                'enrollment_id' => $newEnrollmentId,
                'enrollment' => $newEnrollment
            ]);
        } catch (Exception $e) {
            error_log('Auto-create continuing enrollment error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get past enrollment preview for continuing student
     * GET /api/enrollments/{id}/preview-for-continuing
     * Shows the data that will be auto-filled for the next enrollment period
     */
    public function api_get_enrollment_preview_for_continuing($enrollmentId)
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $userId = $this->session->userdata('user_id');
            $statusQuery = "SELECT status FROM students WHERE user_id = ? LIMIT 1";
            $statusStmt = $this->db->raw($statusQuery, [$userId]);
            $statusRow = $statusStmt->fetch();

            if ($statusRow && ($statusRow['status'] ?? '') === 'graduated') {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student has graduated and cannot continue enrollment'
                ]);
                return;
            }

            $enrollment = $this->EnrollmentModel->get_enrollment_with_details($enrollmentId);

            if (!$enrollment) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Enrollment not found']);
                return;
            }

            // Get next grade level
            $gradeProgression = [
                'Nursery 1' => 'Nursery 2',
                'Nursery 2' => 'Kinder',
                'Kinder' => 'Grade 1',
                'Grade 1' => 'Grade 2',
                'Grade 2' => 'Grade 3',
                'Grade 3' => 'Grade 4',
                'Grade 4' => 'Grade 5',
                'Grade 5' => 'Grade 6',
                'Grade 6' => 'Graduated'
            ];

            $nextGrade = $gradeProgression[$enrollment['grade_level']] ?? $enrollment['grade_level'];

            if ($nextGrade === 'Graduated') {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student has graduated and cannot continue enrollment'
                ]);
                return;
            }

            // Return preview data
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'enrollment_id' => $enrollment['id'],
                'learner' => [
                    'first_name' => $enrollment['learner']['first_name'] ?? '',
                    'middle_name' => $enrollment['learner']['middle_name'] ?? '',
                    'last_name' => $enrollment['learner']['last_name'] ?? '',
                    'birth_date' => $enrollment['learner']['birth_date'] ?? '',
                    'gender' => $enrollment['learner']['gender'] ?? ''
                ],
                'current_grade' => $enrollment['grade_level'],
                'next_grade' => $nextGrade,
                'addresses' => $enrollment['addresses'] ?? [],
                'contacts' => $enrollment['contacts'] ?? [],
                'flags' => [
                    'is_indigenous_ip' => $enrollment['flags']['is_indigenous_ip'] ?? 0,
                    'is_4ps_beneficiary' => $enrollment['flags']['is_4ps_beneficiary'] ?? 0,
                    'has_disability' => $enrollment['flags']['has_disability'] ?? 0
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Get enrollment discounts
     * GET /api/enrollments/{id}/discounts
     */
    public function api_get_enrollment_discounts()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Extract enrollment ID from URL: /api/enrollments/{id}/discounts
            $enrollmentId = segment(3);
            if (!is_numeric($enrollmentId)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid enrollment ID']);
                return;
            }

            // Use raw SQL for LEFT JOIN to avoid malformed query-builder output (e.g., leftJOIN)
            $sql = "SELECT ed.*, 
                           dt.name as template_name, 
                           dt.type as template_type, 
                           dt.value as template_value,
                           dt.value_type as template_value_type
                    FROM enrollment_discounts ed
                    LEFT JOIN discount_templates dt ON ed.template_id = dt.id
                    WHERE ed.enrollment_id = ?";

            $stmt = $this->db->raw($sql, [$enrollmentId]);
            $discounts = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

            echo json_encode([
                'success' => true,
                'data' => $discounts
            ]);
        } catch (Exception $e) {
            error_log('Get enrollment discounts error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Create enrollment discount record
     * POST /api/enrollments/{id}/discounts
     * 
     * Called when a student makes a full payment with a discount applied
     * Body: {
     *   "enrollment_id": 1,
     *   "discount_template_id": 0,
     *   "discount_name": "Full Payment Discount",
     *   "discount_type": "Fixed Amount" | "Percentage",
     *   "discount_value": 500 | 10,
     *   "discount_amount": 500,
     *   "payment_id": 123,
     *   "notes": "Applied at payment submission"
     * }
     */
    public function api_create_enrollment_discount()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Extract enrollment ID from URL: /api/enrollments/{id}/discounts
            $enrollmentId = segment(3);
            if (!is_numeric($enrollmentId)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid enrollment ID']);
                return;
            }

            // Get request data
            $data = json_decode(file_get_contents('php://input'), true);

            if (!$data) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No input data provided']);
                return;
            }

            // Validate required fields
            if (empty($data['discount_amount']) || $data['discount_amount'] <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid discount amount']);
                return;
            }

            // For now, we don't require a template_id. If not provided or 0, use NULL
            $templateId = isset($data['discount_template_id']) && $data['discount_template_id'] > 0 ? $data['discount_template_id'] : null;

            // Prepare data for insertion
            $insertData = [
                'enrollment_id' => $enrollmentId,
                'template_id' => $templateId,
                'payment_id' => isset($data['payment_id']) ? $data['payment_id'] : null,
                'applied_amount' => $data['discount_amount'],
                'created_at' => app_now()
            ];

            // Insert into enrollment_discounts table
            $result = $this->db->table('enrollment_discounts')->insert($insertData);

            if ($result) {
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Enrollment discount record created successfully',
                    'data' => [
                        'id' => $result,
                        'enrollment_id' => $enrollmentId,
                        'payment_id' => $insertData['payment_id'],
                        'discount_amount' => $data['discount_amount'],
                        'discount_name' => $data['discount_name'] ?? 'Discount',
                        'discount_type' => $data['discount_type'] ?? 'Fixed Amount',
                        'notes' => $data['notes'] ?? null
                    ]
                ]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create enrollment discount record']);
            }
        } catch (Exception $e) {
            error_log('Create enrollment discount error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Update enrollment discount record (link to payment)
     * PUT /api/enrollments/{enrollment_id}/discounts/{discount_id}
     * 
     * Body: {
     *   "payment_id": 123
     * }
     */
    public function api_update_enrollment_discount()
    {
        api_set_json_headers();

        try {
            if (!$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Extract enrollment ID and discount ID from URL: /api/enrollments/{enrollment_id}/discounts/{discount_id}
            $enrollmentId = segment(3);
            $discountId = segment(5);
            
            if (!is_numeric($enrollmentId) || !is_numeric($discountId)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid enrollment or discount ID']);
                return;
            }

            // Get request data
            $data = json_decode(file_get_contents('php://input'), true);

            if (!$data) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No input data provided']);
                return;
            }

            // Prepare update data
            $updateData = [];
            if (isset($data['payment_id'])) {
                $updateData['payment_id'] = $data['payment_id'];
            }

            if (empty($updateData)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No valid fields to update']);
                return;
            }

            // Update the enrollment_discounts record
            $result = $this->db->table('enrollment_discounts')
                ->where('id', $discountId)
                ->where('enrollment_id', $enrollmentId)
                ->update($updateData);

            if ($result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Enrollment discount updated successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Discount record not found or no changes made']);
            }
        } catch (Exception $e) {
            error_log('Update enrollment discount error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Mark ALL admin notifications as read for a given entity
     * This ensures multi-admin synchronization: when Admin1 takes action,
     * Admin2's notification is also marked as read to prevent stale notifications
     * 
     * @param string $entityType Entity type (e.g., 'payment', 'enrollment')
     * @param int $entityId Entity ID
     */
    private function markAllAdminNotificationsAsRead($entityType, $entityId)
    {
        try {
            $this->db->table('notifications')
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->where('is_read', 0)
                ->update([
                    'is_read' => 1,
                    'read_at' => app_now()
                ]);
        } catch (Exception $e) {
            error_log('Failed to mark all admin notifications as read: ' . $e->getMessage());
            // Don't fail the main operation if notification sync fails
        }
    }
}
