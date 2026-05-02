<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * GCash Proof-of-Payment Session Controller
 *
 * Flow:
 *  1. Admin opens GCash payment dialog → POST create_session  → receives token
 *  2. QR code encodes  /payment-proof/{token}
 *  3. Admin page polls  GET  session_status/{token}  every 3 s
 *  4. Client opens the QR URL, sees installment info, uploads screenshot
 *     → POST upload_proof/{token}  (multipart: file + ocr_reference)
 *  5. Poll returns status:"uploaded" + file URL + ocr_reference → admin autofills ref number
 *  6. Admin marks session viewed → PUT mark_viewed/{token}
 *
 *  The client upload endpoint is public (no auth — token is the credential).
 *  The admin endpoints require an active admin session.
 */
class GcashUploadSessionController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('GcashUploadSessionModel');
    }

    /**
     * Use the same clock source as app_now() for all expiry checks.
     * This avoids false-expired links when DB and PHP runtime clocks differ.
     */
    private function app_now_timestamp()
    {
        $now = app_now();
        $ts = strtotime($now);
        return ($ts !== false) ? $ts : time();
    }

    private function is_session_expired($expiresAt)
    {
        $expiryTs = strtotime((string) $expiresAt);
        if ($expiryTs === false) {
            return true;
        }
        return $expiryTs < $this->app_now_timestamp();
    }

    /**
     * If a session was incorrectly marked as expired due to clock mismatch,
     * restore it back to pending while it is still within the real TTL window.
     */
    private function normalize_session_status($token, $session)
    {
        if (
            isset($session['status']) &&
            $session['status'] === 'expired' &&
            !$this->is_session_expired($session['expires_at'] ?? null)
        ) {
            $this->GcashUploadSessionModel->update_status($token, 'pending');
            $session['status'] = 'pending';
        }

        return $session;
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN: Create a new upload session
    // POST /api/gcash-sessions
    // Body: { user_id, amount_due, [plan_id], [installment_id], [installment_number], [payment_id] }
    //   Flexible: works for installment plans OR standalone payments.
    //   Only user_id is required; all linkage fields are optional.
    // ─────────────────────────────────────────────────────────────
    public function create_session()
    {
        header('Content-Type: application/json');

        // Require admin session
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);

            if (empty($input['user_id'])) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'user_id is required']);
                return;
            }

            // Generate a cryptographically secure token
            $token = bin2hex(random_bytes(24)); // 48-char hex

            // Expire in 30 minutes
            $expires_at = date('Y-m-d H:i:s', strtotime(app_now() . ' +30 minutes'));

            $session_id = $this->GcashUploadSessionModel->create([
                'token'              => $token,
                'user_id'            => (int) $input['user_id'],
                'plan_id'            => !empty($input['plan_id'])        ? (int)   $input['plan_id']        : null,
                'installment_id'     => !empty($input['installment_id']) ? (int)   $input['installment_id'] : null,
                'payment_id'         => !empty($input['payment_id'])     ? (int)   $input['payment_id']     : null,
                'installment_number' => (int)   ($input['installment_number'] ?? 0),
                'amount_due'         => (float) ($input['amount_due']         ?? 0),
                'payment_description' => $input['payment_description'] ?? null,
                'status'             => 'pending',
                'expires_at'         => $expires_at,
            ]);

            if ($session_id) {
                echo json_encode([
                    'success'    => true,
                    'token'      => $token,
                    'session_id' => $session_id,
                    'expires_at' => $expires_at,
                ]);
            } else {
                throw new Exception('Failed to create session');
            }

        } catch (Exception $e) {
            error_log('GcashUploadSession::create_session error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN: Poll for status (called every 3 s by admin page)
    // GET /api/gcash-sessions/{token}/status
    // ─────────────────────────────────────────────────────────────
    public function session_status($token)
    {
        header('Content-Type: application/json');

        // Require admin session
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $session = $this->GcashUploadSessionModel->get_by_token($token);

            if (!$session) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Session not found']);
                return;
            }

            $session = $this->normalize_session_status($token, $session);

            // Auto-expire if past expires_at
            if ($session['status'] === 'pending' && $this->is_session_expired($session['expires_at'] ?? null)) {
                $this->GcashUploadSessionModel->update_status($token, 'expired');
                $session['status'] = 'expired';
            }

            $response = [
                'success'            => true,
                'status'             => $session['status'],
                'expires_at'         => $session['expires_at'],
                'student_name'       => $session['student_name'],
                'installment_number' => $session['installment_number'],
                'amount_due'         => $session['amount_due'],
                'payment_description' => $session['payment_description'],
            ];

            // Include proof data once uploaded
            if ($session['status'] === 'uploaded' || $session['status'] === 'viewed') {
                $response['ocr_reference']   = $session['ocr_reference'];
                $response['file_url']        = $session['file_path']
                    ? '/' . ltrim($session['file_path'], '/')
                    : null;
                $response['uploaded_at']     = $session['uploaded_at'];
                $response['original_filename'] = $session['original_filename'];
            }

            echo json_encode($response);

        } catch (Exception $e) {
            error_log('GcashUploadSession::session_status error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN: Mark session as viewed (stop admin polling)
    // PUT /api/gcash-sessions/{token}/viewed
    // ─────────────────────────────────────────────────────────────
    public function mark_viewed($token)
    {
        header('Content-Type: application/json');

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $this->GcashUploadSessionModel->update_status($token, 'viewed');
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC (no JWT): Client fetches session info to display
    // GET /api/gcash-sessions/{token}/info
    // ─────────────────────────────────────────────────────────────
    public function session_info($token)
    {
        header('Content-Type: application/json');

        try {
            $session = $this->GcashUploadSessionModel->get_by_token($token);

            if (!$session) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Invalid or expired link']);
                return;
            }

            $session = $this->normalize_session_status($token, $session);

            if ($this->is_session_expired($session['expires_at'] ?? null)) {
                $this->GcashUploadSessionModel->update_status($token, 'expired');
                http_response_code(410);
                echo json_encode(['success' => false, 'message' => 'This link has expired. Please ask the cashier to generate a new one.']);
                return;
            }

            if ($session['status'] === 'uploaded' || $session['status'] === 'viewed') {
                echo json_encode([
                    'success'  => true,
                    'status'   => $session['status'],
                    'message'  => 'Proof of payment already uploaded. Thank you!',
                ]);
                return;
            }

            echo json_encode([
                'success'            => true,
                'status'             => $session['status'],
                'student_name'       => $session['student_name'],
                'installment_number' => $session['installment_number'],
                'payment_description' => $session['payment_description'] ?? null,
                'amount_due'         => $session['amount_due'],
                'expires_at'         => $session['expires_at'],
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC (no JWT): Client uploads the GCash screenshot
    // POST /api/gcash-sessions/{token}/upload
    // multipart/form-data: proof_of_payment (file), ocr_reference (string)
    // ─────────────────────────────────────────────────────────────
    public function upload_proof($token)
    {
        header('Content-Type: application/json');
        // Allow CORS for the client page (may be opened on mobile)
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            return;
        }

        try {
            $session = $this->GcashUploadSessionModel->get_by_token($token);

            if (!$session) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Invalid link']);
                return;
            }

            $session = $this->normalize_session_status($token, $session);

            if ($this->is_session_expired($session['expires_at'] ?? null)) {
                http_response_code(410);
                echo json_encode(['success' => false, 'message' => 'This link has expired']);
                return;
            }

            if ($session['status'] !== 'pending') {
                echo json_encode(['success' => false, 'message' => 'Proof already uploaded for this session']);
                return;
            }

            // Upload the file using the existing helper
            require_once APP_DIR . 'helpers/proof_of_payment_helper.php';

            if (!isset($_FILES['proof_of_payment']) || $_FILES['proof_of_payment']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No file received']);
                return;
            }

            $upload_result = upload_proof_of_payment('proof_of_payment', [
                'upload_path'      => ROOT_DIR . 'public/uploads/gcash_proofs/',
                'allowed_types'    => ['jpg', 'jpeg', 'png', 'pdf'],
                'max_size'         => 8 * 1024 * 1024, // 8 MB
                'encrypt_name'     => true,
                'folder_structure' => 'year_month',
            ]);

            if (!$upload_result['success']) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => $upload_result['message']]);
                return;
            }

            $ocr_reference = isset($_POST['ocr_reference']) ? trim($_POST['ocr_reference']) : null;
            $original_name = $_FILES['proof_of_payment']['name'];

            $this->GcashUploadSessionModel->record_upload($token, [
                'file_path'         => $upload_result['relative_path'],
                'original_filename' => $original_name,
                'ocr_reference'     => $ocr_reference,
                'status'            => 'uploaded',
                'uploaded_at'       => app_now(),
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Proof of payment uploaded successfully! The cashier will verify shortly.',
            ]);

        } catch (Exception $e) {
            error_log('GcashUploadSession::upload_proof error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Upload failed. Please try again.']);
        }
    }
}
