<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class SmsService
{
    private $apiKey;
    private $baseUrl;
    private $senderName;
    private $smsEnabled;

    public function __construct()
    {
        $this->smsEnabled = $this->readBoolEnv('SMS_ENABLE', false);
        $this->apiKey = $_ENV['SEMAPHORE_API_KEY'] ?? getenv('SEMAPHORE_API_KEY') ?: null;
        $this->senderName = $_ENV['SEMAPHORE_SENDER_NAME'] ?? getenv('SEMAPHORE_SENDER_NAME') ?: 'MCA';
        $this->baseUrl = $_ENV['SEMAPHORE_BASE_URL'] ?? getenv('SEMAPHORE_BASE_URL') ?: 'https://api.semaphore.co/api/v4';
    }

    public function send($recipient, $message)
    {
        if (!$this->smsEnabled) {
            return [
                'success' => false,
                'message' => 'SMS is disabled (SMS_ENABLE=false)',
                'data' => null,
                'status_code' => 0
            ];
        }

        if (empty($this->apiKey)) {
            return [
                'success' => false,
                'message' => 'SEMAPHORE_API_KEY is not configured',
                'data' => null,
                'status_code' => 0
            ];
        }

        $recipient = trim((string)$recipient);
        $message = trim((string)$message);

        if ($recipient === '' || $message === '') {
            return [
                'success' => false,
                'message' => 'Recipient and message are required',
                'data' => null,
                'status_code' => 0
            ];
        }

        $normalizedRecipient = $this->normalizePhilippineNumber($recipient);
        if ($normalizedRecipient === null) {
            return [
                'success' => false,
                'message' => 'Invalid recipient mobile number format. Use 09xxxxxxxxx or +639xxxxxxxxx.',
                'data' => null,
                'status_code' => 0
            ];
        }

        $url = rtrim($this->baseUrl, '/') . '/messages';

        $payload = http_build_query([
            'apikey' => $this->apiKey,
            'number' => $normalizedRecipient,
            'message' => $message,
            'sendername' => $this->senderName,
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlError) {
            $this->logSms($normalizedRecipient, $message, false, $curlError);
            return [
                'success' => false,
                'message' => 'cURL Error: ' . $curlError,
                'data' => null,
                'status_code' => $statusCode
            ];
        }

        $decoded = json_decode($responseBody, true);
        $responseIsJson = json_last_error() === JSON_ERROR_NONE;

        $success = ($statusCode >= 200 && $statusCode < 300);
        if ($responseIsJson && isset($decoded['success'])) {
            $success = (bool)$decoded['success'];
        }

        $messageText = 'SMS request completed';
        if ($responseIsJson && isset($decoded['message'])) {
            $messageText = (string)$decoded['message'];
        } elseif (!$success) {
            $messageText = 'SMS request failed';
        }

        $result = [
            'success' => $success,
            'message' => $messageText,
            'data' => $responseIsJson ? $decoded : ['raw' => $responseBody],
            'status_code' => $statusCode
        ];

        $this->logSms($normalizedRecipient, $message, $success, $responseIsJson ? $decoded : $responseBody);

        return $result;
    }

    private function readBoolEnv($key, $default = false)
    {
        $value = $_ENV[$key] ?? getenv($key);
        if ($value === false || $value === null || $value === '') {
            return $default;
        }

        $value = mb_strtolower(trim((string)$value));
        return in_array($value, ['1', 'true', 'yes', 'on'], true);
    }

    private function normalizePhilippineNumber($recipient)
    {
        $digits = preg_replace('/\D+/', '', (string)$recipient);
        if (preg_match('/^09\d{9}$/', $digits)) {
            return '639' . substr($digits, 2);
        }
        if (preg_match('/^639\d{9}$/', $digits)) {
            return $digits;
        }

        return null;
    }

    private function logSms($recipient, $message, $success, $response = '')
    {
        $status = $success ? 'SUCCESS' : 'FAIL';
        $payload = is_string($response) ? $response : json_encode($response);
        $line = sprintf(
            "[%s] %s | TO: %s | MSG: %s | RESPONSE: %s\n",
            date('Y-m-d H:i:s'),
            $status,
            $recipient,
            str_replace(["\n", "\r"], ' ', $message),
            $payload
        );

        $logDir = defined('APP_DIR')
            ? rtrim(APP_DIR, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'logs'
            : __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'logs';

        if (!is_dir($logDir)) {
            @mkdir($logDir, 0755, true);
        }

        if (!is_dir($logDir) || !is_writable($logDir)) {
            error_log($line);
            return;
        }

        $logPath = $logDir . DIRECTORY_SEPARATOR . 'sms_sends.log';
        @file_put_contents($logPath, $line, FILE_APPEND);
    }
}
