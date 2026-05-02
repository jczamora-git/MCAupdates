<?php
// DEVELOPMENT ONLY: Remove or protect this file in production.

declare(strict_types=1);

$envLoaded = false;
$envPath = __DIR__ . '/app';
$autoloadPath = $envPath . '/vendor/autoload.php';

if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
    if (class_exists('Dotenv\\Dotenv')) {
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        $envLoaded = true;
    }
}

$smsApiKey = $_ENV['SMS_API_KEY'] ?? getenv('SMS_API_KEY') ?: '';
$smsApiUrl = $_ENV['SMS_API_URL'] ?? getenv('SMS_API_URL') ?: '';
$smsApiBaseUrl = $_ENV['SMS_API_BASE_URL'] ?? getenv('SMS_API_BASE_URL') ?: '';

if ($smsApiUrl === '' && $smsApiBaseUrl !== '') {
    $smsApiUrl = rtrim($smsApiBaseUrl, '/') . '/api/v1/send/sms';
}

$responseText = '';
$isSuccess = null;
$errorText = '';

$recipient = '';
$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $recipient = trim((string)($_POST['recipient'] ?? ''));
    $message = trim((string)($_POST['message'] ?? ''));

    if ($smsApiKey === '' || $smsApiUrl === '') {
        $errorText = 'SMS_API_KEY or SMS_API_URL is not configured. Check your .env file.';
        $isSuccess = false;
    } elseif ($recipient === '' || $message === '') {
        $errorText = 'Recipient and message are required.';
        $isSuccess = false;
    } else {
        $payload = json_encode([
            'recipient' => $recipient,
            'message' => $message
        ]);

        $ch = curl_init($smsApiUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'x-api-key: ' . $smsApiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

        $responseText = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlError) {
            $errorText = 'cURL Error: ' . $curlError;
            $isSuccess = false;
        } else {
            $decoded = json_decode((string)$responseText, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($decoded['success'])) {
                $isSuccess = (bool)$decoded['success'];
            } else {
                $isSuccess = ($statusCode >= 200 && $statusCode < 300);
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMS API Debug Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #111827; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    .hint { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
    label { display: block; font-weight: 600; margin: 12px 0 6px; }
    input, textarea { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
    textarea { min-height: 120px; resize: vertical; }
    button { margin-top: 14px; padding: 10px 16px; background: #2563eb; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .status { margin-top: 16px; padding: 12px; border-radius: 6px; }
    .success { background: #ecfdf3; color: #065f46; border: 1px solid #a7f3d0; }
    .error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    pre { background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow: auto; }
  </style>
</head>
<body>
  <h1>SMS API PH Debug Test</h1>
  <div class="hint">Environment loaded: <?php echo $envLoaded ? 'yes' : 'no'; ?> | Endpoint: <?php echo htmlspecialchars($smsApiUrl ?: 'not set'); ?></div>

  <form method="POST">
    <label for="recipient">Recipient</label>
    <input id="recipient" name="recipient" type="text" placeholder="+639xxxxxxxxx" value="<?php echo htmlspecialchars($recipient); ?>" />

    <label for="message">Message</label>
    <textarea id="message" name="message" placeholder="Enter test message..."><?php echo htmlspecialchars($message); ?></textarea>

    <button type="submit">Send Test SMS</button>
  </form>

  <?php if ($isSuccess !== null): ?>
    <div class="status <?php echo $isSuccess ? 'success' : 'error'; ?>">
      <?php if ($isSuccess): ?>
        SMS request completed successfully.
      <?php else: ?>
        SMS request failed. <?php echo htmlspecialchars($errorText); ?>
      <?php endif; ?>
    </div>
  <?php endif; ?>

  <?php if ($responseText !== ''): ?>
    <h2>Raw Response</h2>
    <pre><?php echo htmlspecialchars((string)$responseText); ?></pre>
  <?php endif; ?>
</body>
</html>
