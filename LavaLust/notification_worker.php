<?php
/**
 * Notification Worker
 * 
 * Processes the notification_outbox table and sends FCM push notifications
 * Run this as a cron job every minute: * * * * * php /path/notification_worker.php
 * 
 * @package     LavaLust
 * @category    Workers
 */

// Set execution time limit
set_time_limit(300); // 5 minutes max

// Define constants required by LavaLust
define('PREVENT_DIRECT_ACCESS', TRUE);
define('BASEPATH', __DIR__ . '/');

// Load database configuration
require_once BASEPATH . 'app/config/database.php';

// Simple database connection using the main database config
$conn = new mysqli(
    $database['main']['hostname'],
    $database['main']['username'],
    $database['main']['password'],
    $database['main']['database']
);

if ($conn->connect_error) {
    error_log("Notification Worker DB Connection Error: " . $conn->connect_error);
    exit(1);
}

// FCM Configuration
// Get your FCM Server Key from Firebase Console → Project Settings → Cloud Messaging
$FCM_SERVER_KEY = 'AIzaSyBqzSYcI1o4KBP-HP0d00ytunedAZtdOIM';
$FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

// Logging function
function log_message($level, $message)
{
    $timestamp = date('Y-m-d H:i:s');
    $log_file = BASEPATH . 'runtime/notification_worker.log';
    file_put_contents($log_file, "[{$timestamp}] [{$level}] {$message}\n", FILE_APPEND);
}

log_message('info', '========== Notification Worker Started ==========');

// ============================================
// STEP 1: Get pending notifications
// ============================================

$query = "
    SELECT 
        o.id,
        o.notification_id,
        o.user_id,
        o.fcm_title,
        o.fcm_body,
        o.fcm_data,
        o.fcm_image,
        o.attempts,
        o.max_attempts
    FROM notification_outbox o
    WHERE o.status = 'pending'
    AND o.attempts < o.max_attempts
    AND o.expires_at > NOW()
    ORDER BY o.created_at ASC
    LIMIT 100
";

$result = $conn->query($query);

if (!$result) {
    log_message('error', "Failed to fetch pending notifications: " . $conn->error);
    exit(1);
}

$pending_count = $result->num_rows;
log_message('info', "Found {$pending_count} pending notifications");

if ($pending_count === 0) {
    log_message('info', 'No pending notifications. Exiting.');
    exit(0);
}

$processed = 0;
$sent = 0;
$failed = 0;

// ============================================
// STEP 2: Process each notification
// ============================================

while ($notification = $result->fetch_assoc()) {
    $processed++;
    $outbox_id = $notification['id'];
    $user_id = $notification['user_id'];
    
    log_message('info', "Processing notification #{$outbox_id} for user #{$user_id}");
    
    // Get user's FCM tokens
    $token_query = "
        SELECT token 
        FROM user_fcm_tokens 
        WHERE user_id = ? 
        AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 5
    ";
    
    $token_stmt = $conn->prepare($token_query);
    $token_stmt->bind_param('i', $user_id);
    $token_stmt->execute();
    $token_result = $token_stmt->get_result();
    
    $tokens = [];
    while ($token_row = $token_result->fetch_assoc()) {
        $tokens[] = $token_row['token'];
    }
    
    $token_stmt->close();
    
    if (empty($tokens)) {
        log_message('warning', "No FCM tokens found for user #{$user_id}. Marking as failed.");
        updateOutboxStatus($conn, $outbox_id, 'failed', $notification['attempts'] + 1, 'No FCM tokens found');
        $failed++;
        continue;
    }
    
    log_message('info', "Found " . count($tokens) . " FCM token(s) for user #{$user_id}");
    
    // Prepare FCM payload
    $fcm_data = $notification['fcm_data'] ? json_decode($notification['fcm_data'], true) : [];
    
    $payload = [
        'registration_ids' => $tokens,
        'notification' => [
            'title' => $notification['fcm_title'],
            'body' => $notification['fcm_body'],
            'sound' => 'default',
            'badge' => '1'
        ],
        'data' => $fcm_data,
        'priority' => 'high'
    ];
    
    // Add image if available
    if (!empty($notification['fcm_image'])) {
        $payload['notification']['image'] = $notification['fcm_image'];
    }
    
    // Send to FCM
    $fcm_result = sendToFCM($FCM_ENDPOINT, $FCM_SERVER_KEY, $payload);
    
    if ($fcm_result['success']) {
        log_message('info', "Successfully sent notification #{$outbox_id}");
        updateOutboxStatus($conn, $outbox_id, 'sent', $notification['attempts'] + 1, null);
        $sent++;
        
        // Optional: Clean up invalid tokens if any
        if (!empty($fcm_result['invalid_tokens'])) {
            cleanupInvalidTokens($conn, $user_id, $fcm_result['invalid_tokens']);
        }
    } else {
        log_message('error', "Failed to send notification #{$outbox_id}: " . $fcm_result['error']);
        
        $new_attempts = $notification['attempts'] + 1;
        $new_status = ($new_attempts >= $notification['max_attempts']) ? 'failed' : 'pending';
        
        updateOutboxStatus($conn, $outbox_id, $new_status, $new_attempts, $fcm_result['error']);
        $failed++;
    }
    
    // Small delay to avoid rate limiting
    usleep(100000); // 0.1 seconds
}

// ============================================
// STEP 3: Clean up expired notifications
// ============================================

$cleanup_query = "
    UPDATE notification_outbox 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at <= NOW()
";

$conn->query($cleanup_query);
$expired_count = $conn->affected_rows;

if ($expired_count > 0) {
    log_message('info', "Marked {$expired_count} expired notifications");
}

// ============================================
// SUMMARY
// ============================================

log_message('info', "========== Notification Worker Completed ==========");
log_message('info', "Processed: {$processed}, Sent: {$sent}, Failed: {$failed}, Expired: {$expired_count}");

$conn->close();
exit(0);


// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Send notification to FCM
 */
function sendToFCM($endpoint, $server_key, $payload)
{
    $headers = [
        'Authorization: key=' . $server_key,
        'Content-Type: application/json'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    if ($curl_error) {
        return [
            'success' => false,
            'error' => 'CURL Error: ' . $curl_error
        ];
    }
    
    if ($http_code !== 200) {
        return [
            'success' => false,
            'error' => "FCM returned HTTP {$http_code}: {$response}"
        ];
    }
    
    $response_data = json_decode($response, true);
    
    // FCM returns success/failure per token
    if (isset($response_data['failure']) && $response_data['failure'] > 0) {
        // Some tokens failed, but at least one succeeded
        $invalid_tokens = [];
        if (isset($response_data['results'])) {
            foreach ($response_data['results'] as $index => $result) {
                if (isset($result['error'])) {
                    $invalid_tokens[] = $payload['registration_ids'][$index];
                }
            }
        }
        
        // If all tokens failed, return error
        if ($response_data['success'] === 0) {
            return [
                'success' => false,
                'error' => 'All tokens failed: ' . json_encode($response_data),
                'invalid_tokens' => $invalid_tokens
            ];
        }
        
        // Partial success
        return [
            'success' => true,
            'invalid_tokens' => $invalid_tokens
        ];
    }
    
    return [
        'success' => true,
        'invalid_tokens' => []
    ];
}

/**
 * Update notification outbox status
 */
function updateOutboxStatus($conn, $outbox_id, $status, $attempts, $error)
{
    $update_query = "
        UPDATE notification_outbox 
        SET 
            status = ?,
            attempts = ?,
            last_error = ?,
            last_attempt_at = NOW(),
            sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END
        WHERE id = ?
    ";
    
    $stmt = $conn->prepare($update_query);
    $stmt->bind_param('sissi', $status, $attempts, $error, $status, $outbox_id);
    $stmt->execute();
    $stmt->close();
}

/**
 * Clean up invalid FCM tokens
 */
function cleanupInvalidTokens($conn, $user_id, $invalid_tokens)
{
    foreach ($invalid_tokens as $token) {
        $delete_query = "
            UPDATE user_fcm_tokens 
            SET is_active = 0 
            WHERE user_id = ? 
            AND token = ?
        ";
        
        $stmt = $conn->prepare($delete_query);
        $stmt->bind_param('is', $user_id, $token);
        $stmt->execute();
        $stmt->close();
        
        log_message('info', "Deactivated invalid FCM token for user #{$user_id}");
    }
}
