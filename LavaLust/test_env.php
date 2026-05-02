<?php
/**
 * Quick test to verify .env loading works
 * Run: php test_env.php
 */

// Load the .env file
require __DIR__ . '/app/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

echo "=== Testing .env file loading ===\n\n";

// Test HF_API_TOKEN
$hf_token = getenv('HF_API_TOKEN') ?: $_ENV['HF_API_TOKEN'] ?? '';
echo "HF_API_TOKEN: " . ($hf_token ? "(set - " . strlen($hf_token) . " chars)" : "(not set)") . "\n";

// Test RFID_ADMIN_PASSKEY
$rfid_key = getenv('RFID_ADMIN_PASSKEY') ?: $_ENV['RFID_ADMIN_PASSKEY'] ?? '';
echo "RFID_ADMIN_PASSKEY: " . ($rfid_key ? $rfid_key : "(not set)") . "\n";

echo "\n=== Test complete ===\n";
echo "If values show '(not set)', edit LavaLust/.env and add your tokens.\n";
?>
