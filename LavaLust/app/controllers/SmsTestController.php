<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class SmsTestController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('SmsService');
    }

    public function test_sms()
    {
        api_set_json_headers();

        $recipient = $_GET['phone'] ?? '+639000000000';
        $message = $_GET['message'] ?? 'Test message from Lavalust Enrollment System. Time: ' . date('Y-m-d H:i:s');

        $result = $this->SmsService->send($recipient, $message);

        http_response_code($result['success'] ? 200 : 400);
        echo json_encode($result);
    }
}
