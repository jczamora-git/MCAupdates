<?php
/**
 * NotificationService Usage Examples
 * 
 * This file demonstrates how to use the NotificationService
 * for all common scenarios in the Campus Companion system
 */

// Load the library in your controller
$this->load->library('NotificationService');

// ============================================
// SCENARIO 1: Enrollee submits enrollment
// → Notify ALL admins
// ============================================

public function onEnrollmentSubmitted($enrollment_id, $enrollee_user_id, $enrollee_name)
{
    // Get all admins
    $admins = $this->NotificationService->getRecipientsByRole('admin');
    
    $result = $this->NotificationService->create([
        // Actor info (who did it)
        'actor_user_id' => $enrollee_user_id,
        'actor_role' => 'enrollee',
        'actor_name' => $enrollee_name,
        
        // What happened (audit log)
        'action' => 'enrollment.submitted',
        'entity_type' => 'enrollment',
        'entity_id' => $enrollment_id,
        'description' => "{$enrollee_name} submitted a new enrollment application",
        
        // Additional context
        'metadata' => [
            'enrollment_id' => $enrollment_id,
            'enrollee_user_id' => $enrollee_user_id,
            'submitted_at' => date('Y-m-d H:i:s')
        ],
        
        // Notification content
        'type' => NotificationService::TYPE_ENROLLMENT_SUBMITTED,
        'title' => 'New Enrollment Submitted',
        'body' => "{$enrollee_name} has submitted a new enrollment application. Please review.",
        'icon' => 'file-text',
        'action_url' => "/admin/enrollments/{$enrollment_id}",
        
        // Who gets notified
        'recipients' => $admins,
        
        // Extra data for push notification
        'push_data' => [
            'screen' => 'EnrollmentDetails',
            'enrollment_id' => $enrollment_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 2: Student makes a payment
// → Notify ALL admins
// ============================================

public function onPaymentReceived($payment_id, $student_user_id, $student_name, $amount)
{
    $admins = $this->NotificationService->getRecipientsByRole('admin');
    
    $result = $this->NotificationService->create([
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
            'payment_type' => 'online',
            'student_user_id' => $student_user_id
        ],
        
        'type' => NotificationService::TYPE_PAYMENT_RECEIVED,
        'title' => 'Payment Received',
        'body' => "{$student_name} paid ₱" . number_format($amount, 2) . ". Please verify and confirm.",
        'icon' => 'dollar-sign',
        'action_url' => "/admin/payments/{$payment_id}",
        
        'recipients' => $admins,
        
        'push_data' => [
            'screen' => 'PaymentDetails',
            'payment_id' => $payment_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 3: Admin approves enrollment
// → Notify the student/enrollee
// ============================================

public function onEnrollmentApproved($enrollment_id, $enrollee_user_id, $admin_user_id, $admin_name)
{
    // Get enrollment details
    $enrollment = $this->db->table('enrollments')
        ->where('id', $enrollment_id)
        ->get_first();
    
    $recipients = [[
        'user_id' => $enrollee_user_id,
        'role' => 'enrollee'
    ]];
    
    $result = $this->NotificationService->create([
        'actor_user_id' => $admin_user_id,
        'actor_role' => 'admin',
        'actor_name' => $admin_name,
        
        'action' => 'enrollment.approved',
        'entity_type' => 'enrollment',
        'entity_id' => $enrollment_id,
        'description' => "Enrollment #{$enrollment_id} was approved by {$admin_name}",
        
        'metadata' => [
            'enrollment_id' => $enrollment_id,
            'old_status' => 'pending',
            'new_status' => 'approved',
            'approved_by' => $admin_user_id,
            'approved_at' => date('Y-m-d H:i:s')
        ],
        
        'type' => NotificationService::TYPE_ENROLLMENT_APPROVED,
        'title' => '🎉 Enrollment Approved!',
        'body' => 'Congratulations! Your enrollment application has been approved. You can now proceed with your payment.',
        'icon' => 'check-circle',
        'action_url' => "/enrollee/enrollment/{$enrollment_id}",
        
        'recipients' => $recipients,
        
        'push_data' => [
            'screen' => 'EnrollmentStatus',
            'enrollment_id' => $enrollment_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 4: Payment status changed
// → Notify the student
// ============================================

public function onPaymentStatusChanged($payment_id, $student_user_id, $old_status, $new_status, $admin_name)
{
    $recipients = [[
        'user_id' => $student_user_id,
        'role' => 'student'
    ]];
    
    $statusMessages = [
        'confirmed' => 'Your payment has been confirmed. Thank you!',
        'failed' => 'Your payment could not be processed. Please contact support.',
        'pending' => 'Your payment is being reviewed.'
    ];
    
    $result = $this->NotificationService->create([
        'actor_user_id' => null,
        'actor_role' => 'admin',
        'actor_name' => $admin_name,
        
        'action' => 'payment.status_changed',
        'entity_type' => 'payment',
        'entity_id' => $payment_id,
        'description' => "Payment #{$payment_id} status changed from {$old_status} to {$new_status}",
        
        'metadata' => [
            'payment_id' => $payment_id,
            'old_status' => $old_status,
            'new_status' => $new_status,
            'changed_by' => $admin_name
        ],
        
        'type' => NotificationService::TYPE_PAYMENT_CONFIRMED,
        'title' => 'Payment Status Update',
        'body' => $statusMessages[$new_status] ?? 'Your payment status has been updated.',
        'icon' => 'credit-card',
        'action_url' => "/student/payments/{$payment_id}",
        
        'recipients' => $recipients,
        
        'push_data' => [
            'screen' => 'PaymentDetails',
            'payment_id' => $payment_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 5: Teacher creates activity
// → Notify all students in that section/subject
// ============================================

public function onActivityCreated($activity_id, $teacher_subject_id, $teacher_user_id, $teacher_name, $activity_title, $due_date)
{
    // Get all students in this teacher's subject
    $students = $this->NotificationService->getStudentsByTeacherSubject($teacher_subject_id);
    
    $result = $this->NotificationService->create([
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
        'body' => "{$teacher_name} posted a new activity: \"{$activity_title}\". Due: {$due_date}",
        'icon' => 'clipboard',
        'action_url' => "/student/activities/{$activity_id}",
        
        'recipients' => $students,
        
        'push_data' => [
            'screen' => 'ActivityDetails',
            'activity_id' => $activity_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 6: Student submits feedback
// → Notify ALL admins
// ============================================

public function onFeedbackSubmitted($feedback_id, $student_user_id, $student_name, $category, $message_preview)
{
    $admins = $this->NotificationService->getRecipientsByRole('admin');
    
    $result = $this->NotificationService->create([
        'actor_user_id' => $student_user_id,
        'actor_role' => 'student',
        'actor_name' => $student_name,
        
        'action' => 'feedback.submitted',
        'entity_type' => 'feedback',
        'entity_id' => $feedback_id,
        'description' => "{$student_name} submitted feedback about {$category}",
        
        'metadata' => [
            'feedback_id' => $feedback_id,
            'category' => $category,
            'student_user_id' => $student_user_id
        ],
        
        'type' => NotificationService::TYPE_FEEDBACK_RECEIVED,
        'title' => 'New Feedback Received',
        'body' => "{$student_name} submitted feedback about {$category}: \"{$message_preview}\"",
        'icon' => 'message-square',
        'action_url' => "/admin/feedback/{$feedback_id}",
        
        'recipients' => $admins,
        
        'push_data' => [
            'screen' => 'FeedbackDetails',
            'feedback_id' => $feedback_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 7: Admin responds to feedback
// → Notify the student/enrollee who submitted it
// ============================================

public function onFeedbackResponded($feedback_id, $student_user_id, $admin_user_id, $admin_name, $response_preview)
{
    $recipients = [[
        'user_id' => $student_user_id,
        'role' => 'student'
    ]];
    
    $result = $this->NotificationService->create([
        'actor_user_id' => $admin_user_id,
        'actor_role' => 'admin',
        'actor_name' => $admin_name,
        
        'action' => 'feedback.responded',
        'entity_type' => 'feedback',
        'entity_id' => $feedback_id,
        'description' => "{$admin_name} responded to feedback #{$feedback_id}",
        
        'metadata' => [
            'feedback_id' => $feedback_id,
            'responded_by' => $admin_user_id,
            'responded_at' => date('Y-m-d H:i:s')
        ],
        
        'type' => NotificationService::TYPE_FEEDBACK_RESPONDED,
        'title' => 'Feedback Response Received',
        'body' => "Admin responded to your feedback: \"{$response_preview}\"",
        'icon' => 'message-circle',
        'action_url' => "/student/feedback/{$feedback_id}",
        
        'recipients' => $recipients,
        
        'push_data' => [
            'screen' => 'FeedbackDetails',
            'feedback_id' => $feedback_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 8: Activity graded
// → Notify the student
// ============================================

public function onActivityGraded($activity_id, $student_user_id, $teacher_name, $activity_title, $score)
{
    $recipients = [[
        'user_id' => $student_user_id,
        'role' => 'student'
    ]];
    
    $result = $this->NotificationService->create([
        'actor_user_id' => null,
        'actor_role' => 'teacher',
        'actor_name' => $teacher_name,
        
        'action' => 'activity.graded',
        'entity_type' => 'activity',
        'entity_id' => $activity_id,
        'description' => "Activity \"{$activity_title}\" has been graded",
        
        'metadata' => [
            'activity_id' => $activity_id,
            'student_user_id' => $student_user_id,
            'score' => $score
        ],
        
        'type' => NotificationService::TYPE_ACTIVITY_GRADED,
        'title' => 'Activity Graded',
        'body' => "{$teacher_name} graded your activity \"{$activity_title}\". Score: {$score}",
        'icon' => 'check-square',
        'action_url' => "/student/activities/{$activity_id}",
        
        'recipients' => $recipients,
        
        'push_data' => [
            'screen' => 'ActivityDetails',
            'activity_id' => $activity_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 9: Installment due soon
// → Notify the student
// ============================================

public function onInstallmentDueSoon($installment_id, $student_user_id, $amount_due, $due_date)
{
    $recipients = [[
        'user_id' => $student_user_id,
        'role' => 'student'
    ]];
    
    $result = $this->NotificationService->create([
        'actor_user_id' => null,
        'actor_role' => 'system',
        'actor_name' => 'System',
        
        'action' => 'installment.reminder',
        'entity_type' => 'installment',
        'entity_id' => $installment_id,
        'description' => "Payment installment due on {$due_date}",
        
        'metadata' => [
            'installment_id' => $installment_id,
            'amount_due' => $amount_due,
            'due_date' => $due_date,
            'days_until_due' => 3
        ],
        
        'type' => NotificationService::TYPE_INSTALLMENT_DUE_SOON,
        'title' => '⚠️ Payment Due Soon',
        'body' => "Your payment of ₱" . number_format($amount_due, 2) . " is due on {$due_date}. Please pay on time to avoid penalties.",
        'icon' => 'alert-circle',
        'action_url' => "/student/installments/{$installment_id}",
        
        'recipients' => $recipients,
        
        'push_data' => [
            'screen' => 'PaymentPlans',
            'installment_id' => $installment_id
        ]
    ]);
    
    return $result;
}


// ============================================
// SCENARIO 10: RFID entry/exit notification
// → Notify parent (if implemented)
// ============================================

public function onRfidScan($student_user_id, $student_name, $scan_type, $timestamp)
{
    // Get parent user_id (you might need to add a parents table relationship)
    // For now, we'll notify the student's account
    $recipients = [[
        'user_id' => $student_user_id,
        'role' => 'student'
    ]];
    
    $action = $scan_type === 'entry' ? 'rfid.entry' : 'rfid.exit';
    $title = $scan_type === 'entry' ? '🏫 Campus Entry' : '🚪 Campus Exit';
    $body = $scan_type === 'entry' 
        ? "{$student_name} entered campus at {$timestamp}"
        : "{$student_name} left campus at {$timestamp}";
    
    $result = $this->NotificationService->create([
        'actor_user_id' => $student_user_id,
        'actor_role' => 'student',
        'actor_name' => $student_name,
        
        'action' => $action,
        'entity_type' => 'rfid_scan',
        'entity_id' => $student_user_id,
        'description' => "{$student_name} {$scan_type} at {$timestamp}",
        
        'metadata' => [
            'student_user_id' => $student_user_id,
            'scan_type' => $scan_type,
            'timestamp' => $timestamp
        ],
        
        'type' => $scan_type === 'entry' ? NotificationService::TYPE_RFID_ENTRY : NotificationService::TYPE_RFID_EXIT,
        'title' => $title,
        'body' => $body,
        'icon' => $scan_type === 'entry' ? 'log-in' : 'log-out',
        'action_url' => "/student/attendance",
        
        'recipients' => $recipients,
        
        'push_data' => [
            'screen' => 'Attendance',
            'scan_type' => $scan_type
        ]
    ]);
    
    return $result;
}


// ============================================
// USAGE IN CONTROLLERS
// ============================================

/**
 * Example: In your Enrollment Controller
 */
class Enrollments extends Controller
{
    public function submit_enrollment()
    {
        // ... your enrollment submission logic ...
        
        $enrollment_id = $this->db->insert_id();
        $enrollee_user_id = $this->session->userdata('id');
        $enrollee_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
        
        // Send notifications
        $this->load->library('NotificationService');
        $this->NotificationService->onEnrollmentSubmitted(
            $enrollment_id,
            $enrollee_user_id,
            $enrollee_name
        );
        
        // ... rest of your code ...
    }
}


/**
 * Example: In your Payments Controller
 */
class Payments extends Controller
{
    public function process_payment()
    {
        // ... your payment processing logic ...
        
        $payment_id = $this->db->insert_id();
        $student_user_id = $this->session->userdata('id');
        $student_name = $this->session->userdata('first_name') . ' ' . $this->session->userdata('last_name');
        $amount = $_POST['amount'];
        
        // Send notifications
        $this->load->library('NotificationService');
        $this->NotificationService->onPaymentReceived(
            $payment_id,
            $student_user_id,
            $student_name,
            $amount
        );
        
        // ... rest of your code ...
    }
}
