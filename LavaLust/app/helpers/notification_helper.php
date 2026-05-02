<?php
/**
 * Notification Helper
 * - Sends Firebase Cloud Messaging (FCM) push notifications to users
 * - Integrates with firebase_helper for credentials
 */

if (!function_exists('set_fcm_last_error')) {
    function set_fcm_last_error(?string $message): void
    {
        $GLOBALS['__fcm_last_error'] = $message;
    }
}

if (!function_exists('get_fcm_last_error')) {
    function get_fcm_last_error(): ?string
    {
        return $GLOBALS['__fcm_last_error'] ?? null;
    }
}

if (!function_exists('send_fcm_to_token')) {
    /**
     * Send an FCM notification to a specific device token using Google's FCM API.
     * Requires curl and a valid Google API access token.
     *
     * @param string $device_token The FCM device token
     * @param string $title Notification title
     * @param string $body Notification body
     * @param array $data Additional data payload
     * @return bool True if successful, false otherwise
     */
    function send_fcm_to_token(string $device_token, string $title, string $body, array $data = []): bool
    {
        set_fcm_last_error(null);

        if (empty($device_token)) {
            set_fcm_last_error('Device token is empty');
            return false;
        }

        $projectId = get_firebase_project_id();
        if (!$projectId) {
            set_fcm_last_error('Firebase project_id not configured');
            error_log('Firebase project_id not configured');
            return false;
        }

        // Build a data-only payload for web push.
        // The service worker will render a single notification, which avoids
        // duplicate banners caused by auto-displayed notification payloads.
        $message = [
            'token' => $device_token,
            'data' => [
                'title' => (string)$title,
                'body' => (string)$body,
            ],
        ];

        if (!empty($data)) {
            foreach ($data as $key => $value) {
                // FCM data values must be strings
                $message['data'][$key] = (string)$value;
            }
        }

        // Wrap in { "message": {...} } for Google FCM API v1
        $payload = ['message' => $message];

        // Get an access token for Firebase
        $accessToken = get_firebase_access_token();
        if (!$accessToken) {
            if (!function_exists('get_fcm_last_error') || !get_fcm_last_error()) {
                set_fcm_last_error('Failed to obtain Firebase access token');
            }
            error_log('Failed to obtain Firebase access token');
            return false;
        }

        // Send via Firebase Cloud Messaging API
        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        $options = [
            'http' => [
                'method' => 'POST',
                'header' => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $accessToken,
                ],
                'content' => json_encode($payload),
                'ignore_errors' => true,
            ],
        ];

        try {
            $context = stream_context_create($options);
            $response = @file_get_contents($url, false, $context);

            if ($response === false) {
                $lastPhpError = error_get_last();
                $message = 'FCM API request failed';
                if (!empty($lastPhpError['message'])) {
                    $message .= ': ' . $lastPhpError['message'];
                }
                set_fcm_last_error($message);
                error_log('FCM API request failed for token: ' . substr($device_token, 0, 20));
                return false;
            }

            $result = json_decode($response, true);
            $success = isset($result['name']); // Google FCM returns a 'name' field on success

            if (!$success) {
                $errorMessage = 'FCM API error';
                if (isset($result['error']['message'])) {
                    $errorMessage = 'FCM API error: ' . $result['error']['message'];
                } elseif (is_array($result)) {
                    $errorMessage = 'FCM API error: ' . json_encode($result);
                }
                set_fcm_last_error($errorMessage);
                error_log('FCM API error: ' . json_encode($result));
            } else {
                set_fcm_last_error(null);
            }

            return $success;
        } catch (Throwable $e) {
            set_fcm_last_error('Exception sending FCM: ' . $e->getMessage());
            error_log('Exception sending FCM: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('get_firebase_access_token')) {
    /**
     * Obtain a Google access token using the Firebase service account.
     * Tokens are valid for ~1 hour and should be cached in production.
     *
     * @return string|null Access token on success, null on failure
     */
    function get_firebase_access_token(): ?string
    {
        $serviceAccount = load_firebase_service_account();
        if (!$serviceAccount) {
            if (function_exists('set_fcm_last_error')) {
                set_fcm_last_error('Firebase service account could not be loaded (check FIREBASE_SERVICE_ACCOUNT_PATH/JSON/BASE64)');
            }
            error_log('Firebase service account could not be loaded');
            return null;
        }

        if (empty($serviceAccount['private_key']) || empty($serviceAccount['client_email'])) {
            if (function_exists('set_fcm_last_error')) {
                set_fcm_last_error('Firebase service account missing private_key or client_email');
            }
            error_log('Firebase service account missing private_key or client_email');
            return null;
        }

        // Create a JWT signed with the service account private key
        if (!function_exists('create_firebase_custom_token')) {
            return null;
        }

        $now = time();
        $payload = [
            'iss' => $serviceAccount['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'exp' => $now + 3600,
            'iat' => $now,
        ];

        try {
            if (!class_exists('Firebase\\JWT\\JWT')) {
                if (function_exists('set_fcm_last_error')) {
                    set_fcm_last_error('Missing firebase/php-jwt dependency on backend');
                }
                error_log('Missing firebase/php-jwt dependency on backend');
                return null;
            }

            $jwt = \Firebase\JWT\JWT::encode($payload, $serviceAccount['private_key'], 'RS256');

            // Exchange JWT for access token
            $options = [
                'http' => [
                    'method' => 'POST',
                    'header' => 'Content-Type: application/x-www-form-urlencoded',
                    'content' => http_build_query([
                        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                        'assertion' => $jwt,
                    ]),
                    'ignore_errors' => true,
                ],
            ];

            $context = stream_context_create($options);
            $response = @file_get_contents('https://oauth2.googleapis.com/token', false, $context);

            if ($response === false) {
                $lastPhpError = error_get_last();
                $message = 'Failed to obtain Firebase access token';
                if (!empty($lastPhpError['message'])) {
                    $message .= ': ' . $lastPhpError['message'];
                }

                if (function_exists('set_fcm_last_error')) {
                    set_fcm_last_error($message);
                }
                error_log($message);
                return null;
            }

            $data = json_decode($response, true);
            if (!empty($data['access_token'])) {
                return $data['access_token'];
            }

            $message = 'Firebase access token response did not contain access_token';
            if (is_array($data) && isset($data['error'])) {
                $message = 'Firebase OAuth error: ' . (is_array($data['error']) ? json_encode($data['error']) : (string)$data['error']);
                if (!empty($data['error_description'])) {
                    $message .= ' - ' . (string)$data['error_description'];
                }
            }

            if (function_exists('set_fcm_last_error')) {
                set_fcm_last_error($message);
            }
            error_log($message);
            return null;
        } catch (Throwable $e) {
            $message = 'Failed to obtain Firebase access token: ' . $e->getMessage();
            if (function_exists('set_fcm_last_error')) {
                set_fcm_last_error($message);
            }
            error_log($message);
            return null;
        }
    }
}

// Fetch tokens helper for convenience (optional)
if (!function_exists('fetch_user_fcm_tokens')) {
    /**
     * Placeholder - tokens should be fetched from model/controller context
     * This helper is kept for reference but actual fetching should be done via MessageModel::get_user_fcm_tokens()
     *
     * @param int $user_id
     * @return array Empty array - use controller/model method instead
     */
    function fetch_user_fcm_tokens(int $user_id): array
    {
        return [];
    }
}

?>
