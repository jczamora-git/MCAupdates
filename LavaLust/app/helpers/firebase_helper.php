<?php
/**
 * Firebase helper
 * - Loads `app/config/service-account.json` safely
 * - Provides accessors for keys and a helper to create Firebase custom tokens
 */

use Firebase\JWT\JWT;

if (!function_exists('firebase_env')) {
    function firebase_env(string $key): ?string
    {
        if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
            return (string)$_ENV[$key];
        }

        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
            return (string)$_SERVER[$key];
        }

        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return (string)$value;
        }

        return null;
    }
}

if (!function_exists('get_firebase_service_account_path')) {
    function get_firebase_service_account_path(): string
    {
        $configuredPath = null;
        if (function_exists('config_item')) {
            $configuredPath = config_item('firebase_service_account_path');
        }

        if (empty($configuredPath)) {
            $configuredPath = firebase_env('FIREBASE_SERVICE_ACCOUNT_PATH');
        }

        if (!empty($configuredPath)) {
            return realpath($configuredPath) ?: $configuredPath;
        }

        // app/helpers/firebase_helper.php -> app/helpers/../../config/service-account.json
        $path = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'service-account.json';
        return realpath($path) ?: $path;
    }
}

if (!function_exists('load_firebase_service_account')) {
    function load_firebase_service_account(): ?array
    {
        $inlineJson = null;
        if (function_exists('config_item')) {
            $inlineJson = config_item('firebase_service_account_json');
        }

        if (empty($inlineJson)) {
            $inlineJson = firebase_env('FIREBASE_SERVICE_ACCOUNT_JSON');
        }

        if (!empty($inlineJson)) {
            $data = json_decode((string)$inlineJson, true);
            if (is_array($data)) {
                return $data;
            }
            error_log('Firebase service account JSON from env/config is invalid');
        }

        $inlineBase64 = null;
        if (function_exists('config_item')) {
            $inlineBase64 = config_item('firebase_service_account_base64');
        }

        if (empty($inlineBase64)) {
            $inlineBase64 = firebase_env('FIREBASE_SERVICE_ACCOUNT_BASE64');
        }

        if (!empty($inlineBase64)) {
            $decoded = base64_decode((string)$inlineBase64, true);
            if ($decoded !== false) {
                $data = json_decode($decoded, true);
                if (is_array($data)) {
                    return $data;
                }
            }
            error_log('Firebase service account base64 from env/config is invalid');
        }

        $path = get_firebase_service_account_path();
        if (!file_exists($path)) {
            error_log('Firebase service account not found at: ' . $path);
            return null;
        }

        $json = file_get_contents($path);
        if ($json === false) {
            error_log('Failed to read Firebase service account file: ' . $path);
            return null;
        }

        $data = json_decode($json, true);
        if ($data === null) {
            error_log('Invalid JSON in Firebase service account file: ' . $path);
            return null;
        }

        return $data;
    }
}

if (!function_exists('get_firebase_client_email')) {
    function get_firebase_client_email(): ?string
    {
        $sa = load_firebase_service_account();
        return $sa['client_email'] ?? null;
    }
}

if (!function_exists('get_firebase_private_key')) {
    function get_firebase_private_key(): ?string
    {
        $sa = load_firebase_service_account();
        return $sa['private_key'] ?? null;
    }
}

if (!function_exists('get_firebase_project_id')) {
    function get_firebase_project_id(): ?string
    {
        $sa = load_firebase_service_account();

        // 1) Primary source: service-account.json
        if (!empty($sa['project_id'])) {
            return (string)$sa['project_id'];
        }

        // 2) App config override
        if (function_exists('config_item')) {
            $cfgProjectId = config_item('firebase_project_id');
            if (!empty($cfgProjectId)) {
                return (string)$cfgProjectId;
            }
        }

        // 3) Environment overrides (common names)
        $envProjectId = firebase_env('FIREBASE_PROJECT_ID') ?: firebase_env('GOOGLE_CLOUD_PROJECT') ?: firebase_env('GCLOUD_PROJECT');
        if (!empty($envProjectId)) {
            return (string)$envProjectId;
        }

        // 4) Derive from service account client_email: xxx@project-id.iam.gserviceaccount.com
        $clientEmail = $sa['client_email'] ?? '';
        if (!empty($clientEmail) && preg_match('/@([^\.]+)\.iam\.gserviceaccount\.com$/', (string)$clientEmail, $matches)) {
            return $matches[1];
        }

        return null;
    }
}

if (!function_exists('create_firebase_custom_token')) {
    /**
     * Create a Firebase custom token for a given UID.
     * Requires `firebase/php-jwt` to be installed.
     *
     * @param string $uid
     * @param array $additionalClaims
     * @param int $expireSeconds
     * @return string|null JWT on success or null on failure
     */
    function create_firebase_custom_token(string $uid, array $additionalClaims = [], int $expireSeconds = 3600): ?string
    {
        $clientEmail = get_firebase_client_email();
        $privateKey = get_firebase_private_key();

        if (!$clientEmail || !$privateKey) {
            error_log('Firebase service account client_email or private_key missing');
            return null;
        }

        $now = time();
        $payload = [
            'iss' => $clientEmail,
            'sub' => $clientEmail,
            'aud' => 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
            'iat' => $now,
            'exp' => $now + $expireSeconds,
            'uid' => $uid,
        ];

        if (!empty($additionalClaims)) {
            // Nest custom claims under 'claims' to align with Firebase custom token format
            $payload['claims'] = $additionalClaims;
        }

        try {
            // firebase/php-jwt v6 uses static JWT::encode
            if (!class_exists('Firebase\\JWT\\JWT')) {
                error_log('firebase/php-jwt is not installed; please composer require firebase/php-jwt');
                return null;
            }

            return JWT::encode($payload, $privateKey, 'RS256');
        } catch (Throwable $e) {
            error_log('Failed to create Firebase custom token: ' . $e->getMessage());
            return null;
        }
    }
}

// Optional: expose a lightweight check function
if (!function_exists('firebase_credentials_valid')) {
    function firebase_credentials_valid(): bool
    {
        $sa = load_firebase_service_account();
        return is_array($sa) && !empty($sa['client_email']) && !empty($sa['private_key']);
    }
}

?>
