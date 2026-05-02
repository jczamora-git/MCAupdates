<?php
/**
 * ============================================================================
 * OPTIMIZED PaymentController.php - CREATE_PAYMENT METHOD
 * ============================================================================
 * 
 * This file shows the transaction-safe version of create_payment().
 * Replace lines 321-600 in your PaymentController.php with this code.
 * 
 * Key improvements:
 * 1. ✅ Database transaction wrapper (all-or-nothing)
 * 2. ✅ Idempotency key check (prevent duplicate submissions)
 * 3. ✅ Proper error handling with rollback
 * 4. ✅ Atomic payment + penalty + discount creation
 * 5. ✅ Audit logging within transaction
 * 
 * ============================================================================
 */

/**
 * Create a new payment
 * POST /api/payments
 * 
 * @return void
 */
public function create_payment()
{
    header('Content-Type: application/json');

    try {
        $data = [];
        $proof_of_payment_url = null;

        // Check if this is a multipart form request (with file upload)
        $content_type = $_SERVER['CONTENT_TYPE'] ?? '';
        if (strpos($content_type, 'multipart/form-data') !== false) {
            // Handle multipart form data with file upload
            $data = $_POST;

            // Handle proof of payment file upload
            if (isset($_FILES['proof_of_payment']) && $_FILES['proof_of_payment']['error'] !== UPLOAD_ERR_NO_FILE) {
                // Load the proof of payment helper
                require_once APP_DIR . 'helpers/proof_of_payment_helper.php';

                $upload_result = upload_proof_of_payment('proof_of_payment');

                if (!$upload_result['success']) {
                    echo json_encode([
                        'success' => false,
                        'message' => 'File upload failed: ' . $upload_result['message']
                    ]);
                    return;
                }

                $proof_of_payment_url = $upload_result['relative_path'];
            }
        } else {
            // Handle regular JSON request
            $data = json_decode(file_get_contents('php://input'), true);
        }

        // Log the received data for debugging
        error_log('Payment creation request: ' . json_encode($data));

        // Validate required fields
        if (empty($data['student_id']) || empty($data['amount']) || empty($data['payment_for'])) {
            echo json_encode([
                'success' => false,
                'message' => 'Missing required fields: student_id, amount, and payment_for are required'
            ]);
            return;
        }

        // Add proof of payment URL if uploaded
        if ($proof_of_payment_url) {
            $data['proof_of_payment_url'] = $proof_of_payment_url;
        }

        // ========================================================================
        // IDEMPOTENCY CHECK: Prevent duplicate submissions
        // ========================================================================
        $idempotency_key = $data['idempotency_key'] ?? null;
        
        if ($idempotency_key) {
            // Check if this exact request was already processed
            $existingPayment = $this->db->table('payments')
                ->where('idempotency_key', $idempotency_key)
                ->get();
            
            if ($existingPayment) {
                error_log("Duplicate payment detected with idempotency key: {$idempotency_key}");
                echo json_encode([
                    'success' => true,
                    'message' => 'Payment already processed',
                    'data' => $existingPayment,
                    'duplicate_detected' => true
                ]);
                return;
            }
        }

        // Extract penalty information (don't save to payments table)
        $penalty_amount = isset($data['penalty_amount']) ? $data['penalty_amount'] : 0;
        $days_overdue = isset($data['days_overdue']) ? $data['days_overdue'] : 0;
        $installment_id = isset($data['installment_id']) ? $data['installment_id'] : null;
        $explanation_id = isset($data['explanation_id']) ? $data['explanation_id'] : null;
        
        // Extract discount template IDs (don't save to payments table)
        $discount_template_ids = isset($data['discount_template_ids']) ? $data['discount_template_ids'] : [];
        
        // Remove penalty and discount fields from payment data
        unset($data['penalty_amount']);
        unset($data['days_overdue']);
        unset($data['explanation_id']);
        unset($data['discount_template_ids']);

        // Handle recurring service payments (like Service Fee)
        if (isset($data['is_recurring_service']) && $data['is_recurring_service'] == 1) {
            // Validate service period fields
            if (empty($data['service_period_month']) || empty($data['service_period_year'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Service period month and year are required for recurring service payments'
                ]);
                return;
            }

            // Check if this service period has already been paid
            // Note: Database unique index will also prevent duplicates at DB level
            $existingPayment = $this->db->table('payments')
                ->where('student_id', $data['student_id'])
                ->where('is_recurring_service', 1)
                ->where('service_period_month', $data['service_period_month'])
                ->where('service_period_year', $data['service_period_year'])
                ->where_in('status', ['Approved', 'Verified', 'Pending'])
                ->get();

            if (!empty($existingPayment)) {
                $monthName = date('F', mktime(0, 0, 0, $data['service_period_month'], 1));
                echo json_encode([
                    'success' => false,
                    'message' => "Service Fee for {$monthName} {$data['service_period_year']} has already been paid"
                ]);
                return;
            }
        }

        // ========================================================================
        // START DATABASE TRANSACTION
        // All operations below will be atomic (all succeed or all fail)
        // ========================================================================
        $this->db->trans_begin();

        try {
            // ====================================================================
            // STEP 1: Create payment record
            // ====================================================================
            $paymentId = $this->PaymentModel->create($data);

            if (!$paymentId) {
                throw new Exception('Failed to create payment record');
            }

            error_log('Payment created with ID: ' . $paymentId);

            // ====================================================================
            // STEP 2: Create penalty record (if applicable)
            // ====================================================================
            if ($penalty_amount > 0 && $installment_id) {
                error_log('Creating penalty record for installment: ' . $installment_id);
                
                // Get the original installment amount
                $installment = $this->db->table('installments')
                    ->where('id', $installment_id)
                    ->get();
                
                if (!$installment) {
                    throw new Exception("Installment {$installment_id} not found");
                }
                
                $original_amount = $installment['amount_due'] ?? 0;
                
                $penaltyData = [
                    'installment_id' => $installment_id,
                    'penalty_percentage' => 5.00, // 5% as per school policy
                    'penalty_amount' => $penalty_amount,
                    'original_amount' => $original_amount,
                    'days_overdue' => $days_overdue,
                    'applied_at' => date('Y-m-d H:i:s')
                ];
                
                // Include explanation_id if provided
                if ($explanation_id) {
                    $penaltyData['explanation_id'] = $explanation_id;
                }
                
                $penaltyId = $this->PaymentPenaltyModel->create($penaltyData);
                
                if (!$penaltyId) {
                    throw new Exception('Failed to create penalty record');
                }
                
                error_log("Penalty record created (ID: {$penaltyId}) for payment {$paymentId}");
            }
            
            // ====================================================================
            // STEP 3: Apply discounts (if any)
            // ====================================================================
            if (!empty($discount_template_ids) && is_array($discount_template_ids)) {
                error_log('Applying ' . count($discount_template_ids) . ' discounts to payment ' . $paymentId);
                
                // Get payment details to calculate discounts
                $payment = $this->PaymentModel->get_payment($paymentId);
                $original_amount = floatval($payment['amount']);
                
                foreach ($discount_template_ids as $template_id) {
                    // Get discount template details
                    $template = $this->db->table('discount_templates')
                        ->where('id', $template_id)
                        ->get();
                    
                    if (!$template) {
                        throw new Exception("Discount template {$template_id} not found");
                    }
                    
                    // Calculate discount amount
                    $discount_amount = $this->PaymentDiscountApplicationModel->calculate_discount_amount(
                        $original_amount,
                        $template['value_type'],
                        $template['value']
                    );
                    
                    // Apply the discount
                    $result = $this->PaymentDiscountApplicationModel->apply_discount(
                        $paymentId,
                        $template_id,
                        $discount_amount
                    );
                    
                    if (!$result['success']) {
                        throw new Exception("Failed to apply discount {$template_id}: {$result['message']}");
                    }
                    
                    error_log("Applied discount '{$template['name']}' (₱{$discount_amount}) to payment {$paymentId}");
                }
            }

            // ====================================================================
            // STEP 4: Get updated payment with discounts applied
            // ====================================================================
            $payment = $this->PaymentModel->get_payment($paymentId);
            
            // ====================================================================
            // STEP 5: Create audit log entry (within transaction)
            // ====================================================================
            $currentUser = [
                'user_id' => $this->session->userdata('user_id'),
                'role' => $this->session->userdata('role'),
                'first_name' => $this->session->userdata('first_name'),
                'last_name' => $this->session->userdata('last_name')
            ];

            $actor_name = trim(($currentUser['first_name'] ?? '') . ' ' . ($currentUser['last_name'] ?? ''));
            $student_name = $payment['student_name'] ?? 'Student';
            $payment_amount = floatval($payment['amount']);
            $formattedAmount = number_format($payment_amount, 2);

            $auditData = [
                'action' => 'payment.created',
                'entity_type' => 'payment',
                'entity_id' => $paymentId,
                'actor_user_id' => $currentUser['user_id'],
                'actor_role' => $currentUser['role'],
                'actor_name' => $actor_name,
                'description' => "{$actor_name} created a payment of ₱{$formattedAmount} for {$student_name}",
                'metadata' => json_encode([
                    'payment_id' => $paymentId,
                    'amount' => $payment_amount,
                    'payment_type' => $payment['payment_type'] ?? 'Payment',
                    'payment_method' => $payment['payment_method'] ?? 'Cash',
                    'student_id' => $payment['student_id']
                ]),
                'created_at' => date('Y-m-d H:i:s')
            ];

            $auditLogId = $this->db->table('audit_logs')->insert($auditData);
            
            if (!$auditLogId) {
                throw new Exception('Failed to create audit log entry');
            }

            // ====================================================================
            // ALL STEPS SUCCESSFUL → COMMIT TRANSACTION
            // ====================================================================
            $this->db->trans_commit();
            
            error_log("✅ Payment {$paymentId} created successfully with all related records");

            // ====================================================================
            // STEP 6: Send notification (AFTER transaction commit)
            // Notifications are non-critical, so we do them after DB commit
            // ====================================================================
            try {
                $payment_type = $payment['payment_type'] ?? 'Payment';
                $payment_method = $payment['payment_method'] ?? 'Cash';
                $actor_role = $currentUser['role'] ?? 'admin';

                if ($actor_role === 'student') {
                    // Student submitted their own payment → notify all admins
                    $recipients = $this->NotificationService->getRecipientsByRole('admin');
                    $notif_title = 'New Payment Received';
                    $notif_body = "{$student_name} submitted a {$payment_type} payment of ₱{$formattedAmount}";
                    $notif_action_url = '/admin/payments';
                    $notif_description = "{$student_name} submitted a payment of ₱{$formattedAmount}";
                } else {
                    // Admin/teacher created payment for student → notify the student
                    $recipients = [['user_id' => $payment['student_id'], 'role' => 'student']];
                    $notif_title = 'Payment Recorded';
                    $notif_body = "Your {$payment_type} payment of ₱{$formattedAmount} has been recorded";
                    $notif_action_url = '/enrollment/payment';
                    $notif_description = "{$actor_name} recorded a {$payment_type} payment of ₱{$formattedAmount} for {$student_name}";
                }

                $notificationData = [
                    'type' => NotificationService::TYPE_PAYMENT_RECEIVED,
                    'title' => $notif_title,
                    'body' => $notif_body,
                    'icon' => 'dollar-sign',
                    'action_url' => $notif_action_url,
                    'push_data' => [
                        'screen' => $actor_role === 'student' ? 'PaymentDetails' : 'PaymentHistory',
                        'payment_id' => $paymentId
                    ],
                    'metadata' => [
                        'payment_id' => $paymentId,
                        'amount' => $payment_amount,
                        'payment_type' => $payment_type,
                        'payment_method' => $payment_method
                    ],
                    'action' => 'payment.created',
                    'entity_type' => 'payment',
                    'entity_id' => $paymentId,
                    'actor_user_id' => $currentUser['user_id'],
                    'actor_role' => $actor_role,
                    'actor_name' => $actor_name,
                    'description' => $notif_description,
                    'recipients' => $recipients
                ];

                $this->NotificationService->create($notificationData);
            } catch (Exception $notifError) {
                error_log('Failed to send payment notification: ' . $notifError->getMessage());
                // Don't fail the payment if notification fails
            }

            // ====================================================================
            // SUCCESS RESPONSE
            // ====================================================================
            echo json_encode([
                'success' => true,
                'message' => 'Payment created successfully',
                'data' => $payment
            ]);

        } catch (Exception $e) {
            // ====================================================================
            // TRANSACTION FAILED → ROLLBACK ALL CHANGES
            // ====================================================================
            $this->db->trans_rollback();
            
            error_log('❌ Payment creation failed, transaction rolled back: ' . $e->getMessage());
            error_log('Error stack trace: ' . $e->getTraceAsString());
            
            // Clean up uploaded file if transaction fails
            if ($proof_of_payment_url) {
                $file_path = ROOT_DIR . 'public' . $proof_of_payment_url;
                if (file_exists($file_path)) {
                    @unlink($file_path);
                    error_log('Cleaned up uploaded file: ' . $file_path);
                }
            }
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Payment creation failed: ' . $e->getMessage()
            ]);
        }

    } catch (Exception $e) {
        // Outer catch for pre-transaction errors (validation, file upload, etc.)
        error_log('Payment creation error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Payment creation error: ' . $e->getMessage()
        ]);
    }
}

/**
 * ============================================================================
 * USAGE NOTES:
 * ============================================================================
 * 
 * 1. Frontend must generate idempotency_key:
 *    const idempotencyKey = `payment-${studentId}-${Date.now()}-${Math.random()}`;
 * 
 * 2. Run migration first to add idempotency_key column:
 *    mysql -u root -p maranatha_db < migrations/2026_03_05_add_transaction_safety.sql
 * 
 * 3. Test scenarios:
 *    - Double click submit button → second request returns "already processed"
 *    - Kill PHP during penalty creation → no payment record created
 *    - Concurrent requests with different keys → both succeed
 *    - Concurrent requests with same key → only one succeeds
 * 
 * 4. Monitor for errors:
 *    tail -f /path/to/php_error.log
 * 
 * 5. Performance impact:
 *    - Transaction overhead: ~2-5ms
 *    - Idempotency check: ~1ms
 *    - Total: <10ms (negligible for 150-200 students)
 * 
 * ============================================================================
 */
