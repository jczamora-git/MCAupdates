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

    public function api_sessions()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
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

    public function api_start_session($id)
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
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

    public function api_create_scan()
    {
        api_set_json_headers();
        if (!$this->require_admin()) return;

        try {
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
            $today = app_today();

            $session = $this->RFIDSessionModel->get_active($scanType);
            if (!$session) {
                $session = $this->RFIDSessionModel->find_current_for_time($now, $scanType);
            }

            $lateSession = null;
            if (!$session) {
                $lateSession = $this->RFIDSessionModel->get_latest_for_type($scanType, $today);
            }

            $student = $this->StudentModel->get_by_rfid_card($rfidCode);
            $status = $student ? 'success' : 'unknown';
            $notes = null;
            $isLate = 0;
            $sessionId = null;

            if ($session) {
                $sessionId = $session['id'];
                if ($now > $session['scheduled_end']) {
                    $isLate = 1;
                }
            } elseif ($lateSession) {
                $sessionId = $lateSession['id'];
                $isLate = 1;
                $notes = 'Late scan (session ended)';
            } else {
                $notes = 'No active session';
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
