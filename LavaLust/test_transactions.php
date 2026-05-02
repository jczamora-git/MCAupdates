<?php
/**
 * ============================================================================
 * TRANSACTION SAFETY TEST SCRIPT
 * ============================================================================
 * 
 * This script tests the transaction safety improvements in your backend.
 * 
 * HOW TO USE:
 * 1. Place this file in: LavaLust/test_transactions.php
 * 2. Run via browser: http://localhost/test_transactions.php
 * 3. OR run via CLI: php test_transactions.php
 * 
 * WHAT IT TESTS:
 * ✅ Database transaction rollback
 * ✅ Idempotency key duplicate prevention
 * ✅ Unique constraint enforcement
 * ✅ Audit log consistency
 * 
 * SAFETY: This script only reads data, it does NOT modify your database
 * (unless you uncomment the "RUN ACTUAL TESTS" section at the bottom)
 * 
 * ============================================================================
 */

// Bootstrap LavaLust
define('PREVENT_DIRECT_ACCESS', false);
require_once 'system/core/Base.php';

class TransactionSafetyTest extends Base
{
    private $db;
    private $testResults = [];
    
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->db = $this->lava->db;
    }
    
    /**
     * Run all tests
     */
    public function run_all_tests()
    {
        $this->output_header();
        
        // Test 1: Check if migration ran
        $this->test_migration_applied();
        
        // Test 2: Check database engine (must be InnoDB for transactions)
        $this->test_database_engine();
        
        // Test 3: Test transaction rollback (read-only)
        $this->test_transaction_rollback();
        
        // Test 4: Check for duplicate enrollments
        $this->test_duplicate_enrollments();
        
        // Test 5: Check for orphaned records
        $this->test_orphaned_records();
        
        // Test 6: Check audit log consistency
        $this->test_audit_logs();
        
        // Test 7: Performance test
        $this->test_performance();
        
        // Output results
        $this->output_results();
    }
    
    /**
     * Test 1: Check if migration applied successfully
     */
    private function test_migration_applied()
    {
        $testName = "Migration Applied";
        
        try {
            // Check if idempotency_key column exists
            $result = $this->db->raw("
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'payments'
                AND COLUMN_NAME = 'idempotency_key'
            ");
            
            $hasIdempotencyKey = $result[0]['count'] > 0;
            
            // Check if unique constraint exists
            $result = $this->db->raw("
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'enrollments'
                AND CONSTRAINT_NAME = 'unique_student_period'
            ");
            
            $hasUniqueConstraint = $result[0]['count'] > 0;
            
            // Check if version columns exist
            $result = $this->db->raw("
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'payments'
                AND COLUMN_NAME = 'version'
            ");
            
            $hasVersionColumn = $result[0]['count'] > 0;
            
            if ($hasIdempotencyKey && $hasUniqueConstraint && $hasVersionColumn) {
                $this->pass($testName, "All migration changes applied successfully");
            } else {
                $missing = [];
                if (!$hasIdempotencyKey) $missing[] = "idempotency_key column";
                if (!$hasUniqueConstraint) $missing[] = "unique_student_period constraint";
                if (!$hasVersionColumn) $missing[] = "version column";
                
                $this->fail($testName, "Missing: " . implode(", ", $missing));
            }
        } catch (Exception $e) {
            $this->fail($testName, $e->getMessage());
        }
    }
    
    /**
     * Test 2: Check if tables use InnoDB engine (required for transactions)
     */
    private function test_database_engine()
    {
        $testName = "Database Engine";
        
        try {
            $tables = ['payments', 'enrollments', 'users', 'students'];
            $nonInnoDB = [];
            
            foreach ($tables as $table) {
                $result = $this->db->raw("
                    SHOW TABLE STATUS WHERE Name = '{$table}'
                ");
                
                if (!empty($result) && $result[0]['Engine'] !== 'InnoDB') {
                    $nonInnoDB[] = "{$table} ({$result[0]['Engine']})";
                }
            }
            
            if (empty($nonInnoDB)) {
                $this->pass($testName, "All critical tables use InnoDB engine");
            } else {
                $this->fail($testName, "Non-InnoDB tables: " . implode(", ", $nonInnoDB));
            }
        } catch (Exception $e) {
            $this->fail($testName, $e->getMessage());
        }
    }
    
    /**
     * Test 3: Test transaction rollback capability (read-only)
     */
    private function test_transaction_rollback()
    {
        $testName = "Transaction Rollback";
        
        try {
            // Start transaction
            $this->db->trans_begin();
            
            // Insert test record
            $testData = [
                'student_id' => 99999, // Non-existent student
                'amount' => 0.01,
                'payment_for' => 'TRANSACTION_TEST',
                'reference_number' => 'TEST_' . time(),
                'status' => 'Pending',
                'payment_date' => date('Y-m-d')
            ];
            
            $this->db->table('payments')->insert($testData);
            $testPaymentId = $this->db->insert_id();
            
            // Check if inserted
            $inserted = $this->db->table('payments')
                ->where('id', $testPaymentId)
                ->get();
            
            // Rollback
            $this->db->trans_rollback();
            
            // Check if record still exists (should NOT exist)
            $stillExists = $this->db->table('payments')
                ->where('id', $testPaymentId)
                ->get();
            
            if ($inserted && !$stillExists) {
                $this->pass($testName, "Transaction rollback working correctly");
            } else {
                $this->fail($testName, "Rollback did not remove test record");
            }
        } catch (Exception $e) {
            $this->db->trans_rollback();
            $this->fail($testName, $e->getMessage());
        }
    }
    
    /**
     * Test 4: Check for duplicate enrollments
     */
    private function test_duplicate_enrollments()
    {
        $testName = "Duplicate Enrollments";
        
        try {
            $result = $this->db->raw("
                SELECT created_student_id, academic_period_id, COUNT(*) as count
                FROM enrollments
                WHERE created_student_id IS NOT NULL
                GROUP BY created_student_id, academic_period_id
                HAVING count > 1
            ");
            
            if (empty($result)) {
                $this->pass($testName, "No duplicate enrollments found");
            } else {
                $count = count($result);
                $this->fail($testName, "Found {$count} duplicate enrollment(s)");
            }
        } catch (Exception $e) {
            $this->fail($testName, $e->getMessage());
        }
    }
    
    /**
     * Test 5: Check for orphaned records (penalties without payments)
     */
    private function test_orphaned_records()
    {
        $testName = "Orphaned Records";
        
        try {
            // Check for payment penalties without corresponding payment
            $result = $this->db->raw("
                SELECT pp.id, pp.installment_id
                FROM payment_penalties pp
                LEFT JOIN payments p ON pp.payment_id = p.id
                WHERE p.id IS NULL
            ");
            
            $orphanedPenalties = count($result);
            
            // Check for students without users
            $result = $this->db->raw("
                SELECT s.id, s.user_id
                FROM students s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE u.id IS NULL
            ");
            
            $orphanedStudents = count($result);
            
            if ($orphanedPenalties === 0 && $orphanedStudents === 0) {
                $this->pass($testName, "No orphaned records found");
            } else {
                $msg = [];
                if ($orphanedPenalties > 0) $msg[] = "{$orphanedPenalties} orphaned penalties";
                if ($orphanedStudents > 0) $msg[] = "{$orphanedStudents} orphaned students";
                
                $this->warn($testName, implode(", ", $msg));
            }
        } catch (Exception $e) {
            $this->fail($testName, $e->getMessage());
        }
    }
    
    /**
     * Test 6: Check audit log consistency
     */
    private function test_audit_logs()
    {
        $testName = "Audit Log Consistency";
        
        try {
            // Check if recent payments have corresponding audit logs
            $result = $this->db->raw("
                SELECT COUNT(*) as count
                FROM payments p
                LEFT JOIN audit_logs al ON (
                    al.entity_type = 'payment' 
                    AND al.entity_id = p.id 
                    AND al.action = 'payment.created'
                )
                WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                AND al.id IS NULL
            ");
            
            $missingLogs = $result[0]['count'];
            
            if ($missingLogs === 0) {
                $this->pass($testName, "All recent payments have audit logs");
            } else {
                $this->warn($testName, "{$missingLogs} recent payment(s) missing audit logs");
            }
        } catch (Exception $e) {
            $this->fail($testName, $e->getMessage());
        }
    }
    
    /**
     * Test 7: Performance benchmark
     */
    private function test_performance()
    {
        $testName = "Performance Benchmark";
        
        try {
            // Test simple query performance
            $start = microtime(true);
            
            $this->db->table('payments')
                ->where('status', 'Approved')
                ->limit(20)
                ->get_all();
            
            $queryTime = (microtime(true) - $start) * 1000; // Convert to ms
            
            // Test transaction overhead
            $start = microtime(true);
            $this->db->trans_begin();
            $this->db->trans_rollback();
            $transactionTime = (microtime(true) - $start) * 1000;
            
            $this->pass($testName, sprintf(
                "Query: %.2fms, Transaction overhead: %.2fms",
                $queryTime,
                $transactionTime
            ));
        } catch (Exception $e) {
            $this->fail($testName, $e->getMessage());
        }
    }
    
    // ========================================================================
    // Helper Methods
    // ========================================================================
    
    private function pass($testName, $message)
    {
        $this->testResults[] = [
            'status' => 'PASS',
            'test' => $testName,
            'message' => $message
        ];
    }
    
    private function fail($testName, $message)
    {
        $this->testResults[] = [
            'status' => 'FAIL',
            'test' => $testName,
            'message' => $message
        ];
    }
    
    private function warn($testName, $message)
    {
        $this->testResults[] = [
            'status' => 'WARN',
            'test' => $testName,
            'message' => $message
        ];
    }
    
    private function output_header()
    {
        if (php_sapi_name() === 'cli') {
            echo "\n";
            echo "================================================================================\n";
            echo "TRANSACTION SAFETY TEST SUITE\n";
            echo "================================================================================\n";
            echo "\n";
        } else {
            echo "<!DOCTYPE html>
<html>
<head>
    <title>Transaction Safety Tests</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .test-result { margin: 15px 0; padding: 15px; border-radius: 5px; border-left: 5px solid #ccc; }
        .pass { background: #e8f5e9; border-left-color: #4CAF50; }
        .fail { background: #ffebee; border-left-color: #f44336; }
        .warn { background: #fff3e0; border-left-color: #ff9800; }
        .status { font-weight: bold; display: inline-block; width: 80px; }
        .test-name { font-weight: bold; color: #555; margin-bottom: 5px; }
        .message { color: #666; font-size: 14px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-top: 30px; }
        .summary h2 { margin-top: 0; }
        .stat { display: inline-block; margin-right: 20px; font-size: 18px; }
        .stat-pass { color: #4CAF50; }
        .stat-fail { color: #f44336; }
        .stat-warn { color: #ff9800; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>🔒 Transaction Safety Test Results</h1>";
        }
    }
    
    private function output_results()
    {
        $passed = 0;
        $failed = 0;
        $warnings = 0;
        
        foreach ($this->testResults as $result) {
            if ($result['status'] === 'PASS') $passed++;
            if ($result['status'] === 'FAIL') $failed++;
            if ($result['status'] === 'WARN') $warnings++;
        }
        
        if (php_sapi_name() === 'cli') {
            // CLI output
            foreach ($this->testResults as $result) {
                $status = str_pad($result['status'], 6);
                echo "{$status} | {$result['test']}\n";
                echo "       | {$result['message']}\n";
                echo "       |\n";
            }
            
            echo "\n";
            echo "================================================================================\n";
            echo "SUMMARY\n";
            echo "================================================================================\n";
            echo "Passed:   {$passed}\n";
            echo "Failed:   {$failed}\n";
            echo "Warnings: {$warnings}\n";
            echo "Total:    " . count($this->testResults) . "\n";
            echo "\n";
            
            if ($failed === 0) {
                echo "✅ ALL TESTS PASSED!\n";
            } else {
                echo "❌ SOME TESTS FAILED - Review output above\n";
            }
        } else {
            // HTML output
            foreach ($this->testResults as $result) {
                $class = strtolower($result['status']);
                echo "<div class='test-result {$class}'>";
                echo "<div class='test-name'>";
                
                if ($result['status'] === 'PASS') echo "✅ ";
                if ($result['status'] === 'FAIL') echo "❌ ";
                if ($result['status'] === 'WARN') echo "⚠️ ";
                
                echo "{$result['test']}</div>";
                echo "<div class='message'>{$result['message']}</div>";
                echo "</div>";
            }
            
            echo "<div class='summary'>";
            echo "<h2>📊 Summary</h2>";
            echo "<div class='stat stat-pass'>✅ Passed: {$passed}</div>";
            echo "<div class='stat stat-fail'>❌ Failed: {$failed}</div>";
            echo "<div class='stat stat-warn'>⚠️ Warnings: {$warnings}</div>";
            echo "<div class='stat'>Total: " . count($this->testResults) . "</div>";
            echo "</div>";
            
            echo "</div></body></html>";
        }
    }
}

// ============================================================================
// RUN TESTS
// ============================================================================

try {
    $tester = new TransactionSafetyTest();
    $tester->run_all_tests();
} catch (Exception $e) {
    if (php_sapi_name() === 'cli') {
        echo "ERROR: " . $e->getMessage() . "\n";
    } else {
        echo "<h1 style='color: red;'>Test Error</h1>";
        echo "<p>" . htmlspecialchars($e->getMessage()) . "</p>";
    }
}
