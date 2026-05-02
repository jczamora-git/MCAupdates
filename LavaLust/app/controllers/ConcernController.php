<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class ConcernController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->library('session');
        $this->call->model('ConcernModel');
    }

    private function require_auth()
    {
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return false;
        }

        return true;
    }

    private function is_admin()
    {
        return $this->session->userdata('role') === 'admin';
    }

    private function parse_json_body()
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function generate_ticket_no()
    {
        return 'TKT-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid((string)mt_rand(), true)), 0, 6));
    }

    private function can_access_ticket($ticket)
    {
        if (!$ticket) {
            return false;
        }

        if ($this->is_admin()) {
            return true;
        }

        $user_id = (int)$this->session->userdata('user_id');
        return (int)($ticket['user_id'] ?? 0) === $user_id;
    }

    private function moderate_feedback_text($text)
    {
        $normalized = strtolower(trim((string)$text));
        if ($normalized === '') {
            return ['blocked' => false];
        }

        $keywords = config_item('feedback_blocked_keywords');
        if (!is_array($keywords)) {
            $keywords = [];
        }

        foreach ($keywords as $keyword) {
            $needle = strtolower(trim((string)$keyword));
            if ($needle !== '' && mb_strpos($normalized, $needle) !== false) {
                return [
                    'blocked' => true,
                    'reason' => 'keyword',
                    'label' => $needle,
                    'score' => 1.0,
                ];
            }
        }

        $token = config_item('sentiment_hf_token');
        $url = config_item('feedback_moderation_hf_url');
        $threshold = (float)(config_item('feedback_moderation_threshold') ?: 0.75);

        if (empty($token) || empty($url)) {
            return ['blocked' => false];
        }

        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['inputs' => $text]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $token,
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 20);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200 || !$response) {
                return ['blocked' => false];
            }

            $parsed = json_decode($response, true);
            if (!is_array($parsed)) {
                return ['blocked' => false];
            }

            $scores = $parsed;
            if (isset($parsed[0]) && is_array($parsed[0]) && isset($parsed[0][0])) {
                $scores = $parsed[0];
            }

            $topLabel = '';
            $topScore = 0.0;
            foreach ($scores as $entry) {
                if (!is_array($entry) || !isset($entry['label']) || !isset($entry['score'])) {
                    continue;
                }
                $score = (float)$entry['score'];
                if ($score > $topScore) {
                    $topScore = $score;
                    $topLabel = strtolower((string)$entry['label']);
                }
            }

            if ($topLabel === '') {
                return ['blocked' => false];
            }

            $normalizedLabel = str_replace([' ', '-', '_'], '', $topLabel);

            $safeLabels = [
                'nothate',
                'nonhate',
                'normal',
                'neutral',
                'safe',
                'clean',
                'nontoxic',
                'nonabusive',
            ];

            if (in_array($normalizedLabel, $safeLabels, true)) {
                return ['blocked' => false];
            }

            $abusiveLabels = [
                'hate',
                'hateful',
                'abusive',
                'offensive',
                'toxic',
                'harassment',
                'harass',
                'insult',
                'threat',
            ];

            $isAbusiveLabel = in_array($normalizedLabel, $abusiveLabels, true);

            if ($isAbusiveLabel && $topScore >= $threshold) {
                return [
                    'blocked' => true,
                    'reason' => 'model',
                    'label' => $topLabel,
                    'score' => $topScore,
                ];
            }

            return ['blocked' => false];
        } catch (Exception $e) {
            return ['blocked' => false];
        }
    }

    // GET /api/concerns
    public function api_get_concerns()
    {
        api_set_json_headers();

        if (!$this->require_auth()) {
            return;
        }

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $filters = [];
            if (!empty($_GET['status'])) $filters['status'] = $_GET['status'];
            if (!empty($_GET['category'])) $filters['category'] = $_GET['category'];
            if (!empty($_GET['search'])) $filters['search'] = $_GET['search'];
            if (isset($_GET['limit'])) $filters['limit'] = (int)$_GET['limit'];
            if (isset($_GET['offset'])) $filters['offset'] = (int)$_GET['offset'];

            $tickets = $this->ConcernModel->get_all_tickets($filters);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $tickets,
                'count' => is_array($tickets) ? count($tickets) : 0,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // GET /api/concerns/my
    public function api_get_my_concerns()
    {
        api_set_json_headers();

        if (!$this->require_auth()) {
            return;
        }

        try {
            $user_id = (int)$this->session->userdata('user_id');
            $tickets = $this->ConcernModel->get_tickets_by_user($user_id);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $tickets,
                'count' => is_array($tickets) ? count($tickets) : 0,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // POST /api/concerns
    public function api_create_concern()
    {
        api_set_json_headers();

        if (!$this->require_auth()) {
            return;
        }

        try {
            $data = $this->parse_json_body();
            $subject = trim((string)($data['subject'] ?? ''));
            $category = trim((string)($data['category'] ?? 'General'));
            $message = trim((string)($data['message'] ?? ''));

            if ($subject === '' || $message === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Subject and message are required']);
                return;
            }

            $moderation = $this->moderate_feedback_text($subject . "\n" . $message);
            if (!empty($moderation['blocked'])) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'message' => 'Your feedback contains blocked or harmful content. Please revise and try again.',
                    'moderation' => [
                        'reason' => $moderation['reason'] ?? 'unknown',
                        'label' => $moderation['label'] ?? null,
                        'score' => $moderation['score'] ?? null,
                    ],
                ]);
                return;
            }

            $ticket_id = $this->ConcernModel->create_ticket([
                'ticket_no' => $this->generate_ticket_no(),
                'user_id' => (int)$this->session->userdata('user_id'),
                'category' => substr($category, 0, 50),
                'subject' => substr($subject, 0, 150),
                'status' => 'Open',
                'last_message_at' => app_now(),
            ]);

            if (!$ticket_id || !is_numeric($ticket_id)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create concern ticket']);
                return;
            }

            $probabilities = isset($data['probabilities']) ? json_encode($data['probabilities']) : null;

            $message_id = $this->ConcernModel->add_message([
                'ticket_id' => (int)$ticket_id,
                'sender_user_id' => (int)$this->session->userdata('user_id'),
                'message' => $message,
                'sentiment' => isset($data['sentiment']) ? strtolower((string)$data['sentiment']) : null,
                'confidence' => isset($data['confidence']) ? (float)$data['confidence'] : null,
                'probabilities' => $probabilities,
                'analyzed_at' => !empty($data['sentiment']) ? app_now() : null,
            ]);

            if (!$message_id) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Ticket created but first message failed']);
                return;
            }

            $summary = $this->ConcernModel->get_sentiment_summary((int)$ticket_id);
            $this->ConcernModel->update_ticket_meta((int)$ticket_id, array_merge($summary, [
                'last_message_at' => app_now(),
            ]));

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Concern ticket submitted',
                'ticket_id' => (int)$ticket_id,
                'message_id' => (int)$message_id,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // GET /api/concerns/{id}/messages
    public function api_get_concern_messages($id)
    {
        api_set_json_headers();

        if (!$this->require_auth()) {
            return;
        }

        try {
            $ticket = $this->ConcernModel->get_ticket_by_id((int)$id);
            if (!$ticket) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Ticket not found']);
                return;
            }

            if (!$this->can_access_ticket($ticket)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            // Get pagination parameters for messages
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

            $messages = $this->ConcernModel->get_messages_by_ticket((int)$id, $limit, $offset);
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'ticket' => $ticket,
                'messages' => $messages,
                'count' => is_array($messages) ? count($messages) : 0,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // POST /api/concerns/{id}/messages
    public function api_add_concern_message($id)
    {
        api_set_json_headers();

        if (!$this->require_auth()) {
            return;
        }

        try {
            $ticket_id = (int)$id;
            $ticket = $this->ConcernModel->get_ticket_by_id($ticket_id);
            if (!$ticket) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Ticket not found']);
                return;
            }

            if (!$this->can_access_ticket($ticket)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden']);
                return;
            }

            $data = $this->parse_json_body();
            $message = trim((string)($data['message'] ?? ''));
            if ($message === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Message is required']);
                return;
            }

            $moderation = $this->moderate_feedback_text($message);
            if (!empty($moderation['blocked'])) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'message' => 'Your message contains blocked or harmful content. Please revise and try again.',
                    'moderation' => [
                        'reason' => $moderation['reason'] ?? 'unknown',
                        'label' => $moderation['label'] ?? null,
                        'score' => $moderation['score'] ?? null,
                    ],
                ]);
                return;
            }

            $probabilities = isset($data['probabilities']) ? json_encode($data['probabilities']) : null;

            $message_id = $this->ConcernModel->add_message([
                'ticket_id' => $ticket_id,
                'sender_user_id' => (int)$this->session->userdata('user_id'),
                'message' => $message,
                'sentiment' => isset($data['sentiment']) ? strtolower((string)$data['sentiment']) : null,
                'confidence' => isset($data['confidence']) ? (float)$data['confidence'] : null,
                'probabilities' => $probabilities,
                'analyzed_at' => !empty($data['sentiment']) ? app_now() : null,
            ]);

            if (!$message_id) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to send message']);
                return;
            }

            $meta = ['last_message_at' => app_now()];
            if ($this->is_admin() && ($ticket['status'] === 'Open')) {
                $meta['status'] = 'In Progress';
            }
            if (!$this->is_admin() && in_array($ticket['status'], ['Resolved', 'Closed'], true)) {
                $meta['status'] = 'Open';
            }

            $summary = $this->ConcernModel->get_sentiment_summary($ticket_id);
            $this->ConcernModel->update_ticket_meta($ticket_id, array_merge($meta, $summary));

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Message sent',
                'id' => (int)$message_id,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // PUT /api/concerns/{id}/status
    public function api_update_concern_status($id)
    {
        api_set_json_headers();

        if (!$this->require_auth()) {
            return;
        }

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $ticket = $this->ConcernModel->get_ticket_by_id((int)$id);
            if (!$ticket) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Ticket not found']);
                return;
            }

            $data = $this->parse_json_body();
            $status = trim((string)($data['status'] ?? ''));
            $allowed = ['Open', 'In Progress', 'Resolved', 'Closed'];

            if (!in_array($status, $allowed, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid status']);
                return;
            }

            $updated = $this->ConcernModel->update_ticket_status((int)$id, $status);
            if (!$updated) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update status']);
                return;
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Status updated']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}
