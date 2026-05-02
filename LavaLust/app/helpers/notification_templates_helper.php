<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Helper: notification_templates_helper.php
 *
 * Centralized notification templates for all system notifications.
 * Keeps notification messages consistent, reusable, and easy to maintain.
 * All messages use simple, non-technical language.
 * 
 * Usage in controllers:
 * $this->call->helper('notification_templates');
 * $notificationData = get_payment_received_notification($studentName, $amount, $paymentType);
 * $this->NotificationService->create($notificationData);
 */

// ============================================
// PAYMENT NOTIFICATION TEMPLATES
// ============================================

/**
 * Payment Received Notification (to Admin)
 * When a student submits a payment
 * 
 * @param string $studentName Student's full name
 * @param float $amount Payment amount
 * @param string $paymentType Type of payment (e.g., "Tuition Full Payment")
 * @param int $paymentId Payment ID
 * @param int $studentId Student user ID
 * @param string $paymentMethod Payment method (Cash, GCash, etc.)
 * @return array Notification data array
 */
function get_payment_received_notification($studentName, $amount, $paymentType, $paymentId, $studentId, $paymentMethod = 'Cash')
{
    $formattedAmount = number_format($amount, 2);
    
    return [
        'type' => NotificationService::TYPE_PAYMENT_SUBMITTED,
        'title' => 'New Payment Submitted',
        'body' => "{$studentName} submitted a {$paymentType} payment of ₱{$formattedAmount}",
        'icon' => 'dollar-sign',
        'action_url' => '/admin/payments',
        'push_data' => [
            'screen' => 'PaymentDetails',
            'payment_id' => $paymentId
        ],
        'metadata' => [
            'payment_id' => $paymentId,
            'amount' => $amount,
            'payment_type' => $paymentType,
            'payment_method' => $paymentMethod
        ],
        'action' => 'payment.submitted',
        'entity_type' => 'payment',
        'entity_id' => $paymentId,
        'actor_user_id' => $studentId,
        'actor_role' => 'student',
        'actor_name' => $studentName,
        'description' => "{$studentName} submitted a payment of ₱{$formattedAmount}"
    ];
}

/**
 * Payment Approved Notification (to Student)
 * When admin approves a payment
 * 
 * @param string $paymentType Type of payment
 * @param float $amount Payment amount
 * @param int $paymentId Payment ID
 * @param int $studentId Student user ID
 * @param int $adminId Admin user ID
 * @param string $adminName Admin's full name
 * @return array Notification data array
 */
function get_payment_approved_notification($paymentType, $amount, $paymentId, $studentId, $adminId, $adminName)
{
    $formattedAmount = number_format($amount, 2);
    
    return [
        'type' => NotificationService::TYPE_PAYMENT_CONFIRMED,
        'title' => 'Payment Approved',
        'body' => "Your {$paymentType} payment of ₱{$formattedAmount} has been approved",
        'icon' => 'check-circle',
        'action_url' => '/enrollment/payment',
        'push_data' => [
            'screen' => 'PaymentHistory',
            'payment_id' => $paymentId
        ],
        'metadata' => [
            'payment_id' => $paymentId,
            'amount' => $amount,
            'payment_type' => $paymentType,
            'old_status' => 'pending',
            'new_status' => 'approved'
        ],
        'action' => 'payment.approved',
        'entity_type' => 'payment',
        'entity_id' => $paymentId,
        'actor_user_id' => $adminId,
        'actor_role' => 'admin',
        'actor_name' => $adminName,
        'description' => "Payment of ₱{$formattedAmount} has been approved",
        'recipients' => [[
            'user_id' => $studentId,
            'role' => 'student'
        ]]
    ];
}

/**
 * Payment Rejected Notification (to Student)
 * When admin rejects a payment
 * 
 * @param float $amount Payment amount
 * @param string $reason Rejection reason
 * @param int $paymentId Payment ID
 * @param int $studentId Student user ID
 * @param int $adminId Admin user ID
 * @param string $adminName Admin's full name
 * @param string $paymentType Type of payment (optional)
 * @return array Notification data array
 */
function get_payment_rejected_notification($amount, $reason, $paymentId, $studentId, $adminId, $adminName, $paymentType = 'Payment')
{
    $formattedAmount = number_format($amount, 2);
    $reasonText = !empty($reason) ? $reason : 'Please contact the cashier for more details';
    
    return [
        'type' => NotificationService::TYPE_PAYMENT_FAILED,
        'title' => 'Payment Declined',
        'body' => "Your payment of ₱{$formattedAmount} was declined. {$reasonText}",
        'icon' => 'x-circle',
        'action_url' => '/enrollment/payment',
        'push_data' => [
            'screen' => 'PaymentHistory',
            'payment_id' => $paymentId
        ],
        'metadata' => [
            'payment_id' => $paymentId,
            'amount' => $amount,
            'payment_type' => $paymentType,
            'old_status' => 'pending',
            'new_status' => 'rejected',
            'reason' => $reason
        ],
        'action' => 'payment.rejected',
        'entity_type' => 'payment',
        'entity_id' => $paymentId,
        'actor_user_id' => $adminId,
        'actor_role' => 'admin',
        'actor_name' => $adminName,
        'description' => "Payment of ₱{$formattedAmount} was declined",
        'recipients' => [[
            'user_id' => $studentId,
            'role' => 'student'
        ]]
    ];
}

/**
 * Refund Processed Notification (to Student)
 * When admin processes a refund
 * 
 * @param float $refundAmount Refund amount
 * @param string $reason Refund reason
 * @param int $refundId Refund payment ID
 * @param int $originalPaymentId Original payment ID
 * @param int $studentId Student user ID
 * @param int $adminId Admin user ID
 * @param string $adminName Admin's full name
 * @return array Notification data array
 */
function get_refund_processed_notification($refundAmount, $reason, $refundId, $originalPaymentId, $studentId, $adminId, $adminName)
{
    $formattedAmount = number_format($refundAmount, 2);
    $reasonText = !empty($reason) ? $reason : 'Refund processed';
    
    return [
        'type' => NotificationService::TYPE_PAYMENT_REFUND,
        'title' => 'Refund Processed',
        'body' => "A refund of ₱{$formattedAmount} has been processed for your payment. {$reasonText}",
        'icon' => 'arrow-left-circle',
        'action_url' => '/enrollment/payment',
        'push_data' => [
            'screen' => 'PaymentHistory',
            'refund_id' => $refundId
        ],
        'metadata' => [
            'refund_id' => $refundId,
            'original_payment_id' => $originalPaymentId,
            'refund_amount' => $refundAmount,
            'refund_reason' => $reason
        ],
        'action' => 'payment.refunded',
        'entity_type' => 'payment',
        'entity_id' => $refundId,
        'actor_user_id' => $adminId,
        'actor_role' => 'admin',
        'actor_name' => $adminName,
        'description' => "Refund of ₱{$formattedAmount} has been processed",
        'recipients' => [[
            'user_id' => $studentId,
            'role' => 'student'
        ]]
    ];
}

// ============================================
// ENROLLMENT NOTIFICATION TEMPLATES
// ============================================

/**
 * Enrollment Submitted Notification (to Admin)
 * When a student/enrollee submits enrollment application
 * 
 * @param string $enrolleeName Enrollee's full name
 * @param int $enrollmentId Enrollment ID
 * @param int $enrolleeUserId Enrollee user ID
 * @return array Notification data array
 */
function get_enrollment_submitted_notification($enrolleeName, $enrollmentId, $enrolleeUserId)
{
    return [
        'type' => NotificationService::TYPE_ENROLLMENT_SUBMITTED,
        'title' => 'New Enrollment Submitted',
        'body' => "{$enrolleeName} has submitted a new enrollment application. Please review.",
        'icon' => 'file-text',
        'action_url' => "/admin/enrollments/{$enrollmentId}",
        'push_data' => [
            'screen' => 'EnrollmentDetails',
            'enrollment_id' => $enrollmentId
        ],
        'metadata' => [
            'enrollment_id' => $enrollmentId,
            'enrollee_user_id' => $enrolleeUserId
        ],
        'action' => 'enrollment.submitted',
        'entity_type' => 'enrollment',
        'entity_id' => $enrollmentId,
        'actor_user_id' => $enrolleeUserId,
        'actor_role' => 'enrollee',
        'actor_name' => $enrolleeName,
        'description' => "{$enrolleeName} submitted a new enrollment application"
    ];
}

/**
 * Enrollment Approved Notification (to Student/Enrollee)
 * When admin approves enrollment
 * 
 * @param int $enrollmentId Enrollment ID
 * @param int $enrolleeUserId Enrollee user ID
 * @param int $adminId Admin user ID
 * @param string $adminName Admin's full name
 * @return array Notification data array
 */
function get_enrollment_approved_notification($enrollmentId, $enrolleeUserId, $adminId, $adminName)
{
    return [
        'type' => NotificationService::TYPE_ENROLLMENT_APPROVED,
        'title' => '🎉 Enrollment Approved!',
        'body' => 'Congratulations! Your enrollment application has been approved.',
        'icon' => 'check-circle',
        'action_url' => "/enrollee/enrollment/{$enrollmentId}",
        'push_data' => [
            'screen' => 'EnrollmentStatus',
            'enrollment_id' => $enrollmentId
        ],
        'metadata' => [
            'enrollment_id' => $enrollmentId,
            'old_status' => 'pending',
            'new_status' => 'approved',
            'approved_by' => $adminId
        ],
        'action' => 'enrollment.approved',
        'entity_type' => 'enrollment',
        'entity_id' => $enrollmentId,
        'actor_user_id' => $adminId,
        'actor_role' => 'admin',
        'actor_name' => $adminName,
        'description' => "Enrollment #{$enrollmentId} was approved by {$adminName}",
        'recipients' => [[
            'user_id' => $enrolleeUserId,
            'role' => 'enrollee'
        ]]
    ];
}

/**
 * Enrollment Rejected Notification (to Student/Enrollee)
 * When admin rejects enrollment
 * 
 * @param int $enrollmentId Enrollment ID
 * @param string $reason Rejection reason
 * @param int $enrolleeUserId Enrollee user ID
 * @param int $adminId Admin user ID
 * @param string $adminName Admin's full name
 * @return array Notification data array
 */
function get_enrollment_rejected_notification($enrollmentId, $reason, $enrolleeUserId, $adminId, $adminName)
{
    $reasonText = !empty($reason) ? $reason : 'Please check your application for missing requirements';
    
    return [
        'type' => NotificationService::TYPE_ENROLLMENT_REJECTED,
        'title' => 'Enrollment Update',
        'body' => "Your enrollment application needs attention. {$reasonText}",
        'icon' => 'info',
        'action_url' => "/enrollee/enrollment/{$enrollmentId}",
        'push_data' => [
            'screen' => 'EnrollmentStatus',
            'enrollment_id' => $enrollmentId
        ],
        'metadata' => [
            'enrollment_id' => $enrollmentId,
            'old_status' => 'pending',
            'new_status' => 'rejected',
            'rejected_by' => $adminId,
            'reason' => $reason
        ],
        'action' => 'enrollment.rejected',
        'entity_type' => 'enrollment',
        'entity_id' => $enrollmentId,
        'actor_user_id' => $adminId,
        'actor_role' => 'admin',
        'actor_name' => $adminName,
        'description' => "Enrollment #{$enrollmentId} needs review",
        'recipients' => [[
            'user_id' => $enrolleeUserId,
            'role' => 'enrollee'
        ]]
    ];
}

// ============================================
// ACTIVITY NOTIFICATION TEMPLATES
// ============================================

/**
 * Activity Posted Notification (to Students)
 * When teacher posts a new activity
 * 
 * @param string $teacherName Teacher's full name
 * @param string $activityTitle Activity title
 * @param int $activityId Activity ID
 * @param int $teacherId Teacher user ID
 * @param string $dueDate Due date (optional)
 * @return array Notification data array
 */
function get_activity_posted_notification($teacherName, $activityTitle, $activityId, $teacherId, $dueDate = null)
{
    $dueDateText = $dueDate ? " - Due {$dueDate}" : '';
    
    return [
        'type' => NotificationService::TYPE_ACTIVITY_POSTED,
        'title' => 'New Activity Posted',
        'body' => "{$teacherName} posted a new activity: {$activityTitle}{$dueDateText}",
        'icon' => 'clipboard',
        'action_url' => "/student/activities/{$activityId}",
        'push_data' => [
            'screen' => 'ActivityDetails',
            'activity_id' => $activityId
        ],
        'metadata' => [
            'activity_id' => $activityId,
            'due_date' => $dueDate
        ],
        'action' => 'activity.posted',
        'entity_type' => 'activity',
        'entity_id' => $activityId,
        'actor_user_id' => $teacherId,
        'actor_role' => 'teacher',
        'actor_name' => $teacherName,
        'description' => "{$teacherName} posted a new activity: {$activityTitle}"
    ];
}

/**
 * Activity Submitted Notification (to Teacher)
 * When student submits an activity
 * 
 * @param string $studentName Student's full name
 * @param string $activityTitle Activity title
 * @param int $activityId Activity ID
 * @param int $studentId Student user ID
 * @param int $submissionId Submission ID
 * @return array Notification data array
 */
function get_activity_submitted_notification($studentName, $activityTitle, $activityId, $studentId, $submissionId)
{
    return [
        'type' => NotificationService::TYPE_ACTIVITY_SUBMITTED,
        'title' => 'Activity Submitted',
        'body' => "{$studentName} submitted {$activityTitle}",
        'icon' => 'upload',
        'action_url' => "/teacher/activities/{$activityId}/submissions",
        'push_data' => [
            'screen' => 'ActivitySubmissions',
            'activity_id' => $activityId,
            'submission_id' => $submissionId
        ],
        'metadata' => [
            'activity_id' => $activityId,
            'submission_id' => $submissionId
        ],
        'action' => 'activity.submitted',
        'entity_type' => 'activity',
        'entity_id' => $activityId,
        'actor_user_id' => $studentId,
        'actor_role' => 'student',
        'actor_name' => $studentName,
        'description' => "{$studentName} submitted {$activityTitle}"
    ];
}

/**
 * Activity Graded Notification (to Student)
 * When teacher grades a submission
 * 
 * @param string $activityTitle Activity title
 * @param int $score Student's score
 * @param int $totalPoints Total possible points
 * @param int $activityId Activity ID
 * @param int $studentId Student user ID
 * @param int $teacherId Teacher user ID
 * @param string $teacherName Teacher's full name
 * @return array Notification data array
 */
function get_activity_graded_notification($activityTitle, $score, $totalPoints, $activityId, $studentId, $teacherId, $teacherName)
{
    return [
        'type' => NotificationService::TYPE_ACTIVITY_GRADED,
        'title' => 'Activity Graded',
        'body' => "Your submission for {$activityTitle} has been graded. Score: {$score}/{$totalPoints}",
        'icon' => 'star',
        'action_url' => "/student/activities/{$activityId}",
        'push_data' => [
            'screen' => 'ActivityDetails',
            'activity_id' => $activityId
        ],
        'metadata' => [
            'activity_id' => $activityId,
            'score' => $score,
            'total_points' => $totalPoints
        ],
        'action' => 'activity.graded',
        'entity_type' => 'activity',
        'entity_id' => $activityId,
        'actor_user_id' => $teacherId,
        'actor_role' => 'teacher',
        'actor_name' => $teacherName,
        'description' => "Your submission for {$activityTitle} has been graded",
        'recipients' => [[
            'user_id' => $studentId,
            'role' => 'student'
        ]]
    ];
}

// ============================================
// FEEDBACK NOTIFICATION TEMPLATES
// ============================================

/**
 * Feedback Submitted Notification (to Admin/Teacher)
 * When student submits feedback
 * 
 * @param string $studentName Student's full name
 * @param string $subject Feedback subject/category
 * @param int $feedbackId Feedback ID
 * @param int $studentId Student user ID
 * @return array Notification data array
 */
function get_feedback_submitted_notification($studentName, $subject, $feedbackId, $studentId)
{
    return [
        'type' => NotificationService::TYPE_FEEDBACK_SUBMITTED,
        'title' => 'New Feedback Received',
        'body' => "{$studentName} submitted feedback about {$subject}",
        'icon' => 'message-circle',
        'action_url' => "/admin/feedback/{$feedbackId}",
        'push_data' => [
            'screen' => 'FeedbackDetails',
            'feedback_id' => $feedbackId
        ],
        'metadata' => [
            'feedback_id' => $feedbackId,
            'subject' => $subject
        ],
        'action' => 'feedback.submitted',
        'entity_type' => 'feedback',
        'entity_id' => $feedbackId,
        'actor_user_id' => $studentId,
        'actor_role' => 'student',
        'actor_name' => $studentName,
        'description' => "{$studentName} submitted feedback about {$subject}"
    ];
}

/**
 * Feedback Responded Notification (to Student)
 * When admin/teacher responds to feedback
 * 
 * @param string $subject Feedback subject/category
 * @param int $feedbackId Feedback ID
 * @param int $studentId Student user ID
 * @param int $responderId Responder user ID
 * @param string $responderName Responder's full name
 * @return array Notification data array
 */
function get_feedback_responded_notification($subject, $feedbackId, $studentId, $responderId, $responderName)
{
    return [
        'type' => NotificationService::TYPE_FEEDBACK_RESPONDED,
        'title' => 'Response to Your Feedback',
        'body' => "We've responded to your feedback about {$subject}. Check your messages.",
        'icon' => 'message-circle',
        'action_url' => "/student/feedback/{$feedbackId}",
        'push_data' => [
            'screen' => 'FeedbackDetails',
            'feedback_id' => $feedbackId
        ],
        'metadata' => [
            'feedback_id' => $feedbackId,
            'subject' => $subject
        ],
        'action' => 'feedback.responded',
        'entity_type' => 'feedback',
        'entity_id' => $feedbackId,
        'actor_user_id' => $responderId,
        'actor_role' => 'admin',
        'actor_name' => $responderName,
        'description' => "Feedback about {$subject} has been responded to",
        'recipients' => [[
            'user_id' => $studentId,
            'role' => 'student'
        ]]
    ];
}

// ============================================
// SYSTEM NOTIFICATION TEMPLATES
// ============================================

/**
 * Generic System Notification
 * For general system messages
 * 
 * @param string $title Notification title
 * @param string $message Notification message
 * @param string $icon Icon name (optional)
 * @param string $actionUrl Action URL (optional)
 * @return array Notification data array
 */
function get_system_notification($title, $message, $icon = 'info', $actionUrl = null)
{
    return [
        'type' => NotificationService::TYPE_SYSTEM,
        'title' => $title,
        'body' => $message,
        'icon' => $icon,
        'action_url' => $actionUrl,
        'push_data' => [
            'screen' => 'Home'
        ],
        'metadata' => [],
        'action' => 'system.notification',
        'entity_type' => 'system',
        'entity_id' => null,
        'actor_user_id' => null,
        'actor_role' => 'system',
        'actor_name' => 'System',
        'description' => $message
    ];
}

/**
 * Announcement Notification
 * For school-wide or targeted announcements
 * 
 * @param string $title Announcement title
 * @param string $content Announcement content
 * @param int $announcementId Announcement ID (optional)
 * @return array Notification data array
 */
function get_announcement_notification($title, $content, $announcementId = null)
{
    return [
        'type' => NotificationService::TYPE_ANNOUNCEMENT,
        'title' => $title,
        'body' => $content,
        'icon' => 'megaphone',
        'action_url' => $announcementId ? "/announcements/{$announcementId}" : "/announcements",
        'push_data' => [
            'screen' => 'Announcements',
            'announcement_id' => $announcementId
        ],
        'metadata' => [
            'announcement_id' => $announcementId
        ],
        'action' => 'announcement.posted',
        'entity_type' => 'announcement',
        'entity_id' => $announcementId,
        'actor_user_id' => null,
        'actor_role' => 'admin',
        'actor_name' => 'Admin',
        'description' => $title
    ];
}
