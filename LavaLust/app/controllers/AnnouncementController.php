<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AnnouncementController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->model('AnnouncementModel');
        $this->call->library('session');
        $this->call->library('NotificationService');
    }

    private function get_current_user_id()
    {
        return (int)($this->session->userdata('user_id') ?? 0);
    }

    private function get_current_role()
    {
        return (string)($this->session->userdata('role') ?? '');
    }

    private function can_manage_announcements($role)
    {
        return in_array($role, ['admin', 'teacher'], true);
    }

    private function allowed_audiences_for_role($role)
    {
        if ($role === 'teacher') {
            return ['students', 'my_students', 'my_classes', 'parents_of_my_students'];
        }

        return ['all', 'students', 'teachers', 'parents', 'staff'];
    }

    private function is_owner_or_admin($announcement, $role, $user_id)
    {
        if ($role === 'admin') {
            return true;
        }

        return $role === 'teacher' && (int)($announcement['created_by'] ?? 0) === (int)$user_id;
    }

    private function normalize_metadata_input($metadata)
    {
        if (is_array($metadata)) return $metadata;
        if (is_object($metadata)) return (array)$metadata;
        if (is_string($metadata)) {
            $decoded = json_decode($metadata, true);
            if (json_last_error() === JSON_ERROR_NONE) return $decoded;
        }
        return null;
    }

    private function get_teacher_record($user_id)
    {
        $this->call->model('TeacherModel');
        return $this->TeacherModel->get_by_user_id($user_id);
    }

    private function get_teacher_subject_assignments($teacher_id)
    {
        $this->call->model('TeacherSubjectAssignmentModel');
        $this->call->model('AcademicPeriodModel');

        $schoolYear = null;
        try {
            $period = $this->AcademicPeriodModel->get_active_period();
            $schoolYear = $period['school_year'] ?? null;
        } catch (Exception $e) {
            $schoolYear = null;
        }

        return $this->TeacherSubjectAssignmentModel->get_teacher_subjects($teacher_id, $schoolYear);
    }

    private function validate_teacher_class_target($metadata, $user_id, &$normalized_metadata)
    {
        $normalized_metadata = $this->normalize_metadata_input($metadata);
        if (empty($normalized_metadata) || !is_array($normalized_metadata)) {
            return ['ok' => false, 'message' => 'Class target metadata is required'];
        }

        if (($normalized_metadata['scope'] ?? '') !== 'class') {
            return ['ok' => false, 'message' => 'Invalid announcement scope'];
        }

        $subject_id = $normalized_metadata['subject_id'] ?? null;
        $section_id = $normalized_metadata['section_id'] ?? null;
        if (empty($subject_id) || empty($section_id)) {
            return ['ok' => false, 'message' => 'Subject and section are required'];
        }

        $teacher = $this->get_teacher_record($user_id);
        if (!$teacher || empty($teacher['id'])) {
            return ['ok' => false, 'message' => 'Teacher record not found'];
        }

        $assignments = $this->get_teacher_subject_assignments($teacher['id']);
        $matched = null;
        foreach ($assignments as $assignment) {
            if ((string)($assignment['subject_id'] ?? '') === (string)$subject_id && (string)($assignment['section_id'] ?? '') === (string)$section_id) {
                $matched = $assignment;
                break;
            }
        }

        if (!$matched) {
            return ['ok' => false, 'message' => 'You are not assigned to the selected class', 'status' => 403];
        }

        $courseCode = trim((string)($matched['course_code'] ?? ''));
        $sectionName = trim((string)($matched['section_name'] ?? ''));
        $targetLabel = $normalized_metadata['target_label'] ?? '';
        if ($courseCode && $sectionName) {
            $targetLabel = $courseCode . ' — ' . $sectionName;
        }

        $normalized_metadata = [
            'scope' => 'class',
            'subject_id' => $subject_id,
            'section_id' => $section_id,
            'target_label' => $targetLabel,
        ];

        return ['ok' => true, 'message' => 'ok'];
    }

    private function get_students_for_class_target($section_id)
    {
        if (empty($section_id)) return [];

        $rows = $this->db->raw(
            'SELECT user_id FROM students WHERE section_id = ? AND status = ? AND user_id IS NOT NULL',
            [$section_id, 'active']
        )->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            return [];
        }

        return array_map(function($row) {
            return ['user_id' => (int)($row['user_id'] ?? 0), 'role' => 'student'];
        }, $rows);
    }

    // GET /api/announcements
    public function api_get_announcements()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $filters = [];
            if (!empty($_GET['audience'])) $filters['audience'] = $_GET['audience'];
            if (!empty($_GET['status'])) $filters['status'] = $_GET['status'];
            if (!empty($_GET['search'])) $filters['search'] = $_GET['search'];
            if (isset($_GET['include_expired'])) {
                $filters['include_expired'] = in_array(strtolower((string)$_GET['include_expired']), ['1', 'true', 'yes'], true);
            }

            $user_id = $this->get_current_user_id();
            $role = $this->get_current_role();

            if ($role === 'teacher') {
                $filters['created_by'] = $user_id;
            }

            if ($role === 'student') {
                $this->call->model('StudentModel');

                $filters['student_visibility'] = true;

                $student = $this->StudentModel->get_by_user_id($user_id);
                if (!empty($student['section_id'])) {
                    $filters['student_section_id'] = $student['section_id'];
                }
            }
            $list = $this->AnnouncementModel->get_all_with_read_status($filters, $user_id);

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $list, 'count' => is_array($list) ? count($list) : 0]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: '.$e->getMessage()]);
        }
    }

    // POST /api/announcements/{id}/mark-as-read
    public function api_mark_announcement_as_read($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->get_current_user_id();
            $existing = $this->AnnouncementModel->get_announcement($id);
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Announcement not found']);
                return;
            }

            $res = $this->AnnouncementModel->mark_as_read((int)$id, (int)$user_id);
            if ($res) {
                echo json_encode(['success' => true, 'message' => 'Marked as read']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to mark as read']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: '.$e->getMessage()]);
        }
    }

    // GET /api/announcements/{id}
    public function api_get_announcement($id)
    {
        api_set_json_headers();
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $ann = $this->AnnouncementModel->get_announcement($id);
            if (!$ann) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Announcement not found']);
                return;
            }
            $role = $this->get_current_role();
            $user_id = $this->get_current_user_id();
            if ($role === 'teacher' && !$this->is_owner_or_admin($ann, $role, $user_id)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }
            echo json_encode(['success' => true, 'data' => $ann]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: '.$e->getMessage()]);
        }
    }

    // POST /api/announcements
    public function api_create_announcement()
    {
        api_set_json_headers();

        $role = $this->get_current_role();
        if (!$this->session->userdata('logged_in') || !$this->can_manage_announcements($role)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['title']) || empty($data['message'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Title and message are required']);
                return;
            }

            if ($role === 'teacher') {
                $data['audience'] = 'students';
                $normalized_metadata = null;
                $validation = $this->validate_teacher_class_target($data['metadata'] ?? null, $this->get_current_user_id(), $normalized_metadata);
                if (!$validation['ok']) {
                    http_response_code($validation['status'] ?? 422);
                    echo json_encode(['success' => false, 'message' => $validation['message']]);
                    return;
                }
                $data['metadata'] = $normalized_metadata;
            }

            $allowedAudiences = $this->allowed_audiences_for_role($role);
            if (!empty($data['audience']) && !in_array($data['audience'], $allowedAudiences, true)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'Invalid audience for role']);
                return;
            }

            $data['created_by'] = $this->get_current_user_id();
            $newId = $this->AnnouncementModel->create($data);

            if ($newId) {
                $created = $this->AnnouncementModel->get_announcement($newId);
                if ($role === 'teacher') {
                    $metadata = $created['metadata'] ?? null;
                    $subject_id = $metadata['subject_id'] ?? null;
                    $section_id = $metadata['section_id'] ?? null;
                    $target_label = $metadata['target_label'] ?? '';

                    if (!empty($section_id)) {
                        $recipients = $this->get_students_for_class_target($section_id);
                        if (!empty($recipients)) {
                            $teacherName = trim((string)$this->session->userdata('first_name') . ' ' . (string)$this->session->userdata('last_name'));
                            if ($teacherName === '') {
                                $teacherName = 'Teacher #' . $this->get_current_user_id();
                            }

                            $notificationResult = $this->NotificationService->create([
                                'actor_user_id' => $this->get_current_user_id(),
                                'actor_role' => 'teacher',
                                'actor_name' => $teacherName,
                                'action' => 'announcement.created',
                                'entity_type' => 'announcement',
                                'entity_id' => (int)$newId,
                                'description' => $teacherName . ' posted a class announcement',
                                'metadata' => [
                                    'announcement_id' => (int)$newId,
                                    'subject_id' => $subject_id,
                                    'section_id' => $section_id,
                                    'target_label' => $target_label,
                                ],
                                'type' => 'announcement.created',
                                'title' => 'New Class Announcement',
                                'body' => (string)($created['title'] ?? 'New class announcement'),
                                'icon' => 'megaphone',
                                'action_url' => '/student/announcements',
                                'notification_data' => [
                                    'action' => 'view_announcement',
                                    'announcement_id' => (string)$newId,
                                    'subject_id' => (string)$subject_id,
                                    'section_id' => (string)$section_id,
                                ],
                                'push_data' => [
                                    'action' => 'view_announcement',
                                    'announcement_id' => (string)$newId,
                                    'subject_id' => (string)$subject_id,
                                    'section_id' => (string)$section_id,
                                ],
                                'recipients' => $recipients,
                            ]);

                            if (empty($notificationResult['success'])) {
                                error_log('Announcement notification create failed: ' . ($notificationResult['error'] ?? 'unknown'));
                            }
                        }
                    }
                }
                http_response_code(201);
                echo json_encode(['success' => true, 'message' => 'Announcement created', 'data' => $created]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create announcement']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: '.$e->getMessage()]);
        }
    }

    // PUT /api/announcements/{id}
    public function api_update_announcement($id)
    {
        api_set_json_headers();

        $role = $this->get_current_role();
        if (!$this->session->userdata('logged_in') || !$this->can_manage_announcements($role)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $existing = $this->AnnouncementModel->get_announcement($id);
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Announcement not found']);
                return;
            }

            $user_id = $this->get_current_user_id();
            if ($role === 'teacher' && !$this->is_owner_or_admin($existing, $role, $user_id)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $data = json_decode(file_get_contents('php://input'), true);

            if ($role === 'teacher') {
                $data['audience'] = 'students';
                $metadataInput = array_key_exists('metadata', $data) ? $data['metadata'] : ($existing['metadata'] ?? null);
                $normalized_metadata = null;
                $validation = $this->validate_teacher_class_target($metadataInput, $this->get_current_user_id(), $normalized_metadata);
                if (!$validation['ok']) {
                    http_response_code($validation['status'] ?? 422);
                    echo json_encode(['success' => false, 'message' => $validation['message']]);
                    return;
                }
                $data['metadata'] = $normalized_metadata;
            }
            $allowedAudiences = $this->allowed_audiences_for_role($role);
            if (!empty($data['audience']) && !in_array($data['audience'], $allowedAudiences, true)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'Invalid audience for role']);
                return;
            }
            $res = $this->AnnouncementModel->update_announcement($id, $data);
            if ($res) {
                $updated = $this->AnnouncementModel->get_announcement($id);
                echo json_encode(['success' => true, 'message' => 'Announcement updated', 'data' => $updated]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update announcement']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: '.$e->getMessage()]);
        }
    }

    // DELETE /api/announcements/{id}
    public function api_delete_announcement($id)
    {
        api_set_json_headers();

        $role = $this->get_current_role();
        if (!$this->session->userdata('logged_in') || !$this->can_manage_announcements($role)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $existing = $this->AnnouncementModel->get_announcement($id);
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Announcement not found']);
                return;
            }

            $user_id = $this->get_current_user_id();
            if ($role === 'teacher' && !$this->is_owner_or_admin($existing, $role, $user_id)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $res = $this->AnnouncementModel->delete_announcement($id);
            if ($res) {
                echo json_encode(['success' => true, 'message' => 'Announcement archived']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to archive announcement']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: '.$e->getMessage()]);
        }
    }
}
