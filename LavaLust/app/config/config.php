<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/**
 * ------------------------------------------------------------------
 * LavaLust - an opensource lightweight PHP MVC Framework
 * ------------------------------------------------------------------
 *
 * MIT License
 *
 * Copyright (c) 2020 Ronald M. Marasigan
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @package LavaLust
 * @author Ronald M. Marasigan <ronald.marasigan@yahoo.com>
 * @since Version 1
 * @link https://github.com/ronmarasigan/LavaLust
 * @license https://opensource.org/licenses/MIT MIT License
 */

/*
| -------------------------------------------------------------------
|  Config Files
| -------------------------------------------------------------------
| This file is for setting-up default settings.
|
*/

/*
| -------------------------------------------------------------------
|  Your Own Configs
| -------------------------------------------------------------------
| For easy access on your config, just put them below
| You can simply get configs using config_item() function anywhere
| My Configs:
*/

/*
| -------------------------------------------------------------------
| Application Timezone (Global)
| -------------------------------------------------------------------
| app_timezone: Used by PHP date/time functions globally.
| db_timezone_offset: Optional DB session timezone override (MySQL/compatible).
| Set to null to use the database server's own timezone clock.
*/
$config['app_timezone']            = 'Asia/Manila';
$config['db_timezone_offset']      = null;

/*
| -------------------------------------------------------------------
| Firebase / FCM
| -------------------------------------------------------------------
| firebase_project_id: Optional override for Firebase project ID used by FCM API.
| firebase_service_account_path: Optional absolute path to service-account.json.
| firebase_service_account_json: Optional raw JSON string of service account.
| firebase_service_account_base64: Optional base64 encoded service account JSON.
| Leave null to use default helper resolution.
*/
$config['firebase_project_id'] = $_ENV['FIREBASE_PROJECT_ID'] ?? getenv('FIREBASE_PROJECT_ID') ?: null;
$config['firebase_service_account_path'] = $_ENV['FIREBASE_SERVICE_ACCOUNT_PATH'] ?? getenv('FIREBASE_SERVICE_ACCOUNT_PATH') ?: null;
$config['firebase_service_account_json'] = $_ENV['FIREBASE_SERVICE_ACCOUNT_JSON'] ?? getenv('FIREBASE_SERVICE_ACCOUNT_JSON') ?: null;
$config['firebase_service_account_base64'] = $_ENV['FIREBASE_SERVICE_ACCOUNT_BASE64'] ?? getenv('FIREBASE_SERVICE_ACCOUNT_BASE64') ?: null;

/*
| -------------------------------------------------------------------
| LavaLust Version
| -------------------------------------------------------------------
*/
$config['VERSION']                 = '4.2.4';

/*
| -------------------------------------------------------------------
| Default Environment
| -------------------------------------------------------------------
| Values: development and production
*/
$config['ENVIRONMENT']             = 'development';

/*
|--------------------------------------------------------------------------
| Base Site URL
|--------------------------------------------------------------------------
|
| URL to your LavaLust root. Typically this will be your base URL,
| WITH a trailing slash:
|
|	http://example.com/
|
| WARNING: You MUST set this value!
|
*/
$config['base_url'] 				= '';

/*
|--------------------------------------------------------------------------
| Index File
|--------------------------------------------------------------------------
|
| If you are using mod_rewrite to remove index.php in the URL set this
| variable to blank.
|
*/
$config['index_page']               = '';

/*
|--------------------------------------------------------------------------
| Error Logging Threshold
|--------------------------------------------------------------------------
|
| You can enable error logging by setting a threshold over zero.
|
|	0 = Disables logging
|	1 = Exception and Error Messages
|   2 = Debug
|   3 = All
|
*/
$config['log_threshold']            = 0;
$config['log_dir']                  = 'runtime/logs/';

/*
|--------------------------------------------------------------------------
| Composer auto-loading
|--------------------------------------------------------------------------
|
| Enabling this setting will tell LavaLust to look for a Composer
| package auto-loader script in app/vendor/autoload.php.
|
|	$config['composer_autoload'] = TRUE;
|
| Or if you have your vendor/ directory located somewhere else, you
| can opt to set a specific path as well:
|
|	$config['composer_autoload'] = '/path/to/vendor/autoload.php';
|
| For more information about Composer, please visit http://getcomposer.org/
|
| Note: This will NOT disable or override the LavaLust-specific
|	autoloading (app/config/autoload.php)
*/
$config['composer_autoload']        = TRUE;

/*
|--------------------------------------------------------------------------
| Allowed URL Characters
|--------------------------------------------------------------------------
|
| This lets you specify which characters are permitted within your URLs.
| When someone tries to submit a URL with disallowed characters they will
| get a warning message.
|
| As a security measure you are STRONGLY encouraged to restrict URLs to
| as few characters as possible.  By default only these are allowed: a-z 0-9~%.:_-
|
| Leave blank to allow all characters -- but only if you are insane.
|
| The configured value is actually a regular expression character group
| and it will be executed as: ! preg_match('/^[<permitted_uri_chars>]+$/i
|
| DO NOT CHANGE THIS UNLESS YOU FULLY UNDERSTAND THE REPERCUSSIONS!!
|
*/
$config['permitted_uri_chars']		= 'a-z 0-9~%.:_\-';

/*
|--------------------------------------------------------------------------
| Default Character Set
|--------------------------------------------------------------------------
|
| This config will be use html_escape function
|
*/
$config['charset']					= 'UTF-8';

/*
|--------------------------------------------------------------------------
| Error Views Directory Path
|--------------------------------------------------------------------------
|
| app/views/errors/ directory.  Use a full server path with trailing slash.
|
*/
$config['error_view_path']         	= '';

/*
|--------------------------------------------------------------------------
| 404 Error Overide
|--------------------------------------------------------------------------
|
| $config['404_override'] is use if you want to add custom 404 error page.
|
|	example: $confg['404_override'] = 'default/404'
|
|	if you have 'default folder' and '404.php file' inside error folder in view
|
*/
$config['404_override']       	    = '';

/*
|--------------------------------------------------------------------------
| Default Language
|--------------------------------------------------------------------------
|
| This determines which set of language files should be used. Make sure
| there is an available translation if you intend to use something other
| than en-US.
|
*/
$config['language'] 				= 'en-US';

/*
|--------------------------------------------------------------------------
| Session
|--------------------------------------------------------------------------
|
| Settings for sessions
| $config['sess_save_path'] will get the session save path form php.ini
| if empty.
|
|--------------------------------------------------------------------------
*/
$config['sess_driver']             = 'file';
$config['sess_cookie_name']        = 'LLSession';
$config['sess_expiration']         = 7200;
$config['sess_save_path']          = '';
$config['sess_match_ip']           = FALSE;  // Changed to FALSE - prevents logout on IP change
$config['sess_match_fingerprint']  = FALSE;  // Changed to FALSE - prevents logout on fingerprint change
$config['sess_time_to_update']     = 300;
$config['sess_regenerate_destroy'] = TRUE;
$config['sess_expire_on_close']    = FALSE;

/*
|--------------------------------------------------------------------------
| Cookies
|--------------------------------------------------------------------------
|
|Settings for cookies.
|
|--------------------------------------------------------------------------
*/
$config['cookie_prefix']           = '';
$config['cookie_domain']           = '';  // Host-only cookie; works for localhost and production domains
$config['cookie_path']             = '/';
$is_https_request = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443) ||
    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
);
$config['cookie_secure']           = $is_https_request;
$config['cookie_expiration']       = 86400;
$config['cookie_httponly']         = TRUE;    // Prevents XSS attacks
$config['cookie_samesite']         = 'Lax';

/*
|--------------------------------------------------------------------------
| Cache
|--------------------------------------------------------------------------
|
| Settings for Cache
| Set your cache directory and cache expiration time here
| Default:
|   $config['cache_dir'] = 'runtime/cache/';
|   $config['cache_default_expires'] = 0;
|
|--------------------------------------------------------------------------
*/
$config['cache_dir']               = 'runtime/cache/';
$config['cache_default_expires']   = 0;

/*
|--------------------------------------------------------------------------
| Encryption Key
|--------------------------------------------------------------------------
|
| If you use the Encryption class, you must set an encryption key.
|
|
*/
$config['encryption_key']           = '';

/*
|--------------------------------------------------------------------------
| Soft Delete
|--------------------------------------------------------------------------
|
| If you use the Encryption class, you must set an encryption key.
|
| Default:
|   $config['soft_delete']  = FALSE;
|   $config['soft_delete_column'] = 'deleted_at;
|
*/
$config['soft_delete']              = FALSE;
$config['soft_delete_column']       = 'deleted_at';

/*
|--------------------------------------------------------------------------
| Cross Site Request Forgery
|--------------------------------------------------------------------------
| Enables a CSRF cookie token to be set. When set to TRUE, token will be
| checked on a submitted form. If you are accepting user data, it is strongly
| recommended CSRF protection be enabled.
|
| 'csrf_exclude_uris' = Array of uris that will not go throught protection
| 'csrf_token_name' = The token name
| 'csrf_cookie_name' = The cookie name
| 'csrf_expire' = The number in seconds the token should expire.
*/
$config['csrf_protection']         = FALSE;
$config['csrf_exclude_uris']       = array();
$config['csrf_token_name']         = 'csrf_test_name';
$config['csrf_cookie_name']        = 'csrf_cookie_name';
$config['csrf_expire']             = 7200;
$config['csrf_regenerate']         = FALSE;

/*
|--------------------------------------------------------------------------
| Frontend Portal URL
|--------------------------------------------------------------------------
| URL to the frontend portal for email links and redirects
| Host-aware fallback so production email links never point to localhost.
*/
$host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$isLocalHost = ($host === 'localhost') || ($host === '127.0.0.1')
    || (strpos($host, 'localhost:') === 0) || (strpos($host, '127.0.0.1:') === 0);
$isDevHost = (strpos($host, 'dev.mcaportal.online') !== false);

$envPortalUrl = trim((string) ($_ENV['PORTAL_URL'] ?? getenv('PORTAL_URL') ?: ''));
$envBannerUrl = trim((string) ($_ENV['BANNER_URL'] ?? getenv('BANNER_URL') ?: ''));

if ($isLocalHost) {
    $config['portal_url'] = 'http://localhost:5174';
    $config['banner_url'] = 'http://localhost:5174/public/email-banner.png';
} elseif ($isDevHost) {
    $config['portal_url'] = 'https://dev.mcaportal.online/ui';
    $config['banner_url'] = 'https://dev.mcaportal.online/ui/email-banner.png';
} elseif ($envPortalUrl !== '') {
    $config['portal_url'] = rtrim($envPortalUrl, '/');
    $config['banner_url'] = $envBannerUrl !== ''
        ? $envBannerUrl
        : ($config['portal_url'] . '/email-banner.png');
} else {
    $config['portal_url'] = 'https://mcaportal.online';
    $config['banner_url'] = 'https://mcaportal.online/email-banner.png';
}

/*
|--------------------------------------------------------------------------
| Sentiment Analysis API Configuration
|--------------------------------------------------------------------------
| Controls which sentiment API to use:
|   - 'local': Python Flask API (http://localhost:5000)
|   - 'external': Hugging Face API (requires HF_API_TOKEN)
|   - 'auto': Try local first, fallback to external
|
| Set HF_API_TOKEN environment variable or hardcode below for external API
*/
$config['sentiment_api_mode'] = 'external'; // 'local' | 'external' | 'auto'
$config['sentiment_local_url'] = 'http://localhost:5000';
$config['sentiment_hf_token'] = $_ENV['HF_API_TOKEN'] ?? getenv('HF_API_TOKEN') ?: ''; // Read from .env file or environment variable
$config['sentiment_hf_url'] = 'https://router.huggingface.co/hf-inference/models/tabularisai/multilingual-sentiment-analysis';
$config['feedback_moderation_hf_url'] = 'https://router.huggingface.co/hf-inference/models/facebook/roberta-hate-speech-dynabench-r4-target';
$config['feedback_moderation_threshold'] = 0.75;
$config['feedback_blocked_keywords'] = [
    'putang ina',
    'gago',
    'tanga',
    'bobo',
    'ulol',
    'fuck you',
    'bitch',
    'nigger',
    'faggot',
    'retard',
];
$config['insights_hf_url'] = 'https://router.huggingface.co/v1/chat/completions';
$config['insights_hf_model'] = 'Qwen/Qwen2.5-7B-Instruct:together';
$config['insights_window_days'] = 7; // Today + previous 6 days
$config['insights_allow_regen'] = false; // Set true to bypass weekly limit (dev/demo)
$config['chat_hf_url'] = 'https://router.huggingface.co/v1/chat/completions';
$config['chat_hf_model'] = 'Qwen/Qwen2.5-7B-Instruct:together';
$config['chat_system_prompt'] = 'You are the Campus Companion assistant for a Philippine elementary school. You assist users based on their role (admin, teacher, student, or enrollee). Rules: (1) For navigation questions ("where do I...", "how do I go to...", "find the page for..."), ALWAYS use routes from the AVAILABLE NAVIGATION ROUTES block — never invent routes. Format links as [link:Label|/route]. (2) For factual data (fees, balances, enrollment status), use the LIVE DATABASE CONTEXT block — never invent or estimate numbers. (3) Use the Knowledge base only for school policies and custom school info not covered by live data. (4) Only mention pages that exist in the AVAILABLE NAVIGATION ROUTES for the user\'s role. Do not suggest pages the user cannot access. (5) If the answer is not in any context block, say you do not have that information yet and suggest contacting the admin. Be concise and friendly.';
$config['chat_knowledge_only'] = false; // Set true to disable LLM fallback
$config['rfid_admin_passkey'] = $_ENV['RFID_ADMIN_PASSKEY'] ?? getenv('RFID_ADMIN_PASSKEY') ?: 'admin123'; // Admin-only RFID lock exit
?>
