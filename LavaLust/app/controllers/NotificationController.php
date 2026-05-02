<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * NotificationController
 * 
 * Handles API requests for notifications (audit logs + in-app notifications)
 */
class NotificationController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->library('session');
        $this->call->library('NotificationService');
    }

    /**
     * POST /api/users/register-fcm-token
     * Register a Firebase Cloud Messaging (FCM) device token for the current user.
     * Body: { token: string }
     */
    public function api_register_fcm_token()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $token = trim((string)($data['token'] ?? ''));

            if ($token === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'FCM token is required']);
                return;
            }

            $user_id = (int)$this->session->userdata('user_id');

            $existing = $this->db->table('user_fcm_tokens')
                ->select('id')
                ->where('user_id', $user_id)
                ->where('token', $token)
                ->where('is_active', 1)
                ->get();

            if (!empty($existing) && !empty($existing['id'])) {
                $this->db->table('user_fcm_tokens')
                    ->where('id', $existing['id'])
                    ->update(['created_at' => app_now()]);

                http_response_code(200);
                echo json_encode(['success' => true, 'message' => 'FCM token already registered']);
                return;
            }

            $inserted = $this->db->table('user_fcm_tokens')->insert([
                'user_id' => $user_id,
                'token' => $token,
                'is_active' => 1,
                'created_at' => app_now()
            ]);

            if ($inserted) {
                http_response_code(201);
                echo json_encode(['success' => true, 'message' => 'FCM token registered successfully']);
                return;
            }

            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to register FCM token']);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/debug/my-fcm-tokens
     * Development helper to list active FCM tokens for the logged-in user.
     */
    public function api_list_my_fcm_tokens()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = (int)$this->session->userdata('user_id');
            $stmt = $this->db->raw(
                'SELECT id, token, is_active, created_at FROM user_fcm_tokens WHERE user_id = ?',
                [$user_id]
            );
            $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

            http_response_code(200);
            echo json_encode(['success' => true, 'tokens' => $rows]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST|GET /api/debug/send-test-notification
     * Sends a test notification using NotificationService so it writes to
     * notifications and notification_outbox before Firebase delivery.
     */
    public function api_send_test_notification()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $title = (string)($data['title'] ?? 'EduTrack Test Notification');
            $body = (string)($data['body'] ?? 'This is a test push notification from the server.');

            $user_id = (int)$this->session->userdata('user_id');
            $role = (string)($this->session->userdata('role') ?: 'student');
            $actor_name = trim((string)$this->session->userdata('first_name') . ' ' . (string)$this->session->userdata('last_name'));
            if ($actor_name === '') {
                $actor_name = 'User #' . $user_id;
            }

            $result = $this->NotificationService->create([
                'actor_user_id' => $user_id,
                'actor_role' => $role,
                'actor_name' => $actor_name,
                'action' => 'notification.test_sent',
                'entity_type' => 'notification',
                'entity_id' => $user_id,
                'description' => 'Test push notification sent',
                'metadata' => [
                    'channel' => 'firebase',
                    'debug' => true,
                ],
                'type' => 'notification.test',
                'title' => $title,
                'body' => $body,
                'icon' => 'bell',
                'action_url' => '/notifications',
                'notification_data' => [
                    'type' => 'test_notification',
                    'source' => 'notification_controller',
                ],
                'push_data' => [
                    'type' => 'test_notification',
                    'source' => 'notification_controller',
                ],
                'recipients' => [[
                    'user_id' => $user_id,
                    'role' => $role,
                ]],
            ]);

            if (empty($result['success'])) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create test notification: ' . ($result['error'] ?? 'unknown error')
                ]);
                return;
            }

            $notificationIds = $result['notification_ids'] ?? [];
            $outboxDiagnostics = [];
            if (!empty($notificationIds) && is_array($notificationIds)) {
                $ids = array_values(array_filter(array_map('intval', $notificationIds), function($id) {
                    return $id > 0;
                }));

                if (!empty($ids)) {
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));
                    $stmt = $this->db->raw(
                        "SELECT notification_id, status, attempts, last_error, created_at, last_attempt_at, sent_at FROM notification_outbox WHERE notification_id IN ({$placeholders}) ORDER BY id DESC",
                        $ids
                    );
                    $outboxDiagnostics = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Test notification created via NotificationService',
                'audit_log_id' => $result['audit_log_id'] ?? null,
                'notification_ids' => $notificationIds,
                'outbox' => $outboxDiagnostics
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/notifications
     * Get user's notifications with pagination
     */
    public function api_get_notifications()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
            $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
            $type = isset($_GET['type']) ? $_GET['type'] : null;
            $unread_only = isset($_GET['unread_only']) && $_GET['unread_only'] === 'true';

            // Get total count
            $count_params = [$user_id];
            $count_sql = "SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND is_archived = 0";
            if ($type) {
                $count_sql .= " AND type = ?";
                $count_params[] = $type;
            }
            if ($unread_only) {
                $count_sql .= " AND is_read = 0";
            }
            $count_stmt = $this->db->raw($count_sql, $count_params);
            $count_result = $count_stmt ? $count_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $total = $count_result[0]['total'] ?? 0;

            // Rebuild query for fetching data
            $this->db->table('notifications')
                ->where('user_id', $user_id)
                ->where('is_archived', 0);

            if ($type) {
                $this->db->where('type', $type);
            }

            if ($unread_only) {
                $this->db->where('is_read', 0);
            }

            $notifications = $this->db
                ->order_by('created_at', 'DESC')
                ->limit($offset, $limit)
                ->get_all();

            // Get unread count separately
            $unread_stmt = $this->db->raw(
                "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0",
                [$user_id]
            );
            $unread_result = $unread_stmt ? $unread_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $unread_count = $unread_result[0]['count'] ?? 0;

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $notifications,
                'total' => $total,
                'unread_count' => $unread_count,
                'limit' => $limit,
                'offset' => $offset
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/notifications/unread-count
     * Get count of unread notifications
     */
    public function api_get_unread_count()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');

            $count_stmt = $this->db->raw(
                "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0",
                [$user_id]
            );
            $count_result = $count_stmt ? $count_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $count = $count_result[0]['count'] ?? 0;

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'count' => $count
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/notifications/{id}/mark-as-read
     * Mark a notification as read
     */
    public function api_mark_as_read($notification_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');

            // Verify ownership
            $notification = $this->db->table('notifications')
                ->where('id', $notification_id)
                ->where('user_id', $user_id)
                ->get_first();

            if (!$notification) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Notification not found']);
                return;
            }

            // Update
            $this->db->table('notifications')
                ->where('id', $notification_id)
                ->update([
                    'is_read' => 1,
                    'read_at' => app_now(),
                    'updated_at' => app_now()
                ]);

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Marked as read']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/notifications/mark-all-as-read
     * Mark all notifications as read
     */
    public function api_mark_all_as_read()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');

            $this->db->table('notifications')
                ->where('user_id', $user_id)
                ->where('is_read', 0)
                ->update([
                    'is_read' => 1,
                    'read_at' => app_now(),
                    'updated_at' => app_now()
                ]);

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'All notifications marked as read']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/notifications/audit-logs
     * Get audit logs (admin only)
     */
    public function api_get_audit_logs()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
            $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
            $action = isset($_GET['action']) ? $_GET['action'] : null;
            $entity_type = isset($_GET['entity_type']) ? $_GET['entity_type'] : null;
            $actor_user_id = isset($_GET['actor_user_id']) ? intval($_GET['actor_user_id']) : null;

            // Get total count
            $count_params = [];
            $count_sql = "SELECT COUNT(*) as total FROM audit_logs WHERE 1=1";
            if ($action) {
                $count_sql .= " AND action = ?";
                $count_params[] = $action;
            }
            if ($entity_type) {
                $count_sql .= " AND entity_type = ?";
                $count_params[] = $entity_type;
            }
            if ($actor_user_id) {
                $count_sql .= " AND actor_user_id = ?";
                $count_params[] = $actor_user_id;
            }
            $count_stmt = $this->db->raw($count_sql, $count_params);
            $count_result = $count_stmt ? $count_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $total = $count_result[0]['total'] ?? 0;

            // Rebuild query for fetching data
            $this->db->table('audit_logs');

            if ($action) {
                $this->db->where('action', $action);
            }

            if ($entity_type) {
                $this->db->where('entity_type', $entity_type);
            }

            if ($actor_user_id) {
                $this->db->where('actor_user_id', $actor_user_id);
            }

            $logs = $this->db
                ->order_by('created_at', 'DESC')
                ->limit($offset, $limit)
                ->get_all();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $logs,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/notifications/stats
     * Get notification statistics (admin only)
     */
    public function api_get_stats()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $now = app_now();
            $today = app_today();

            // Total notifications today
            $today_notif_stmt = $this->db->raw(
                "SELECT COUNT(*) as count FROM notifications WHERE DATE(created_at) = ?",
                [$today]
            );
            $today_notif_result = $today_notif_stmt ? $today_notif_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $today_notifications = $today_notif_result[0]['count'] ?? 0;

            // Total audit logs today
            $today_audit_stmt = $this->db->raw(
                "SELECT COUNT(*) as count FROM audit_logs WHERE DATE(created_at) = ?",
                [$today]
            );
            $today_audit_result = $today_audit_stmt ? $today_audit_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $today_audits = $today_audit_result[0]['count'] ?? 0;

            // Pending push notifications
            $pending_stmt = $this->db->raw(
                "SELECT COUNT(*) as count FROM notification_outbox WHERE status = 'pending'"
            );
            $pending_result = $pending_stmt ? $pending_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $pending_push = $pending_result[0]['count'] ?? 0;

            // Failed push notifications (last 24h)
            $failed_stmt = $this->db->raw(
                "SELECT COUNT(*) as count FROM notification_outbox WHERE status = 'failed' AND last_attempt_at >= DATE_SUB(?, INTERVAL 24 HOUR)",
                [$now]
            );
            $failed_result = $failed_stmt ? $failed_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            $failed_push = $failed_result[0]['count'] ?? 0;

            // Notifications by type (last 7 days)
            $by_type_stmt = $this->db->raw("
                SELECT type, COUNT(*) as count
                FROM notifications
                WHERE created_at >= DATE_SUB(?, INTERVAL 7 DAY)
                GROUP BY type
                ORDER BY count DESC
                LIMIT 10
            ", [$now]);
            $by_type = $by_type_stmt ? $by_type_stmt->fetchAll(PDO::FETCH_ASSOC) : [];

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'stats' => [
                    'today_notifications' => $today_notifications,
                    'today_audits' => $today_audits,
                    'pending_push' => $pending_push,
                    'failed_push' => $failed_push,
                    'by_type_last_7_days' => $by_type
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}
