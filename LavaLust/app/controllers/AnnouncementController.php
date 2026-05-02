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
            return ['my_students', 'my_classes', 'parents_of_my_students'];
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
