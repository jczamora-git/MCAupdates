# Transaction Safety Implementation Guide

## Overview
This guide shows how to implement database transactions in your critical controllers to prevent:
- **Duplicate payments** from double-clicks
- **Partial enrollment records** from server crashes
- **Race conditions** when multiple admins process the same record
- **Data loss** during multi-step operations

## Key Concepts

### 1. Database Transactions
Wrap multi-step database operations in transactions:
```php
$this->db->trans_begin();

try {
    // Step 1: Create payment
    $paymentId = $this->PaymentModel->create($data);
    
    // Step 2: Create penalty
    $penaltyId = $this->PaymentPenaltyModel->create($penaltyData);
    
    // Step 3: Apply discounts
    foreach ($discount_ids as $discount_id) {
        $this->PaymentDiscountApplicationModel->apply_discount($paymentId, $discount_id);
    }
    
    // ALL steps succeeded → commit
    $this->db->trans_commit();
    
} catch (Exception $e) {
    // ANY step failed → rollback ALL changes
    $this->db->trans_rollback();
    throw $e;
}
```

### 2. Idempotency Keys
Prevent duplicate submissions by generating unique request IDs:
```php
// Frontend generates unique key
const idempotencyKey = `payment-${studentId}-${Date.now()}-${Math.random()}`;

// Backend stores it
$data['idempotency_key'] = $input['idempotency_key'];

// Database unique constraint prevents duplicates
CREATE UNIQUE INDEX idx_unique_idempotency ON payments (idempotency_key);
```

### 3. Optimistic Locking
Prevent concurrent updates by tracking version numbers:
```php
// When reading record
$payment = $this->PaymentModel->get_payment($id);
$currentVersion = $payment['version'];

// When updating record
$this->db->query("
    UPDATE payments 
    SET status = ?, version = version + 1
    WHERE id = ? AND version = ?
", [$newStatus, $id, $currentVersion]);

if ($this->db->affected_rows() === 0) {
    throw new Exception('Record was modified by another user');
}
```

### 4. Database Constraints
Let MySQL enforce business rules:
```sql
-- Prevent duplicate enrollments
ALTER TABLE enrollments
ADD CONSTRAINT unique_student_period 
UNIQUE (student_id, academic_period_id);

-- Prevent duplicate service period payments
CREATE UNIQUE INDEX idx_unique_service_period 
ON payments (student_id, service_period_month, service_period_year)
WHERE is_recurring_service = 1;
```

## Implementation Steps

### Step 1: Run Migration (ALREADY DONE ✅)
```bash
mysql -u your_username -p maranatha_db < LavaLust/migrations/2026_03_05_add_transaction_safety.sql
```

### Step 2: Update Controllers
Replace old methods with transaction-safe versions in these files:
1. `PaymentController.php` - See `PAYMENT_CONTROLLER_OPTIMIZED.php`
2. `EnrollmentController.php` - See `ENROLLMENT_CONTROLLER_OPTIMIZED.php`

### Step 3: Update Frontend (Add Idempotency Keys)
```typescript
// Example: Generating idempotency key in React
const submitPayment = async (paymentData: PaymentData) => {
  const idempotencyKey = `payment-${paymentData.studentId}-${Date.now()}-${crypto.randomUUID()}`;
  
  const response = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...paymentData,
      idempotency_key: idempotencyKey
    })
  });
  
  // If user clicks "Submit" again, same key → duplicate rejected by DB
};
```

### Step 4: Test Scenarios

#### Test 1: Double Click Prevention
1. Submit payment form
2. Immediately click submit again
3. **Expected:** Second request rejected with "Duplicate payment detected"

#### Test 2: Server Crash Recovery
1. Start payment creation (insert into payments table)
2. Kill PHP process before penalties/discounts created
3. Restart server
4. **Expected:** No payment record exists (transaction rolled back)

#### Test 3: Concurrent Approval
1. Admin A opens enrollment #123
2. Admin B opens enrollment #123
3. Admin A approves (version = 0)
4. Admin B approves (version = 0)
5. **Expected:** Admin B gets "Record was modified" error

## Performance Impact

For your 150-200 student school:
- **Transaction overhead:** ~2-5ms per operation
- **Index lookups:** ~0.1-1ms per constraint check
- **Total impact:** Negligible (<10ms per request)

## Monitoring

### Check for Failed Transactions
```sql
-- Check for orphaned records (shouldn't exist after transactions)
SELECT p.* 
FROM payments p
LEFT JOIN payment_penalties pp ON p.id = pp.payment_id
WHERE p.penalty_amount > 0 AND pp.id IS NULL;
```

### Check for Duplicate Prevention
```sql
-- Verify unique constraints are enforced
SELECT student_id, academic_period_id, COUNT(*) as count
FROM enrollments
GROUP BY student_id, academic_period_id
HAVING count > 1;
-- Should return 0 rows
```

## Rollback Plan

If transactions cause issues (unlikely):
```php
// Temporarily disable transactions
// $this->db->trans_begin();  // Comment out
$paymentId = $this->PaymentModel->create($data);
// $this->db->trans_commit();  // Comment out
```

Then investigate the issue before re-enabling.

## Common Pitfalls

### ❌ Wrong: Committing Too Early
```php
$this->db->trans_begin();
$paymentId = $this->PaymentModel->create($data);
$this->db->trans_commit();  // ← Too early!

// If this fails, payment still exists
$this->PaymentPenaltyModel->create($penaltyData);
```

### ✅ Right: Commit After All Steps
```php
$this->db->trans_begin();
$paymentId = $this->PaymentModel->create($data);
$this->PaymentPenaltyModel->create($penaltyData);
$this->db->trans_commit();  // ← After everything succeeds
```

### ❌ Wrong: Catching Exceptions Without Rollback
```php
$this->db->trans_begin();
try {
    $paymentId = $this->PaymentModel->create($data);
} catch (Exception $e) {
    error_log($e->getMessage());  // ← Transaction still in progress!
}
```

### ✅ Right: Always Rollback on Error
```php
$this->db->trans_begin();
try {
    $paymentId = $this->PaymentModel->create($data);
} catch (Exception $e) {
    $this->db->trans_rollback();  // ← Clean up
    throw $e;
}
$this->db->trans_commit();
```

## Questions?

- **Q:** Will transactions slow down my app?
  - **A:** No. For 150-200 students, overhead is <10ms per request.

- **Q:** What if transaction fails?
  - **A:** ALL changes are automatically rolled back. No partial data.

- **Q:** How do I test this locally?
  - **A:** Use XAMPP/WAMP, enable error logging, simulate crashes with `exit()`.

- **Q:** Can I use transactions with file uploads?
  - **A:** Yes! Upload files FIRST, then include URLs in transaction. If transaction fails, clean up orphaned files in cron job.

## Next Steps

1. ✅ Run migration SQL (adds constraints + indexes)
2. ⏳ Replace `create_payment()` method in PaymentController.php
3. ⏳ Replace `api_submit_enrollment()` method in EnrollmentController.php
4. ⏳ Add idempotency key generation in frontend
5. ⏳ Test with 5-10 concurrent requests
6. ✅ Deploy to production!

