<?php
/**
 * INTEGRATION GUIDE
 * 
 * How to integrate the NotificationService into your existing controllers
 * 
 * This file contains practical examples for integrating audit logs and notifications
 * into common scenarios like enrollments, payments, activities, and feedback.
 * 
 * NEW: Now using notification_templates_helper for clean, reusable notification messages!
 */

// ============================================
// SETUP - Add to your controller constructor
// ============================================

/*
public function __construct()
{
    parent::__construct();
    $this->call->database();
    $this->call->library('session');
    $this->call->library('NotificationService');      // ADD THIS
    $this->call->helper('notification_templates');     // ADD THIS - for reusable templates
}
*/

// ============================================
// EXAMPLE 1: Payment Notifications (RECOMMENDED PATTERN)
// ============================================

// When student makes a payment:
/*
public function api_create_payment()
{
    // ... your existing payment creation code ...
    
    $payment_id = $this->db->insert_id();
    $payment = $this->PaymentModel->get_payment($payment_id);
    
    // Send notification to all admins
    try {
        $admins = $this->NotificationService->getRecipientsByRole('admin');
        
        // Use template helper - clean and simple!
        $notificationData = get_payment_received_notification(
            $payment['student_name'],      // Student name
            floatval($payment['amount']),  // Amount
            $payment['payment_type'],      // Payment type
            $payment_id,                   // Payment ID
            $payment['student_id'],        // Student user ID
            $payment['payment_method']     // Payment method
        );
        
        // Add recipients and send
        $notificationData['recipients'] = $admins;
        $this->NotificationService->create($notificationData);
        
    } catch (Exception $e) {
        error_log('Notification error: ' . $e->getMessage());
        // Don't fail the payment if notification fails
    }
    
    // ... rest of your code ...
}
*/

// When admin approves/rejects payment:
/*
public function api_update_payment($id)
{
    // ... your existing update code ...
    
    $oldPayment = $this->PaymentModel->get_payment($id);
    $oldStatus = $oldPayment['status'];
    
    // Update payment
    $success = $this->PaymentModel->update($id, $data);
    
    if ($success) {
        $payment = $this->PaymentModel->get_payment($id);
        $newStatus = $payment['status'];
        
        // Send notification if status changed
        if ($oldStatus !== $newStatus) {
            try {
                $admin_id = $this->session->userdata('user_id');
                $admin_name = trim($this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name'));
                
                if ($newStatus === 'Approved' || $newStatus === 'Verified') {
                    // Use approved template
                    $notificationData = get_payment_approved_notification(
                        $payment['payment_type'],
                        floatval($payment['amount']),
                        $id,
                        $payment['student_id'],
                        $admin_id,
                        $admin_name
                    );
                    
                    $this->NotificationService->create($notificationData);
                } 
                elseif ($newStatus === 'Rejected') {
                    // Use rejected template
                    $notificationData = get_payment_rejected_notification(
                        floatval($payment['amount']),
                        $data['remarks'] ?? '',  // Rejection reason
                        $id,
                        $payment['student_id'],
                        $admin_id,
                        $admin_name,
                        $payment['payment_type']
                    );
                    
                    $this->NotificationService->create($notificationData);
                }
            } catch (Exception $e) {
                error_log('Notification error: ' . $e->getMessage());
            }
        }
    }
}
*/

// When admin processes refund:
/*
public function api_create_refund($id)
{
    // ... your existing refund code ...
    
    $refund_id = $this->db->insert_id();
    
    try {
        $admin_id = $this->session->userdata('user_id');
        $admin_name = trim($this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name'));
        
        // Use refund template
        $notificationData = get_refund_processed_notification(
            $refundAmount,
            $refundReason,
            $refund_id,
            $id,  // Original payment ID
            $originalPayment['student_id'],
            $admin_id,
            $admin_name
        );
        
        $this->NotificationService->create($notificationData);
        
    } catch (Exception $e) {
        error_log('Notification error: ' . $e->getMessage());
    }
}
*/

// ============================================
// EXAMPLE 2: Enrollment Notifications
// ============================================

// When enrollment is submitted (enrollee submits new enrollment):
/*
public function api_submit_enrollment()
{
    // ... your existing enrollment submission code ...
    
    $enrollment_id = $this->db->insert_id();
    
    try {
        $admins = $this->NotificationService->getRecipientsByRole('admin');
        
        $enrollee_user_id = $this->session->userdata('user_id');
        $enrollee_name = trim($this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name'));
        
        // Use enrollment submitted template
        $notificationData = get_enrollment_submitted_notification(
            $enrollee_name,
            $enrollment_id,
            $enrollee_user_id
        );
        
        $notificationData['recipients'] = $admins;
        $this->NotificationService->create($notificationData);
        
    } catch (Exception $e) {
        error_log('Notification error: ' . $e->getMessage());
    }
    
    // ... rest of your code ...
}
*/

// When admin approves enrollment:
/*
public function api_approve_enrollment($enrollment_id)
{
    // ... your existing approval code ...
    
    $enrollment = $this->db->table('enrollments')->where('id', $enrollment_id)->get_first();
    
    try {
        $admin_id = $this->session->userdata('user_id');
        $admin_name = trim($this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name'));
        
        // Use enrollment approved template
        $notificationData = get_enrollment_approved_notification(
            $enrollment_id,
            $enrollment['created_user_id'],
            $admin_id,
            $admin_name
        );
        
        $this->NotificationService->create($notificationData);
        'icon' => 'check-circle',
        'action_url' => "/enrollee/enrollment/{$enrollment_id}",
        'recipients' => [[
            'user_id' => $enrollee_user_id,
            'role' => 'enrollee'
        ]],
        'push_data' => [
            'screen' => 'EnrollmentStatus',
            'enrollment_id' => $enrollment_id
        ]
    ]);
    
    // ... rest of your code ...
}
*/


// ============================================
// EXAMPLE 2: Payment Controller Integration
// ============================================

// When student makes a payment:
/*
public function api_create_payment()
{
    // ... your existing payment creation code ...
    
    $payment_id = $this->db->insert_id();
    $student_user_id = $this->session->userdata('user_id');
    $student_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
    $amount = $_POST['amount'];
    
    // Send notification to all admins
    $admins = $this->NotificationService->getRecipientsByRole('admin');
    
    $this->NotificationService->create([
        'actor_user_id' => $student_user_id,
        'actor_role' => 'student',
        'actor_name' => $student_name,
        'action' => 'payment.received',
        'entity_type' => 'payment',
        'entity_id' => $payment_id,
        'description' => "{$student_name} made a payment of ₱{$amount}",
        'metadata' => [
            'payment_id' => $payment_id,
            'amount' => $amount,
            'payment_type' => 'online'
        ],
        'type' => NotificationService::TYPE_PAYMENT_RECEIVED,
        'title' => 'Payment Received',
        'body' => "{$student_name} paid ₱" . number_format($amount, 2) . ". Please verify.",
        'icon' => 'dollar-sign',
        'action_url' => "/admin/payments/{$payment_id}",
        'recipients' => $admins,
        'push_data' => [
            'screen' => 'PaymentDetails',
            'payment_id' => $payment_id
        ]
    ]);
    
    // ... rest of your code ...
}
*/

// When admin confirms payment:
/*
public function api_confirm_payment($payment_id)
{
    // ... your existing confirmation code ...
    
    $payment = $this->db->table('payments')
        ->where('id', $payment_id)
        ->get_first();
    
    $student_user_id = $payment['student_id']; // Note: This references users.id, not students.id
    $admin_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
    
    // Send notification to student
    $this->NotificationService->create([
        'actor_user_id' => $this->session->userdata('user_id'),
        'actor_role' => 'admin',
        'actor_name' => $admin_name,
        'action' => 'payment.confirmed',
        'entity_type' => 'payment',
        'entity_id' => $payment_id,
        'description' => "Payment #{$payment_id} was confirmed",
        'metadata' => [
            'payment_id' => $payment_id,
            'old_status' => 'pending',
            'new_status' => 'confirmed'
        ],
        'type' => NotificationService::TYPE_PAYMENT_CONFIRMED,
        'title' => 'Payment Confirmed',
        'body' => 'Your payment has been confirmed. Thank you!',
        'icon' => 'credit-card',
        'action_url' => "/student/payments/{$payment_id}",
        'recipients' => [[
            'user_id' => $student_user_id,
            'role' => 'student'
        ]],
        'push_data' => [
            'screen' => 'PaymentDetails',
            'payment_id' => $payment_id
        ]
    ]);
    
    // ... rest of your code ...
}
*/


// ============================================
// EXAMPLE 3: Activity Controller Integration
// ============================================

// When teacher creates an activity:
/*
public function api_create_activity()
{
    // ... your existing activity creation code ...
    
    $activity_id = $this->db->insert_id();
    $teacher_subject_id = $_POST['teacher_subject_id'];
    $activity_title = $_POST['title'];
    $due_date = $_POST['due_date'];
    
    // Get all students in this teacher's subject
    $students = $this->NotificationService->getStudentsByTeacherSubject($teacher_subject_id);
    
    $teacher_user_id = $this->session->userdata('user_id');
    $teacher_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
    
    $this->NotificationService->create([
        'actor_user_id' => $teacher_user_id,
        'actor_role' => 'teacher',
        'actor_name' => $teacher_name,
        'action' => 'activity.created',
        'entity_type' => 'activity',
        'entity_id' => $activity_id,
        'description' => "{$teacher_name} created activity: {$activity_title}",
        'metadata' => [
            'activity_id' => $activity_id,
            'teacher_subject_id' => $teacher_subject_id,
            'activity_title' => $activity_title,
            'due_date' => $due_date
        ],
        'type' => NotificationService::TYPE_ACTIVITY_CREATED,
        'title' => 'New Activity Posted',
        'body' => "{$teacher_name} posted: \"{$activity_title}\". Due: {$due_date}",
        'icon' => 'clipboard',
        'action_url' => "/student/activities/{$activity_id}",
        'recipients' => $students,
        'push_data' => [
            'screen' => 'ActivityDetails',
            'activity_id' => $activity_id
        ]
    ]);
    
    // ... rest of your code ...
}
*/

// When teacher grades an activity:
/*
public function api_grade_activity($activity_id, $student_id)
{
    // ... your existing grading code ...
    
    $activity = $this->db->table('activities')
        ->where('id', $activity_id)
        ->get_first();
    
    $student = $this->db->table('students')
        ->where('id', $student_id)
        ->get_first();
    
    $student_user_id = $student['user_id'];
    $teacher_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
    $score = $_POST['score'];
    
    // Send notification to student
    $this->NotificationService->create([
        'actor_user_id' => $this->session->userdata('user_id'),
        'actor_role' => 'teacher',
        'actor_name' => $teacher_name,
        'action' => 'activity.graded',
        'entity_type' => 'activity',
        'entity_id' => $activity_id,
        'description' => "Activity \"{$activity['title']}\" has been graded",
        'metadata' => [
            'activity_id' => $activity_id,
            'student_id' => $student_id,
            'score' => $score
        ],
        'type' => NotificationService::TYPE_ACTIVITY_GRADED,
        'title' => 'Activity Graded',
        'body' => "{$teacher_name} graded \"{$activity['title']}\". Score: {$score}",
        'icon' => 'check-square',
        'action_url' => "/student/activities/{$activity_id}",
        'recipients' => [[
            'user_id' => $student_user_id,
            'role' => 'student'
        ]],
        'push_data' => [
            'screen' => 'ActivityDetails',
            'activity_id' => $activity_id
        ]
    ]);
    
    // ... rest of your code ...
}
*/


// ============================================
// EXAMPLE 4: Feedback Controller Integration
// ============================================

// When student submits feedback:
/*
public function api_submit_feedback()
{
    // ... your existing feedback submission code ...
    
    $feedback_id = $this->db->insert_id();
    $student_user_id = $this->session->userdata('user_id');
    $student_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
    $category = $_POST['category'];
    $message = $_POST['message'];
    $message_preview = substr($message, 0, 100) . (strlen($message) > 100 ? '...' : '');
    
    // Send notification to all admins
    $admins = $this->NotificationService->getRecipientsByRole('admin');
    
    $this->NotificationService->create([
        'actor_user_id' => $student_user_id,
        'actor_role' => 'student',
        'actor_name' => $student_name,
        'action' => 'feedback.submitted',
        'entity_type' => 'feedback',
        'entity_id' => $feedback_id,
        'description' => "{$student_name} submitted feedback about {$category}",
        'metadata' => [
            'feedback_id' => $feedback_id,
            'category' => $category
        ],
        'type' => NotificationService::TYPE_FEEDBACK_RECEIVED,
        'title' => 'New Feedback Received',
        'body' => "{$student_name} submitted feedback: \"{$message_preview}\"",
        'icon' => 'message-square',
        'action_url' => "/admin/feedback/{$feedback_id}",
        'recipients' => $admins,
        'push_data' => [
            'screen' => 'FeedbackDetails',
            'feedback_id' => $feedback_id
        ]
    ]);
    
    // ... rest of your code ...
}
*/

// When admin responds to feedback:
/*
public function api_respond_to_feedback($feedback_id)
{
    // ... your existing response code ...
    
    $feedback = $this->db->table('feedback')
        ->where('id', $feedback_id)
        ->get_first();
    
    $student_user_id = $feedback['user_id'];
    $response = $_POST['response_text'];
    $response_preview = substr($response, 0, 100) . (strlen($response) > 100 ? '...' : '');
    
    $admin_user_id = $this->session->userdata('user_id');
    $admin_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
    
    // Send notification to student
    $this->NotificationService->create([
        'actor_user_id' => $admin_user_id,
        'actor_role' => 'admin',
        'actor_name' => $admin_name,
        'action' => 'feedback.responded',
        'entity_type' => 'feedback',
        'entity_id' => $feedback_id,
        'description' => "{$admin_name} responded to feedback #{$feedback_id}",
        'metadata' => [
            'feedback_id' => $feedback_id,
            'responded_by' => $admin_user_id
        ],
        'type' => NotificationService::TYPE_FEEDBACK_RESPONDED,
        'title' => 'Feedback Response Received',
        'body' => "Admin responded: \"{$response_preview}\"",
        'icon' => 'message-circle',
        'action_url' => "/student/feedback/{$feedback_id}",
        'recipients' => [[
            'user_id' => $student_user_id,
            'role' => 'student'
        ]],
        'push_data' => [
            'screen' => 'FeedbackDetails',
            'feedback_id' => $feedback_id
        ]
    ]);
    
    // ... rest of your code ...
}
*/


// ============================================
// TESTING YOUR INTEGRATION
// ============================================

/*
1. Test enrollment submission:
   - Submit a new enrollment as enrollee
   - Check if admins receive notification in /admin/announcements (Notifications tab)
   - Check if audit_logs table has the entry
   - Check if notification_outbox has pending push notification
   - Run notification_worker.php manually to send push

2. Test enrollment approval:
   - Approve an enrollment as admin
   - Check if enrollee receives notification
   - Verify push notification sent

3. Test payment flow:
   - Create payment as student
   - Check admin notifications
   - Confirm payment as admin
   - Check student receives confirmation

4. Check the audit logs:
   - Go to /admin/announcements → Audit Logs tab
   - Verify all actions are logged with correct metadata

5. Check statistics:
   - Go to /admin/announcements → Statistics tab
   - Verify counts are correct

6. Test FCM worker:
   - Run: php notification_worker.php
   - Check runtime/notification_worker.log for details
   - Verify notification_outbox status changes from pending → sent
*/


// ============================================
// TROUBLESHOOTING
// ============================================

/*
Problem: Notifications not showing up
Solution:
1. Check if NotificationService is loaded in controller constructor
2. Check if recipients array is not empty
3. Check database for errors: SELECT * FROM notifications ORDER BY id DESC LIMIT 10;
4. Check audit_logs table: SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10;

Problem: Push notifications not sending
Solution:
1. Check notification_outbox: SELECT * FROM notification_outbox WHERE status = 'pending';
2. Check FCM Server Key in notification_worker.php
3. Check user_fcm_tokens: SELECT * FROM user_fcm_tokens WHERE user_id = X;
4. Run worker manually: php notification_worker.php
5. Check worker logs: runtime/notification_worker.log

Problem: "Transaction failed" error
Solution:
1. Check if all required fields are provided in create() call
2. Check foreign key constraints (actor_user_id, audit_log_id, etc.)
3. Enable database debugging in LavaLust config
*/
