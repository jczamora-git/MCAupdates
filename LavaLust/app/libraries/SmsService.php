<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class SmsService
{
    private $apiKey;
    private $baseUrl;

    public function __construct()
    {
        $this->apiKey = $_ENV['SMS_API_KEY'] ?? getenv('SMS_API_KEY') ?: null;
        $this->baseUrl = $_ENV['SMS_API_BASE_URL'] ?? getenv('SMS_API_BASE_URL') ?: 'https://smsapiph.onrender.com';
    }

    public function send($recipient, $message)
    {
        if (empty($this->apiKey)) {
            return [
                'success' => false,
                'message' => 'SMS_API_KEY is not configured',
                'data' => null
            ];
        }

        $recipient = trim((string)$recipient);
        $message = trim((string)$message);

        if ($recipient === '' || $message === '') {
            return [
                'success' => false,
                'message' => 'Recipient and message are required',
                'data' => null
            ];
        }

        $url = rtrim($this->baseUrl, '/') . '/api/v1/send/sms';

        $payload = json_encode([
            'recipient' => $recipient,
            'message' => $message
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'x-api-key: ' . $this->apiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlError) {
            return [
                'success' => false,
                'message' => 'cURL Error: ' . $curlError,
                'data' => null
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

        return [
            'success' => $success,
            'message' => $messageText,
            'data' => $responseIsJson ? $decoded : ['raw' => $responseBody],
            'status_code' => $statusCode
        ];
    }
}
