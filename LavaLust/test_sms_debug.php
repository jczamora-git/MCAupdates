<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

$envLoaded = false;

$possibleAutoloads = [
    __DIR__ . '/vendor/autoload.php',
    __DIR__ . '/app/vendor/autoload.php',
];

foreach ($possibleAutoloads as $autoloadPath) {
    if (file_exists($autoloadPath)) {
        require_once $autoloadPath;

        if (class_exists('Dotenv\\Dotenv')) {
            $envPaths = [
                __DIR__,
                dirname($autoloadPath),
            ];

            foreach ($envPaths as $envPath) {
                if (file_exists($envPath . '/.env')) {
                    $dotenv = Dotenv\Dotenv::createImmutable($envPath);
                    $dotenv->safeLoad();
                    $envLoaded = true;
                    break;
                }
            }
        }

        break;
    }
}

function env_value($key, $default = '')
{
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return $_ENV[$key];
    }

    $value = getenv($key);

    if ($value === false || $value === null || $value === '') {
        return $default;
    }

    return $value;
}

function h($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function mask_key($value)
{
    $value = (string) $value;
    $length = strlen($value);

    if ($length === 0) {
        return 'Missing';
    }

    if ($length <= 8) {
        return str_repeat('*', $length);
    }

    return substr($value, 0, 4) . str_repeat('*', $length - 8) . substr($value, -4);
}

function normalize_ph_mobile($value)
{
    $digits = preg_replace('/\D+/', '', (string) $value);

    if (preg_match('/^09\d{9}$/', $digits)) {
        return '639' . substr($digits, 2);
    }

    if (preg_match('/^639\d{9}$/', $digits)) {
        return $digits;
    }

    return null;
}

function decode_json_or_raw($raw)
{
    $decoded = json_decode((string) $raw, true);

    if (json_last_error() === JSON_ERROR_NONE) {
        return json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }

    return (string) $raw;
}

$smsEnabled = env_value('SMS_ENABLE', '');
$smsProvider = env_value('SMS_PROVIDER', '');
$semaphoreKey = env_value('SEMAPHORE_API_KEY', '');
$semaphoreSender = env_value('SEMAPHORE_SENDER_NAME', 'MCA');
$semaphoreBaseUrl = env_value('SEMAPHORE_BASE_URL', 'https://api.semaphore.co/api/v4');
$smsDebugPassword = env_value('SMS_DEBUG_PASSWORD', '');

$sendEndpoint = rtrim($semaphoreBaseUrl, '/') . '/messages';
$accountEndpoint = rtrim($semaphoreBaseUrl, '/') . '/account';

$recipient = '';
$message = '';
$authOk = true;
$authError = '';

$sendResult = null;
$accountResult = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $recipient = trim((string) ($_POST['recipient'] ?? ''));
    $message = trim((string) ($_POST['message'] ?? ''));
    $providedPassword = trim((string) ($_POST['debug_password'] ?? ''));

    if ($smsDebugPassword !== '' && !hash_equals($smsDebugPassword, $providedPassword)) {
        $authOk = false;
        $authError = 'Invalid or missing debug password.';
    }

    if ($authOk) {
        if (strtolower(trim((string) $smsEnabled)) !== 'true') {
            $sendResult = [
                'success' => false,
                'status_code' => null,
                'error' => 'SMS_ENABLE is not set to true.',
                'response' => '',
            ];
        } elseif ($semaphoreKey === '') {
            $sendResult = [
                'success' => false,
                'status_code' => null,
                'error' => 'SEMAPHORE_API_KEY is missing.',
                'response' => '',
            ];
        } elseif (!function_exists('curl_init')) {
            $sendResult = [
                'success' => false,
                'status_code' => null,
                'error' => 'PHP cURL extension is not available.',
                'response' => '',
            ];
        } elseif ($recipient === '' || $message === '') {
            $sendResult = [
                'success' => false,
                'status_code' => null,
                'error' => 'Recipient and message are required.',
                'response' => '',
            ];
        } else {
            $normalizedRecipient = normalize_ph_mobile($recipient);

            if ($normalizedRecipient === null) {
                $sendResult = [
                    'success' => false,
                    'status_code' => null,
                    'error' => 'Invalid phone number. Use 09xxxxxxxxx, +639xxxxxxxxx, or 639xxxxxxxxx.',
                    'response' => '',
                ];
            } else {
                $payload = [
                    'apikey' => $semaphoreKey,
                    'number' => $normalizedRecipient,
                    'message' => $message,
                    'sendername' => $semaphoreSender,
                ];

                $ch = curl_init($sendEndpoint);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Content-Type: application/x-www-form-urlencoded',
                ]);
                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));

                $rawResponse = curl_exec($ch);
                $curlError = curl_error($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                $sendResult = [
                    'success' => !$curlError && in_array((int) $httpCode, [200, 201], true),
                    'status_code' => $httpCode,
                    'error' => $curlError ? 'cURL Error: ' . $curlError : '',
                    'response' => $rawResponse === false ? '' : (string) $rawResponse,
                    'normalized_number' => $normalizedRecipient,
                ];
            }
        }
    }
}

if ($authOk && $semaphoreKey !== '' && function_exists('curl_init')) {
    $accountUrl = $accountEndpoint . '?apikey=' . urlencode($semaphoreKey);

    $ch = curl_init($accountUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $rawAccountResponse = curl_exec($ch);
    $accountCurlError = curl_error($ch);
    $accountHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $accountResult = [
        'success' => !$accountCurlError && in_array((int) $accountHttpCode, [200, 201], true),
        'status_code' => $accountHttpCode,
        'error' => $accountCurlError ? 'cURL Error: ' . $accountCurlError : '',
        'response' => $rawAccountResponse === false ? '' : (string) $rawAccountResponse,
    ];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Semaphore SMS Debug Test</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 850px;
            margin: 24px auto;
            padding: 0 16px;
            color: #111827;
            background: #f9fafb;
        }

        h1 {
            font-size: 24px;
            margin-bottom: 6px;
        }

        h2 {
            font-size: 18px;
            margin-top: 24px;
        }

        .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
        }

        .status {
            padding: 10px 12px;
            border-radius: 8px;
            margin: 8px 0;
            font-size: 14px;
        }

        .success {
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
        }

        .error {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }

        .warning {
            background: #fffbeb;
            color: #92400e;
            border: 1px solid #fde68a;
        }

        .muted {
            color: #6b7280;
            font-size: 13px;
        }

        label {
            display: block;
            margin-top: 12px;
            margin-bottom: 5px;
            font-weight: bold;
        }

        input,
        textarea {
            width: 100%;
            box-sizing: border-box;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
        }

        textarea {
            min-height: 120px;
            resize: vertical;
        }

        button {
            margin-top: 14px;
            padding: 10px 16px;
            background: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        }

        button:hover {
            background: #1d4ed8;
        }

        pre {
            background: #0f172a;
            color: #e2e8f0;
            padding: 12px;
            border-radius: 8px;
            overflow: auto;
            font-size: 13px;
        }

        .row {
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: 8px;
            padding: 6px 0;
            border-bottom: 1px solid #f3f4f6;
        }

        .row strong {
            color: #374151;
        }
    </style>
</head>
<body>
    <h1>Semaphore SMS Debug Test</h1>
    <p class="muted">
        This file is for development testing only. Remove or protect this file in production.
    </p>

    <?php if ($smsDebugPassword === ''): ?>
        <div class="status warning">
            Warning: SMS_DEBUG_PASSWORD is not set. This debug page is currently unprotected.
        </div>
    <?php endif; ?>

    <?php if (!$authOk): ?>
        <div class="status error">
            Debug Access Failed: <?php echo h($authError); ?>
        </div>
    <?php endif; ?>

    <div class="card">
        <h2>Configuration Status</h2>

        <div class="row">
            <strong>Environment loaded</strong>
            <span><?php echo $envLoaded ? 'Yes' : 'No / using getenv fallback'; ?></span>
        </div>

        <div class="row">
            <strong>SMS_ENABLE</strong>
            <span><?php echo $smsEnabled !== '' ? h($smsEnabled) : 'Missing'; ?></span>
        </div>

        <div class="row">
            <strong>SMS_PROVIDER</strong>
            <span><?php echo $smsProvider !== '' ? h($smsProvider) : 'Missing'; ?></span>
        </div>

        <div class="row">
            <strong>SEMAPHORE_API_KEY</strong>
            <span><?php echo h(mask_key($semaphoreKey)); ?></span>
        </div>

        <div class="row">
            <strong>SEMAPHORE_SENDER_NAME</strong>
            <span><?php echo h($semaphoreSender); ?></span>
        </div>

        <div class="row">
            <strong>SEMAPHORE_BASE_URL</strong>
            <span><?php echo h($semaphoreBaseUrl); ?></span>
        </div>

        <div class="row">
            <strong>Send Endpoint</strong>
            <span><?php echo h($sendEndpoint); ?></span>
        </div>

        <div class="row">
            <strong>Account Endpoint</strong>
            <span><?php echo h($accountEndpoint); ?>?apikey=********</span>
        </div>
    </div>

    <div class="card">
        <h2>Send Test SMS</h2>

        <form method="POST">
            <?php if ($smsDebugPassword !== ''): ?>
                <label for="debug_password">Debug Password</label>
                <input
                    id="debug_password"
                    name="debug_password"
                    type="password"
                    placeholder="Enter debug password"
                    required
                >
            <?php endif; ?>

            <label for="recipient">Recipient</label>
            <input
                id="recipient"
                name="recipient"
                type="text"
                placeholder="09xxxxxxxxx or +639xxxxxxxxx"
                value="<?php echo h($recipient); ?>"
                required
            >

            <label for="message">Message</label>
            <textarea
                id="message"
                name="message"
                placeholder="Enter test message"
                required
            ><?php echo h($message); ?></textarea>

            <button type="submit">Send Test SMS</button>
        </form>
    </div>

    <?php if ($sendResult !== null): ?>
        <div class="card">
            <h2>Send Test Result</h2>

            <div class="status <?php echo $sendResult['success'] ? 'success' : 'error'; ?>">
                Send Test: <?php echo $sendResult['success'] ? 'Success' : 'Failed'; ?>
            </div>

            <?php if (!empty($sendResult['error'])): ?>
                <div class="status error">
                    <?php echo h($sendResult['error']); ?>
                </div>
            <?php endif; ?>

            <p class="muted">
                HTTP Status: <?php echo $sendResult['status_code'] !== null ? h($sendResult['status_code']) : 'N/A'; ?>
            </p>

            <?php if (!empty($sendResult['normalized_number'])): ?>
                <p class="muted">
                    Normalized Number: <?php echo h($sendResult['normalized_number']); ?>
                </p>
            <?php endif; ?>

            <?php if ($sendResult['response'] !== ''): ?>
                <pre><?php echo h(decode_json_or_raw($sendResult['response'])); ?></pre>
            <?php endif; ?>
        </div>
    <?php endif; ?>

    <div class="card">
        <h2>Account Check</h2>

        <?php if ($semaphoreKey === ''): ?>
            <div class="status error">
                Account Check: Failed - SEMAPHORE_API_KEY is missing.
            </div>
        <?php elseif (!function_exists('curl_init')): ?>
            <div class="status error">
                Account Check: Failed - cURL extension is not available.
            </div>
        <?php elseif ($accountResult === null): ?>
            <div class="status warning">
                Account Check: Not executed.
            </div>
        <?php else: ?>
            <div class="status <?php echo $accountResult['success'] ? 'success' : 'error'; ?>">
                Account Check: <?php echo $accountResult['success'] ? 'Success' : 'Failed'; ?>
            </div>

            <?php if (!empty($accountResult['error'])): ?>
                <div class="status error">
                    <?php echo h($accountResult['error']); ?>
                </div>
            <?php endif; ?>

            <p class="muted">
                HTTP Status: <?php echo $accountResult['status_code'] !== null ? h($accountResult['status_code']) : 'N/A'; ?>
            </p>

            <?php if ($accountResult['response'] !== ''): ?>
                <pre><?php echo h(decode_json_or_raw($accountResult['response'])); ?></pre>
            <?php endif; ?>
        <?php endif; ?>
    </div>
</body>
</html>