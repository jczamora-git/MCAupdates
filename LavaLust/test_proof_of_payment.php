<?php
/**
 * Test script for Proof of Payment File Upload functionality
 * This script tests the proof_of_payment_helper functions
 */

// Define constants for testing
define('ROOT_DIR', dirname(dirname(__FILE__)) . '/');
define('APP_DIR', ROOT_DIR . 'app/');

// Include the helper
require_once APP_DIR . 'helpers/proof_of_payment_helper.php';

echo "=== Proof of Payment File Upload Test ===\n\n";

// Test 1: Validate file (no file provided)
echo "Test 1: Validate file (no file) - ";
$result = validate_proof_of_payment_file();
echo $result['valid'] ? "PASS" : "FAIL";
echo " - " . $result['message'] . "\n";

// Test 2: Test file size formatting
echo "\nTest 2: File size formatting - ";
$sizes = [1024, 1536000, 5242880]; // 1KB, ~1.5MB, 5MB
foreach ($sizes as $size) {
    echo format_file_size($size) . ", ";
}
echo "\n";

// Test 3: Check upload directory creation
echo "\nTest 3: Upload directory structure - ";
$test_dir = ROOT_DIR . 'public/uploads/payments/2026/02/';
if (!is_dir($test_dir)) {
    mkdir($test_dir, 0755, true);
    echo "Created test directory: " . $test_dir . "\n";
} else {
    echo "Test directory already exists: " . $test_dir . "\n";
}

// Test 4: Check if helper functions are available
echo "\nTest 4: Helper functions availability - ";
$functions = ['upload_proof_of_payment', 'delete_proof_of_payment', 'get_proof_of_payment_info', 'validate_proof_of_payment_file', 'format_file_size'];
$all_available = true;
foreach ($functions as $func) {
    if (!function_exists($func)) {
        echo "FAIL - Function $func not found\n";
        $all_available = false;
    }
}
if ($all_available) {
    echo "PASS - All helper functions are available\n";
}

echo "\n=== Test Complete ===\n";
echo "Note: For actual file upload testing, use the API endpoints:\n";
echo "- POST /api/payments/{id}/upload-proof (multipart/form-data)\n";
echo "- DELETE /api/payments/{id}/delete-proof\n";
echo "- GET /api/payments/{id}/proof-info\n";
echo "\nOr use the create_payment endpoint with file upload:\n";
echo "- POST /api/payments (multipart/form-data with proof_of_payment file)\n";
?>