<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class RFIDController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->model('RFIDSessionModel');
        $this->call->model('RFIDScanModel');
        $this->call->model('StudentModel');
        $this->call->library('session');
    }

    private function require_admin()
    {
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return false;
        }

        return true;
    }

    private function auto_close_expired_sessions()
    {
        $now = app_now();

        $this->db->raw(
            "UPDATE rfid_sessions\n"
            . "SET status = 'completed',\n"
            . "    actual_end = COALESCE(actual_end, ?),\n"
            . "    updated_at = ?\n"
            . "WHERE status = 'active'\n"
            . "  AND scheduled_end <= ?",
            [$now, $now, $now]
        );
    }

    public function api_sessions()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $this->auto_close_expired_sessions();
            $date = $_GET['date'] ?? app_today();
            $sessions = $this->RFIDSessionModel->get_for_date($date);
            echo json_encode(['success' => true, 'data' => $sessions]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_create_session()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $label = trim($data['label'] ?? '');
            $sessionType = trim($data['session_type'] ?? '');
            $scheduledStart = trim($data['scheduled_start'] ?? '');
            $scheduledEnd = trim($data['scheduled_end'] ?? '');

            if ($label === '' || $sessionType === '' || $scheduledStart === '' || $scheduledEnd === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Label, session_type, scheduled_start, scheduled_end are required']);
                return;
            }

            if (!in_array($sessionType, ['entry', 'exit'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'session_type must be entry or exit']);
                return;
            }

            $allowedLabels = ['Morning IN', 'Morning OUT', 'Afternoon IN', 'Afternoon OUT'];
            if (!in_array($label, $allowedLabels, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'label must be Morning/ Afternoon with IN/OUT']);
                return;
            }

            $res = $this->RFIDSessionModel->create_session([
                'label' => $label,
                'session_type' => $sessionType,
                'scheduled_start' => $scheduledStart,
                'scheduled_end' => $scheduledEnd,
                'created_by' => $this->session->userdata('user_id') ?? null
            ]);

            if ($res) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create session']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_verify_admin_password()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $password = trim($data['password'] ?? '');

            if ($password === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Password is required']);
                return;
            }

            $currentUserId = $this->session->userdata('user_id');
            if (!$currentUserId) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $user = $this->db->table('users')
                ->select('id, role, password')
                ->where('id', $currentUserId)
                ->get();

            if (!$user) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $role = $user['role'] ?? $this->session->userdata('role');
            if (!in_array($role, ['admin', 'super_admin'], true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            if (!password_verify($password, $user['password'])) {
                echo json_encode(['success' => false, 'message' => 'Incorrect password.']);
                return;
            }

            echo json_encode(['success' => true, 'message' => 'Password verified.']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_start_session($id)
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $this->auto_close_expired_sessions();
            $res = $this->RFIDSessionModel->start_session($id);
            if ($res) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to start session']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_end_session($id)
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $res = $this->RFIDSessionModel->end_session($id);
            if ($res) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to end session']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_scans()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $date = $_GET['date'] ?? null;
            $scans = $this->RFIDScanModel->get_recent($date);
            echo json_encode(['success' => true, 'data' => $scans]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_stats()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $registeredStmt = $this->db->raw(
                "SELECT COUNT(*) as total FROM students WHERE rfid_card IS NOT NULL AND TRIM(rfid_card) != ''",
                []
            );
            $registeredRow = $registeredStmt->fetch(PDO::FETCH_ASSOC);

            $scansStmt = $this->db->raw(
                "SELECT COUNT(*) as total FROM rfid_scans",
                []
            );
            $scansRow = $scansStmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'data' => [
                    'registered_cards' => (int)($registeredRow['total'] ?? 0),
                    'total_scans' => (int)($scansRow['total'] ?? 0)
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_create_scan()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $this->auto_close_expired_sessions();
            $data = json_decode(file_get_contents('php://input'), true);
            $rfidCode = trim($data['rfid_code'] ?? '');
            $scanType = trim($data['type'] ?? $data['scan_type'] ?? '');
            $imageBase64 = $data['image_base64'] ?? null;

            if ($rfidCode === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'rfid_code is required']);
                return;
            }

            if ($scanType === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'scan type is required']);
                return;
            }

            $scanType = $scanType === 'exit' ? 'exit' : 'entry';
            $now = app_now();

            $session = $this->RFIDSessionModel->get_active($scanType);
            if (!$session) {
                $endedStmt = $this->db->raw(
                    "SELECT id FROM rfid_sessions\n"
                    . "WHERE session_type = ?\n"
                    . "  AND scheduled_end <= ?\n"
                    . "  AND status IN ('completed', 'closed')\n"
                    . "ORDER BY scheduled_end DESC\n"
                    . "LIMIT 1",
                    [$scanType, $now]
                );
                $endedRow = $endedStmt->fetch(PDO::FETCH_ASSOC);

                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => $endedRow
                        ? 'The active session has ended. Please start the next session.'
                        : 'No active RFID session. Please start a session first.'
                ]);
                return;
            }

            $student = $this->StudentModel->get_by_rfid_card($rfidCode);
            $status = $student ? 'success' : 'unknown';
            $notes = null;
            $isLate = 0;
            $sessionId = null;

            $sessionId = $session['id'];
            if (!empty($session['scheduled_end']) && $now >= $session['scheduled_end']) {
                $this->auto_close_expired_sessions();
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'The active session has ended. Please start the next session.'
                ]);
                return;
            }

            if ($now > $session['scheduled_end']) {
                $isLate = 1;
            }

            if ($sessionId) {
                $duplicate = $this->RFIDScanModel->find_session_duplicate(
                    $sessionId,
                    $scanType,
                    $student['id'] ?? null,
                    $student ? null : $rfidCode
                );

                if (!empty($duplicate)) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'message' => 'RFID already recorded for this session'
                    ]);
                    return;
                }
            }

            $imagePath = null;
            if (!empty($imageBase64)) {
                $imagePath = $this->save_base64_image($imageBase64);
            }

            $inserted = $this->RFIDScanModel->create_scan([
                'session_id' => $sessionId,
                'student_id' => $student['id'] ?? null,
                'student_number' => $student['student_id'] ?? null,
                'rfid_code' => $rfidCode,
                'scan_time' => $now,
                'scan_type' => $scanType,
                'status' => $status,
                'is_late' => $isLate,
                'image_path' => $imagePath,
                'notes' => $notes
            ]);

            if (!$inserted) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to record scan']);
                return;
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'rfid_code' => $rfidCode,
                    'student_id' => $student['id'] ?? null,
                    'student_name' => $student ? ($student['first_name'] . ' ' . $student['last_name']) : null,
                    'scan_time' => $now,
                    'type' => $scanType,
                    'status' => $status,
                    'notes' => $notes,
                    'is_late' => $isLate,
                    'image_path' => $imagePath,
                    'session_id' => $sessionId
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_verify_passkey()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $passkey = trim($data['passkey'] ?? '');

            if ($passkey === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Passkey is required']);
                return;
            }

            $expected = config_item('rfid_admin_passkey');
            if (!empty($expected) && hash_equals((string) $expected, (string) $passkey)) {
                echo json_encode(['success' => true]);
                return;
            }

            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid passkey']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_session_templates()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $status = trim($_GET['status'] ?? '');
            $query = $this->db->table('rfid_session_templates');

            if (in_array($status, ['active', 'inactive'], true)) {
                $query = $query->where('status', $status);
            }

            $templates = $query->order_by('period', 'ASC')
                               ->order_by('start_time', 'ASC')
                               ->get_all();

            echo json_encode(['success' => true, 'data' => $templates]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_create_session_template()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $name = trim($data['name'] ?? '');
            $period = trim($data['period'] ?? '');
            $sessionType = trim($data['session_type'] ?? '');
            $startTime = trim($data['start_time'] ?? '');
            $endTime = trim($data['end_time'] ?? '');
            $status = trim($data['status'] ?? 'active');

            if ($name === '' || $period === '' || $sessionType === '' || $startTime === '' || $endTime === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'name, period, session_type, start_time, end_time are required']);
                return;
            }

            if (!in_array($period, ['morning', 'afternoon'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'period must be morning or afternoon']);
                return;
            }

            if (!in_array($sessionType, ['entry', 'exit'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'session_type must be entry or exit']);
                return;
            }

            if (!in_array($status, ['active', 'inactive'], true)) {
                $status = 'active';
            }

            $startCheck = strtotime('1970-01-01 ' . $startTime);
            $endCheck = strtotime('1970-01-01 ' . $endTime);
            if ($startCheck === false || $endCheck === false || $endCheck <= $startCheck) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'end_time must be after start_time']);
                return;
            }

            $payload = [
                'name' => $name,
                'period' => $period,
                'session_type' => $sessionType,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'status' => $status,
                'created_by' => $this->session->userdata('user_id') ?? null,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ];

            $res = $this->db->table('rfid_session_templates')->insert($payload);
            if ($res) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create template']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_update_session_template($id)
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $existing = $this->db->table('rfid_session_templates')->where('id', $id)->get();
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Template not found']);
                return;
            }

            $data = json_decode(file_get_contents('php://input'), true);
            $name = trim($data['name'] ?? '');
            $period = trim($data['period'] ?? '');
            $sessionType = trim($data['session_type'] ?? '');
            $startTime = trim($data['start_time'] ?? '');
            $endTime = trim($data['end_time'] ?? '');
            $status = trim($data['status'] ?? 'active');

            if ($name === '' || $period === '' || $sessionType === '' || $startTime === '' || $endTime === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'name, period, session_type, start_time, end_time are required']);
                return;
            }

            if (!in_array($period, ['morning', 'afternoon'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'period must be morning or afternoon']);
                return;
            }

            if (!in_array($sessionType, ['entry', 'exit'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'session_type must be entry or exit']);
                return;
            }

            if (!in_array($status, ['active', 'inactive'], true)) {
                $status = 'active';
            }

            $startCheck = strtotime('1970-01-01 ' . $startTime);
            $endCheck = strtotime('1970-01-01 ' . $endTime);
            if ($startCheck === false || $endCheck === false || $endCheck <= $startCheck) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'end_time must be after start_time']);
                return;
            }

            $payload = [
                'name' => $name,
                'period' => $period,
                'session_type' => $sessionType,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'status' => $status,
                'updated_at' => app_now()
            ];

            $res = $this->db->table('rfid_session_templates')
                            ->where('id', $id)
                            ->update($payload);

            if ($res !== false) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update template']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_update_session_template_status($id)
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $existing = $this->db->table('rfid_session_templates')->where('id', $id)->get();
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Template not found']);
                return;
            }

            $data = json_decode(file_get_contents('php://input'), true);
            $status = trim($data['status'] ?? '');

            if (!in_array($status, ['active', 'inactive'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'status must be active or inactive']);
                return;
            }

            $res = $this->db->table('rfid_session_templates')
                            ->where('id', $id)
                            ->update([
                                'status' => $status,
                                'updated_at' => app_now()
                            ]);

            if ($res !== false) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update template status']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_delete_session_template($id)
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $template = $this->db->table('rfid_session_templates')->where('id', $id)->get();
            if (!$template) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Template not found']);
                return;
            }

            $sessionCount = $this->db->table('rfid_sessions')
                                     ->where('label', $template['name'])
                                     ->where('session_type', $template['session_type'])
                                     ->count_all_results();

            if ($sessionCount > 0) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'Template has existing sessions. Deactivate instead.']);
                return;
            }

            $res = $this->db->table('rfid_session_templates')->where('id', $id)->delete();
            if ($res) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to delete template']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_start_session_template($id)
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
            $this->auto_close_expired_sessions();
            $template = $this->db->table('rfid_session_templates')->where('id', $id)->get();
            if (!$template) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Template not found']);
                return;
            }

            if (($template['status'] ?? 'inactive') !== 'active') {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'Template is inactive']);
                return;
            }

            $activeSession = $this->RFIDSessionModel->get_active();
            if (!empty($activeSession)) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'There is already an active session']);
                return;
            }

            $data = json_decode(file_get_contents('php://input'), true);
            $date = trim($data['date'] ?? app_today());
            if ($date === '') {
                $date = app_today();
            }

            $start = $date . ' 00:00:00';
            $end = $date . ' 23:59:59';

            $existing = $this->db->table('rfid_sessions')
                                ->where('label', $template['name'])
                                ->where('session_type', $template['session_type'])
                                ->where('scheduled_start', '>=', $start)
                                ->where('scheduled_start', '<=', $end)
                                ->get();

            if (!empty($existing)) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'Session already exists for today']);
                return;
            }

            $scheduledStart = $date . ' ' . $template['start_time'];
            $scheduledEnd = $date . ' ' . $template['end_time'];

            $payload = [
                'label' => $template['name'],
                'session_type' => $template['session_type'],
                'scheduled_start' => $scheduledStart,
                'scheduled_end' => $scheduledEnd,
                'actual_start' => app_now(),
                'status' => 'active',
                'created_by' => $this->session->userdata('user_id') ?? null,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ];

            $res = $this->db->table('rfid_sessions')->insert($payload);
            if ($res) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to start session']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    private function save_base64_image($payload)
    {
        if (!is_string($payload)) {
            return null;
        }

        if (strpos($payload, 'base64,') !== false) {
            $payload = explode('base64,', $payload, 2)[1];
        }

        $binary = base64_decode($payload);
        if ($binary === false) {
            return null;
        }

        $datePath = date('Y/m/d');
        $relativeDir = 'public/uploads/rfid/' . $datePath;
        $absoluteDir = dirname(__DIR__) . '/../' . $relativeDir;

        if (!is_dir($absoluteDir)) {
            @mkdir($absoluteDir, 0755, true);
        }

        $filename = 'scan_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.jpg';
        $absolutePath = $absoluteDir . '/' . $filename;

        if (file_put_contents($absolutePath, $binary) === false) {
            return null;
        }

        return '/' . $relativeDir . '/' . $filename;
    }
}
