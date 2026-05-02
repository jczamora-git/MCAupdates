# Notification Message Templates

This document contains all notification message templates used in the Campus Companion system.
All messages are written in simple, non-technical language that's easy for students, parents, and staff to understand.

---

## **PAYMENT NOTIFICATIONS**

### 1. Payment Received (to Admin)
**Scenario:** Student submits a payment  
**Recipient:** Admin/Cashier  

```
Title: New Payment Received
Message: [Student Name] submitted a [Payment Type] payment of ₱[Amount]
Icon: 💵 (dollar-sign)
```

**Example:**
```
Title: New Payment Received
Message: Juan Dela Cruz submitted a Tuition Full Payment payment of ₱15,000.00
```

---

### 2. Payment Approved (to Student)
**Scenario:** Admin approves a payment  
**Recipient:** Student  

```
Title: Payment Approved
Message: Your [Payment Type] payment of ₱[Amount] has been approved
Icon: ✅ (check-circle)
```

**Example:**
```
Title: Payment Approved
Message: Your Tuition Full Payment payment of ₱15,000.00 has been approved
```

---

### 3. Payment Verified (to Student)
**Scenario:** Admin verifies a GCash payment  
**Recipient:** Student  

```
Title: Payment Approved
Message: Your [Payment Type] payment of ₱[Amount] has been approved
Icon: ✅ (check-circle)
```

**Example:**
```
Title: Payment Approved
Message: Your Service Fee payment of ₱500.00 has been approved
```

---

### 4. Payment Declined (to Student)
**Scenario:** Admin rejects a payment  
**Recipient:** Student  

```
Title: Payment Declined
Message: Your payment of ₱[Amount] was declined. [Reason]
Icon: ❌ (x-circle)
```

**Example:**
```
Title: Payment Declined
Message: Your payment of ₱15,000.00 was declined. Invalid proof of payment. Please upload a clear photo.
```

---

### 5. Refund Processed (to Student)
**Scenario:** Admin processes a refund  
**Recipient:** Student  

```
Title: Refund Processed
Message: A refund of ₱[Amount] has been processed for your payment. [Reason]
Icon: ↩️ (arrow-left-circle)
```

**Example:**
```
Title: Refund Processed
Message: A refund of ₱5,000.00 has been processed for your payment. Overpayment adjustment
```

---

## **ENROLLMENT NOTIFICATIONS**

### 6. Enrollment Submitted (to Admin)
**Scenario:** Student submits enrollment application  
**Recipient:** Admin  

```
Title: New Enrollment Submitted
Message: [Student Name] has submitted a new enrollment application. Please review.
Icon: 📄 (file-text)
```

**Example:**
```
Title: New Enrollment Submitted
Message: Maria Santos has submitted a new enrollment application. Please review.
```

---

### 7. Enrollment Approved (to Student/Parent)
**Scenario:** Admin approves enrollment  
**Recipient:** Student/Enrollee  

```
Title: 🎉 Enrollment Approved!
Message: Congratulations! Your enrollment application has been approved.
Icon: ✅ (check-circle)
```

---

### 8. Enrollment Rejected (to Student/Parent)
**Scenario:** Admin rejects enrollment  
**Recipient:** Student/Enrollee  

```
Title: Enrollment Update
Message: Your enrollment application needs attention. [Reason]
Icon: ℹ️ (info)
```

**Example:**
```
Title: Enrollment Update
Message: Your enrollment application needs attention. Missing birth certificate. Please upload required documents.
```

---

## **ACTIVITY NOTIFICATIONS**

### 9. New Activity Posted (to Students)
**Scenario:** Teacher posts a new activity  
**Recipient:** Students in class  

```
Title: New Activity Posted
Message: [Teacher Name] posted a new activity: [Activity Title]
Icon: 📝 (clipboard)
```

**Example:**
```
Title: New Activity Posted
Message: Ms. Garcia posted a new activity: Math Quiz #3 - Due Feb 28
```

---

### 10. Activity Submitted (to Teacher)
**Scenario:** Student submits an activity  
**Recipient:** Teacher  

```
Title: Activity Submitted
Message: [Student Name] submitted [Activity Title]
Icon: 📤 (upload)
```

**Example:**
```
Title: Activity Submitted
Message: Pedro Reyes submitted Math Quiz #3
```

---

### 11. Activity Graded (to Student)
**Scenario:** Teacher grades a submission  
**Recipient:** Student  

```
Title: Activity Graded
Message: Your submission for [Activity Title] has been graded. Score: [Points]/[Total]
Icon: ⭐ (star)
```

**Example:**
```
Title: Activity Graded
Message: Your submission for Math Quiz #3 has been graded. Score: 45/50
```

---

## **FEEDBACK NOTIFICATIONS**

### 12. Feedback Submitted (to Admin/Teacher)
**Scenario:** Student submits feedback  
**Recipient:** Admin or Teacher  

```
Title: New Feedback Received
Message: [Student Name] submitted feedback about [Subject/Category]
Icon: 💬 (message-circle)
```

**Example:**
```
Title: New Feedback Received
Message: Anna Cruz submitted feedback about Canteen Services
```

---

### 13. Feedback Responded (to Student)
**Scenario:** Admin/Teacher responds to feedback  
**Recipient:** Student  

```
Title: Response to Your Feedback
Message: We've responded to your feedback about [Subject]. Check your messages.
Icon: 💬 (message-circle)
```

**Example:**
```
Title: Response to Your Feedback
Message: We've responded to your feedback about Canteen Services. Check your messages.
```

---

## **ANNOUNCEMENT NOTIFICATIONS**

### 14. New Announcement
**Scenario:** Admin posts announcement  
**Recipient:** All users or specific role  

```
Title: [Announcement Title]
Message: [Announcement Content]
Icon: 📢 (megaphone)
```

**Example:**
```
Title: School Closure Notice
Message: Classes are suspended tomorrow, Feb 26, due to weather conditions. Stay safe!
```

---

## **GENERAL SYSTEM NOTIFICATIONS**

### 15. Account Created
**Scenario:** New account is created  
**Recipient:** New user  

```
Title: Welcome to Campus Companion!
Message: Your account has been created. You can now access the system.
Icon: 👋 (hand-wave)
```

---

### 16. Password Changed
**Scenario:** User changes password  
**Recipient:** User  

```
Title: Password Updated
Message: Your password has been changed successfully.
Icon: 🔒 (lock)
```

---

### 17. Document Uploaded
**Scenario:** Admin uploads required document  
**Recipient:** Student/Parent  

```
Title: Document Available
Message: [Document Name] is now available for download.
Icon: 📄 (file)
```

**Example:**
```
Title: Document Available
Message: Your Certificate of Enrollment is now available for download.
```

---

## **WRITING GUIDELINES**

When creating notification messages:

1. **Keep it Simple** - Avoid technical jargon
   - ❌ "Payment transaction has been successfully validated"
   - ✅ "Your payment has been approved"

2. **Be Specific** - Include relevant details
   - ❌ "Something happened with your payment"
   - ✅ "Your Tuition payment of ₱15,000 has been approved"

3. **Be Clear About Actions Needed**
   - ❌ "Payment issue"
   - ✅ "Your payment was declined. Please upload a clear photo."

4. **Use Friendly Tone** - Be helpful, not robotic
   - ❌ "Request processed successfully"
   - ✅ "Your refund of ₱5,000 has been processed"

5. **Length** - Keep messages under 100 characters when possible
   - Title: Maximum 50 characters
   - Body: Maximum 150 characters (push notifications have limits)

6. **Emojis** - Use sparingly and appropriately
   - ✅ Celebrations: 🎉
   - ✅ Money: 💵
   - ✅ Warnings: ⚠️
   - ❌ Don't overuse: 🎉🎊🎁✨

---

## **NOTIFICATION TYPES (Technical Reference)**

For developers implementing notifications:

```php
// Payment Types
NotificationService::TYPE_PAYMENT_RECEIVED    // Admin notification
NotificationService::TYPE_PAYMENT_CONFIRMED   // Student notification (approved/verified)
NotificationService::TYPE_PAYMENT_FAILED      // Student notification (rejected)
NotificationService::TYPE_PAYMENT_REFUND      // Student notification (refund processed)

// Enrollment Types
NotificationService::TYPE_ENROLLMENT_SUBMITTED  // Admin notification
NotificationService::TYPE_ENROLLMENT_APPROVED   // Student notification
NotificationService::TYPE_ENROLLMENT_REJECTED   // Student notification

// Activity Types
NotificationService::TYPE_ACTIVITY_POSTED       // Student notification
NotificationService::TYPE_ACTIVITY_SUBMITTED    // Teacher notification
NotificationService::TYPE_ACTIVITY_GRADED       // Student notification

// Feedback Types
NotificationService::TYPE_FEEDBACK_SUBMITTED    // Admin/Teacher notification
NotificationService::TYPE_FEEDBACK_RESPONDED    // Student notification

// System Types
NotificationService::TYPE_ANNOUNCEMENT          // All users
NotificationService::TYPE_SYSTEM                // System messages
```

---

## **Testing Notification Messages**

Before going live, test notifications for:

1. **Clarity** - Can a non-technical user understand it?
2. **Grammar** - No typos or errors
3. **Length** - Fits in mobile notification (keep under 100 chars)
4. **Action** - Does the user know what to do next?
5. **Tone** - Is it friendly and helpful?

---

**Last Updated:** February 25, 2026  
**Version:** 1.0
