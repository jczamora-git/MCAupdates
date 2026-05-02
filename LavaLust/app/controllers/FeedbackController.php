<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class FeedbackController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->model('FeedbackModel');
        $this->call->library('session');
    }

    // GET /api/feedback
    public function api_get_feedback()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $filters = [];
            if (!empty($_GET['sentiment'])) $filters['sentiment'] = $_GET['sentiment'];
            if (!empty($_GET['category'])) $filters['category'] = $_GET['category'];
            if (!empty($_GET['search'])) $filters['search'] = $_GET['search'];

            $list = $this->FeedbackModel->get_all($filters);

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $list, 'count' => is_array($list) ? count($list) : 0]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // GET /api/feedback/my
    public function api_get_my_feedback()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');
            $list = $this->FeedbackModel->get_by_user($user_id);

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $list, 'count' => is_array($list) ? count($list) : 0]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // POST /api/feedback
    public function api_create_feedback()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['message']) || empty($data['category'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Message and category are required']);
                return;
            }

            $insert = [
                'user_id' => $this->session->userdata('user_id'),
                'role' => $this->session->userdata('role') ?? 'student',
                'category' => $data['category'],
                'title' => $data['title'] ?? null,
                'message' => $data['message'],
                'sentiment' => $data['sentiment'] ?? null,
                'confidence' => $data['confidence'] ?? null,
                'probabilities' => isset($data['probabilities']) ? json_encode($data['probabilities']) : null,
            ];

            $newId = $this->FeedbackModel->create($insert);

            if ($newId) {
                http_response_code(201);
                echo json_encode(['success' => true, 'message' => 'Feedback submitted', 'id' => $newId]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to save feedback']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // PUT /api/feedback/{id}/sentiment
    public function api_update_sentiment($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['sentiment'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Sentiment is required']);
                return;
            }

            $payload = [
                'sentiment' => $data['sentiment'],
                'confidence' => $data['confidence'] ?? null,
                'probabilities' => isset($data['probabilities']) ? json_encode($data['probabilities']) : null,
            ];

            $res = $this->FeedbackModel->update_sentiment($id, $payload);
            if ($res) {
                echo json_encode(['success' => true, 'message' => 'Sentiment updated']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update sentiment']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    // PUT /api/feedback/{id}/response
    public function api_update_response($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $response_text = isset($data['response_text']) ? trim($data['response_text']) : '';

            if ($response_text === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Response text is required']);
                return;
            }

            $payload = [
                'response_text' => $response_text,
                'responded_at' => app_now(),
            ];

            $res = $this->FeedbackModel->update_response($id, $payload);
            if ($res) {
                echo json_encode(['success' => true, 'message' => 'Response saved']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to save response']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}
