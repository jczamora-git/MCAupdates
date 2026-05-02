<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * NotificationService
 * 
 * Unified service for creating audit logs and notifications in a single transaction
 * Handles in-app notifications and FCM push notification queuing
 * 
 * @package     LavaLust
 * @subpackage  Libraries
 * @category    Notifications
 * @author      Your Name
 * @link        https://github.com/yourusername/campus-companion
 */

class NotificationService
{
    protected $db;
    protected $lava;
    
    // Notification type constants
    const TYPE_ENROLLMENT_SUBMITTED = 'enrollment.submitted';
    const TYPE_ENROLLMENT_APPROVED = 'enrollment.approved';
    const TYPE_ENROLLMENT_REJECTED = 'enrollment.rejected';
    const TYPE_ENROLLMENT_PENDING_DOCS = 'enrollment.pending_documents';
    
    const TYPE_PAYMENT_SUBMITTED = 'payment.submitted';
    const TYPE_PAYMENT_RECEIVED = 'payment.received';
    const TYPE_PAYMENT_CONFIRMED = 'payment.confirmed';
    const TYPE_PAYMENT_FAILED = 'payment.failed';
    const TYPE_PAYMENT_OVERDUE = 'payment.overdue';
    const TYPE_INSTALLMENT_PLAN_CREATED = 'installmentplan.created';
    
    const TYPE_INSTALLMENT_DUE_SOON = 'installment.due_soon';
    
    const TYPE_ACTIVITY_CREATED = 'activity.created';
    const TYPE_ACTIVITY_GRADED = 'activity.graded';
    const TYPE_ACTIVITY_DEADLINE_SOON = 'activity.deadline_soon';
    
    const TYPE_FEEDBACK_RECEIVED = 'feedback.received';
    const TYPE_FEEDBACK_RESPONDED = 'feedback.responded';
    
    const TYPE_BROADCAST_RECEIVED = 'broadcast.received';
    const TYPE_MESSAGE_RECEIVED = 'message.received';
    
    const TYPE_RFID_ENTRY = 'rfid.entry';
    const TYPE_RFID_EXIT = 'rfid.exit';
    
    public function __construct()
    {
        $this->lava =& lava_instance();
        $this->lava->call->database();
        $this->db = $this->lava->db;
    }
    
    /**
     * Create audit log + notification + push queue in a SINGLE TRANSACTION
     * 
     * @param array $params Configuration array
     * @return array ['success' => bool, 'audit_log_id' => int, 'notification_ids' => array]
     */
    public function create($params)
    {
        // Validate required parameters
        $this->validateParams($params);
        
        // Start transaction
        $this->db->transaction();
        
        try {
            // 1. Create audit log entry
            $audit_log_id = $this->createAuditLog($params);
            
            // 2. Create notifications for recipients
            $notification_ids = [];
            foreach ($params['recipients'] as $recipient) {
                $notification_id = $this->createNotification($recipient, $params, $audit_log_id);
                $notification_ids[] = $notification_id;
                
                // 3. Queue FCM push notification if user has push enabled
                if ($this->shouldSendPush($recipient['user_id'], $params['type'])) {
                    $this->queuePushNotification($notification_id, $recipient, $params);
                }
            }
            
            // Commit transaction
            $this->db->commit();
            
            return [
                'success' => true,
                'audit_log_id' => $audit_log_id,
                'notification_ids' => $notification_ids
            ];
            
        } catch (Throwable $e) {
            $this->db->roll_back();
            log_message('error', 'NotificationService error: ' . $e->getMessage());
            
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Create audit log entry
     */
    private function createAuditLog($params)
    {
        $now = app_now();

        $data = [
            'actor_user_id' => $params['actor_user_id'] ?? null,
            'actor_role' => $params['actor_role'],
            'actor_name' => $params['actor_name'] ?? null,
            'action' => $params['action'],
            'entity_type' => $params['entity_type'],
            'entity_id' => $params['entity_id'],
            'description' => $params['description'] ?? null,
            'metadata' => isset($params['metadata']) ? json_encode($params['metadata']) : null,
            'ip_address' => $this->getIpAddress(),
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
            'created_at' => $now,
        ];
        
        $result = $this->db->table('audit_logs')->insert($data);
        if ($result) {
            return $this->db->last_id();
        }
        throw new Exception('Failed to create audit log');
    }
    
    /**
     * Create notification for a recipient
     */
    private function createNotification($recipient, $params, $audit_log_id)
    {
        $now = app_now();

        $data = [
            'user_id' => $recipient['user_id'],
            'role' => $recipient['role'],
            'type' => $params['type'],
            'title' => $params['title'],
            'body' => $params['body'],
            'icon' => $params['icon'] ?? $this->getDefaultIcon($params['type']),
            'action_url' => $params['action_url'] ?? null,
            'entity_type' => $params['entity_type'],
            'entity_id' => $params['entity_id'],
            'data' => isset($params['notification_data']) ? json_encode($params['notification_data']) : null,
            'audit_log_id' => $audit_log_id,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        
        $result = $this->db->table('notifications')->insert($data);
        if ($result) {
            return $this->db->last_id();
        }
        throw new Exception('Failed to create notification');
    }
    
    /**
     * Queue FCM push notification
     */
    private function queuePushNotification($notification_id, $recipient, $params)
    {
        $now = app_now();
        $expiresAt = date('Y-m-d H:i:s', strtotime($now . ' +1 day'));

        $data = [
            'notification_id' => $notification_id,
            'user_id' => $recipient['user_id'],
            'fcm_title' => $params['title'],
            'fcm_body' => $params['body'],
            'fcm_data' => isset($params['push_data']) ? json_encode($params['push_data']) : null,
            'fcm_image' => $params['push_image'] ?? null,
            'created_at' => $now,
            'expires_at' => $expiresAt,
        ];

        $inserted = $this->db->table('notification_outbox')->insert($data);
        $outboxId = $inserted ? $this->db->last_id() : null;

        // Try immediate delivery so users receive push even if worker/cron is delayed.
        $delivery = $this->sendImmediatePush($recipient, $params);
        if ($outboxId) {
            $updateData = [
                'attempts' => 1,
                'last_attempt_at' => app_now(),
                'last_error' => $delivery['success'] ? null : $delivery['error'],
            ];

            if ($delivery['success']) {
                $updateData['status'] = 'sent';
                $updateData['sent_at'] = app_now();
            }

            $this->db->table('notification_outbox')
                ->where('id', $outboxId)
                ->update($updateData);
        }
    }

    /**
     * Attempt to send push immediately using active user FCM tokens.
     * This is a best-effort path; outbox remains as fallback for retries.
     */
    private function sendImmediatePush($recipient, $params)
    {
        try {
            $this->lava->call->helper('notification');
            $this->lava->call->model('MessageModel');

            $tokens = $this->lava->MessageModel->get_user_fcm_tokens((int)$recipient['user_id']);
            if (empty($tokens)) {
                return ['success' => false, 'error' => 'No FCM tokens found'];
            }

            $pushData = [];
            if (!empty($params['push_data']) && is_array($params['push_data'])) {
                $pushData = $params['push_data'];
            }

            $sent = false;
            $tokenErrors = [];
            foreach ($tokens as $token) {
                if (send_fcm_to_token((string)$token, (string)$params['title'], (string)$params['body'], $pushData)) {
                    $sent = true;
                } else {
                    $errorDetail = function_exists('get_fcm_last_error') ? get_fcm_last_error() : null;
                    $tokenErrors[] = [
                        'token' => substr((string)$token, 0, 20) . '...',
                        'error' => $errorDetail ?: 'Unknown FCM error',
                    ];
                }
            }

            if ($sent) {
                return ['success' => true, 'error' => null];
            }

            $errorMessage = 'FCM send failed';
            if (!empty($tokenErrors)) {
                $errorMessage = 'FCM send failed: ' . json_encode($tokenErrors);
            }

            return ['success' => false, 'error' => $errorMessage];
        } catch (Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    /**
     * Check if user wants push notifications for this type
     */
    private function shouldSendPush($user_id, $notification_type)
    {
        $pref = $this->db->table('notification_preferences')
            ->where('user_id', $user_id)
            ->where('notification_type', $notification_type)
            ->get();
        
        if ($pref) {
            return (bool) $pref['push_enabled'];
        }
        
        // Default to true if no preference set
        return true;
    }
    
    /**
     * Get default icon for notification type
     */
    private function getDefaultIcon($type)
    {
        $icons = [
            'enrollment.submitted' => 'file-text',
            'enrollment.approved' => 'check-circle',
            'enrollment.rejected' => 'x-circle',
            'payment.submitted' => 'credit-card',
            'payment.received' => 'dollar-sign',
            'payment.confirmed' => 'credit-card',
            'installmentplan.created' => 'calendar',
            'activity.created' => 'clipboard',
            'feedback.received' => 'message-square',
            'feedback.responded' => 'message-circle',
            'message.received' => 'mail',
            'rfid.entry' => 'log-in',
            'rfid.exit' => 'log-out',
        ];
        
        return $icons[$type] ?? 'bell';
    }
    
    /**
     * Validate required parameters
     */
    private function validateParams($params)
    {
        $required = ['actor_role', 'action', 'entity_type', 'entity_id', 'type', 'title', 'body', 'recipients'];
        
        foreach ($required as $field) {
            if (!isset($params[$field])) {
                throw new Exception("Missing required parameter: {$field}");
            }
        }
        
        if (empty($params['recipients']) || !is_array($params['recipients'])) {
            throw new Exception("Recipients must be a non-empty array");
        }
    }
    
    /**
     * Get user's IP address
     */
    private function getIpAddress()
    {
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            return $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            return $_SERVER['HTTP_X_FORWARDED_FOR'];
        } else {
            return $_SERVER['REMOTE_ADDR'] ?? null;
        }
    }
    
    /**
     * Get recipients by role
     * 
     * @param string $role 'admin', 'teacher', 'student', 'enrollee'
     * @return array Array of ['user_id' => int, 'role' => string]
     */
    public function getRecipientsByRole($role)
    {
        $normalizedRole = strtolower((string)$role);
        $roleCandidates = array_values(array_unique([
            $normalizedRole,
            ucfirst($normalizedRole),
            strtoupper($normalizedRole)
        ]));

        $users = $this->db->raw(
            'SELECT id as user_id FROM users WHERE role IN (?, ?, ?) AND status IN (?, ?, ?)',
            [
                $roleCandidates[0],
                $roleCandidates[1],
                $roleCandidates[2],
                'active',
                'Active',
                'ACTIVE'
            ]
        )->fetchAll(\PDO::FETCH_ASSOC);

        // Fallback for legacy records with inconsistent status values.
        if (empty($users)) {
            $users = $this->db->raw(
                'SELECT id as user_id FROM users WHERE role IN (?, ?, ?)',
                [
                    $roleCandidates[0],
                    $roleCandidates[1],
                    $roleCandidates[2]
                ]
            )->fetchAll(\PDO::FETCH_ASSOC);
        }
        
        return array_map(function($user) use ($role) {
            return [
                'user_id' => $user['user_id'],
                'role' => $role
            ];
        }, $users);
    }
    
    /**
     * Get students in a section
     * 
     * @param int $section_id
     * @return array Array of ['user_id' => int, 'role' => 'student']
     */
    public function getStudentsBySection($section_id)
    {
        $students = $this->db->table('students')
            ->select('user_id')
            ->where('section_id', $section_id)
            ->inner_join('users', 'users.id = students.user_id')
            ->where('users.status', 'active')
            ->get_all();
        
        return array_map(function($student) {
            return [
                'user_id' => $student['user_id'],
                'role' => 'student'
            ];
        }, $students);
    }
    
    /**
     * Get students in a teacher's subject
     * 
     * @param int $teacher_subject_id
     * @return array Array of ['user_id' => int, 'role' => 'student']
     */
    public function getStudentsByTeacherSubject($teacher_subject_id)
    {
        // Get section_id from teacher_subject_assignments
        $assignment = $this->db->table('teacher_subject_assignments')
            ->select('section_id')
            ->where('id', $teacher_subject_id)
            ->get();
        
        if (!$assignment) {
            return [];
        }
        
        return $this->getStudentsBySection($assignment['section_id']);
    }
    
    /**
     * Mark notification as read
     * 
     * @param int $notification_id
     * @param int $user_id
     * @return bool
     */
    public function markAsRead($notification_id, $user_id)
    {
        return $this->db->table('notifications')
            ->where('id', $notification_id)
            ->where('user_id', $user_id)
            ->update([
                'is_read' => 1,
                'read_at' => app_now()
            ]);
    }
    
    /**
     * Mark all notifications as read for a user
     * 
     * @param int $user_id
     * @return bool
     */
    public function markAllAsRead($user_id)
    {
        return $this->db->table('notifications')
            ->where('user_id', $user_id)
            ->where('is_read', 0)
            ->update([
                'is_read' => 1,
                'read_at' => app_now()
            ]);
    }
    
    /**
     * Get unread notification count for a user
     * 
     * @param int $user_id
     * @return int
     */
    public function getUnreadCount($user_id)
    {
        $stmt = $this->db->raw(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0",
            [$user_id]
        );
        $result = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        return $result[0]['count'] ?? 0;
    }
    
    /**
     * Get notifications for a user with pagination
     * 
     * @param int $user_id
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function getNotifications($user_id, $limit = 20, $offset = 0)
    {
        return $this->db->table('notifications')
            ->where('user_id', $user_id)
            ->where('is_archived', 0)
            ->order_by('created_at', 'DESC')
            ->limit($limit, $offset)
            ->get_all();
    }
}
