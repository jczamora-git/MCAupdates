<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Helper: token_helper.php
 *
 * Handles generation and verification of encrypted tokens for email verification.
 * Uses AES-256-CBC encryption with HMAC for integrity verification.
 * No database storage required - all data is encoded in the token itself.
 */

// Secret key for encryption - should be stored securely in config
// In production, this should be in a config file or environment variable
if (!defined('TOKEN_SECRET_KEY')) {
    define('TOKEN_SECRET_KEY', 'EduTrack2025SecretKeyForEmailVerification!@#$');
}
if (!defined('TOKEN_EXPIRATION_HOURS')) {
    define('TOKEN_EXPIRATION_HOURS', 24);
}

/**
 * Generate an encrypted verification token
 *
 * @param int $userId User's database ID
 * @param string $email User's email address
 * @param int $expirationHours Hours until token expires (default 24)
 * @return string URL-safe base64 encoded encrypted token
 */
function generate_verification_token($userId, $email, $expirationHours = TOKEN_EXPIRATION_HOURS)
{
    // Create payload with user data and expiration
    $payload = [
        'user_id' => $userId,
        'email' => $email,
        'expires_at' => time() + ($expirationHours * 3600),
        'created_at' => time(),
        'nonce' => bin2hex(random_bytes(8)) // Prevent token reuse
    ];
    
    // Convert to JSON
    $jsonPayload = json_encode($payload);
    
    // Generate encryption key and IV
    $key = hash('sha256', TOKEN_SECRET_KEY, true);
    $iv = random_bytes(16);
    
    // Encrypt the payload
    $encrypted = openssl_encrypt($jsonPayload, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    
    // Create HMAC for integrity verification
    $hmac = hash_hmac('sha256', $iv . $encrypted, $key, true);
    
    // Combine: HMAC + IV + encrypted data
    $combined = $hmac . $iv . $encrypted;
    
    // Base64 encode and make URL-safe
    $token = base64_encode($combined);
    $token = strtr($token, '+/', '-_');
    $token = rtrim($token, '=');
    
    return $token;
}

/**
 * Verify and decode an encrypted verification token
 *
 * @param string $token URL-safe base64 encoded encrypted token
 * @return array|false Returns decoded payload array on success, false on failure
 */
function verify_token($token)
{
    try {
        // Restore base64 padding and characters
        $token = strtr($token, '-_', '+/');
        $padding = strlen($token) % 4;
        if ($padding) {
            $token .= str_repeat('=', 4 - $padding);
        }
        
        // Decode base64
        $combined = base64_decode($token, true);
        if ($combined === false || strlen($combined) < 48) {
            error_log('Token verification failed: Invalid base64 or too short');
            return false;
        }
        
        // Extract HMAC (32 bytes), IV (16 bytes), and encrypted data
        $hmac = substr($combined, 0, 32);
        $iv = substr($combined, 32, 16);
        $encrypted = substr($combined, 48);
        
        // Generate key
        $key = hash('sha256', TOKEN_SECRET_KEY, true);
        
        // Verify HMAC
        $expectedHmac = hash_hmac('sha256', $iv . $encrypted, $key, true);
        if (!hash_equals($hmac, $expectedHmac)) {
            error_log('Token verification failed: HMAC mismatch');
            return false;
        }
        
        // Decrypt
        $jsonPayload = openssl_decrypt($encrypted, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        if ($jsonPayload === false) {
            error_log('Token verification failed: Decryption failed');
            return false;
        }
        
        // Decode JSON
        $payload = json_decode($jsonPayload, true);
        if ($payload === null) {
            error_log('Token verification failed: Invalid JSON');
            return false;
        }
        
        // Check expiration
        if (!isset($payload['expires_at']) || $payload['expires_at'] < time()) {
            error_log('Token verification failed: Token expired');
            return false;
        }
        
        // Validate required fields
        if (!isset($payload['user_id']) || !isset($payload['email'])) {
            error_log('Token verification failed: Missing required fields');
            return false;
        }
        
        return $payload;
        
    } catch (Exception $e) {
        error_log('Token verification exception: ' . $e->getMessage());
        return false;
    }
}

/**
 * Generate full verification URL
 *
 * @param int $userId User's database ID
 * @param string $email User's email address
 * @param string $baseUrl Base URL of the frontend app
 * @return string Full verification URL
 */
function generate_verification_url($userId, $email, $baseUrl = '')
{
    if (empty($baseUrl)) {
        $configuredPortalUrl = function_exists('config_item') ? trim((string) config_item('portal_url')) : '';

        if ($configuredPortalUrl !== '') {
            $baseUrl = rtrim($configuredPortalUrl, '/');
        } else {
            $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
            $isLocalHost = ($host === 'localhost') || ($host === '127.0.0.1')
                || (strpos($host, 'localhost:') === 0) || (strpos($host, '127.0.0.1:') === 0);
            $isDevHost = (strpos($host, 'dev.mcaportal.online') !== false);

            if ($isLocalHost) {
                $baseUrl = 'http://localhost:5174';
            } elseif ($isDevHost) {
                $baseUrl = 'https://dev.mcaportal.online/ui';
            } else {
                $baseUrl = 'https://mcaportal.online';
            }
        }
    }
    
    $token = generate_verification_token($userId, $email);
    
    return $baseUrl . '/verify-email?token=' . urlencode($token);
}
