<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class SentimentController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->model('FeedbackModel');
        $this->call->model('WeeklyInsightsModel');
        $this->call->library('session');
    }

    /**
     * Health check for sentiment API
     * GET /api/sentiment/health
     */
    public function api_health()
    {
        api_set_json_headers();

        $mode = config_item('sentiment_api_mode') ?: 'local';
        $localUrl = config_item('sentiment_local_url') ?: 'http://localhost:5000';
        $hfToken = config_item('sentiment_hf_token');

        $status = [
            'mode' => $mode,
            'local' => 'offline',
            'external' => $hfToken ? 'configured' : 'not_configured',
            'active' => 'none'
        ];

        // Check local API
        if ($mode === 'local' || $mode === 'auto') {
            try {
                $ch = curl_init("$localUrl/health");
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 2);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode === 200) {
                    $status['local'] = 'online';
                    $status['active'] = 'local';
                    
                    http_response_code(200);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Sentiment service online',
                        'status' => $status
                    ]);
                    return;
                }
            } catch (Exception $e) {
                // Local failed, continue to check external
            }
        }

        // Check external API if local failed in auto mode or if external mode
        if (($mode === 'external' || $mode === 'auto') && $hfToken) {
            $status['external'] = 'online';
            $status['active'] = 'external';
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Sentiment service online (external)',
                'status' => $status
            ]);
            return;
        }

        // All services offline
        $status['active'] = 'none';
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => 'Sentiment service offline',
            'status' => $status
        ]);
    }

    /**
     * Analyze single text
     * POST /api/sentiment/predict
     * Body: {"text": "some text"}
     */
    public function api_predict()
    {
        api_set_json_headers();

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['text'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Text is required'
                ]);
                return;
            }

            $result = $this->analyzeSentiment($data['text']);

            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'sentiment' => $result['sentiment'],
                    'confidence' => $result['confidence'],
                    'probabilities' => $result['probabilities']
                ]);
            } else {
                throw new Exception('Sentiment analysis failed');
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }

    /**
     * Analyze multiple texts
     * POST /api/sentiment/predict/batch
     * Body: {"texts": ["text1", "text2", ...]}
     */
    public function api_predict_batch()
    {
        api_set_json_headers();

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['texts']) || !is_array($data['texts'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Texts array is required'
                ]);
                return;
            }

            $results = $this->analyzeSentimentBatch($data['texts']);

            if ($results) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'results' => $results
                ]);
            } else {
                throw new Exception('Batch sentiment analysis failed');
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }

    /**
     * Generate weekly insight cards from the last 7 days of feedback
     * POST /api/insights/weekly
     */
    public function api_weekly_insights()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $payload = json_decode(file_get_contents('php://input'), true);
            $fetchOnly = !empty($payload['fetch_only']);
            $days = config_item('insights_window_days') ?: 7;
            $allowRegen = (bool) config_item('insights_allow_regen');
            $windowStart = date('Y-m-d', strtotime('-' . max(0, $days - 1) . ' days'));
            $windowEnd = app_today();

            if (!$allowRegen) {
                $existing = $this->WeeklyInsightsModel->get_by_window($windowStart, $windowEnd);
                if (!empty($existing)) {
                    $stored = json_decode($existing['insights_json'] ?? '[]', true);
                    $lastGenerated = $existing['updated_at'] ?? $existing['created_at'] ?? null;
                    http_response_code(200);
                    echo json_encode([
                        'success' => true,
                        'insights' => is_array($stored) ? $stored : [],
                        'window_days' => $days,
                        'total_feedback' => (int) ($existing['total_feedback'] ?? 0),
                        'last_generated' => $lastGenerated,
                        'cached' => true,
                        'regen_allowed' => $allowRegen
                    ]);
                    return;
                }
            }

            if ($fetchOnly) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'insights' => [],
                    'window_days' => $days,
                    'total_feedback' => 0,
                    'last_generated' => null,
                    'cached' => false,
                    'regen_allowed' => $allowRegen
                ]);
                return;
            }

            $items = $this->FeedbackModel->get_recent($days);

            if (!$items || !is_array($items) || count($items) === 0) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'insights' => [],
                    'window_days' => $days,
                    'total_feedback' => 0,
                    'last_generated' => null,
                    'cached' => false,
                    'regen_allowed' => $allowRegen
                ]);
                return;
            }

            $summary = $this->buildWeeklySummary($items, $days, $windowStart, $windowEnd);
            $insights = $this->callInsightsModel($summary);

            $this->WeeklyInsightsModel->save_window_insights(
                $windowStart,
                $windowEnd,
                $insights,
                count($items),
                config_item('insights_hf_model') ?: null
            );

            $lastGenerated = app_now();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'insights' => $insights,
                'window_days' => $days,
                'total_feedback' => count($items),
                'last_generated' => $lastGenerated,
                'cached' => false,
                'regen_allowed' => $allowRegen
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }

    /**
     * Analyze single text - tries local first, falls back to external
     */
    private function analyzeSentiment($text)
    {
        $mode = config_item('sentiment_api_mode') ?: 'local';

        // Try local API
        if ($mode === 'local' || $mode === 'auto') {
            $result = $this->callLocalAPI($text);
            if ($result) {
                return $result;
            }
            
            if ($mode === 'local') {
                throw new Exception('Local sentiment API unavailable');
            }
        }

        // Try external API (Hugging Face)
        if ($mode === 'external' || $mode === 'auto') {
            return $this->callHuggingFaceAPI([$text])[0] ?? null;
        }

        throw new Exception('No sentiment service available');
    }

    /**
     * Analyze batch texts - tries local first, falls back to external
     */
    private function analyzeSentimentBatch($texts)
    {
        $mode = config_item('sentiment_api_mode') ?: 'local';

        // Try local API
        if ($mode === 'local' || $mode === 'auto') {
            $result = $this->callLocalAPIBatch($texts);
            if ($result) {
                return $result;
            }
            
            if ($mode === 'local') {
                throw new Exception('Local sentiment API unavailable');
            }
        }

        // Try external API (Hugging Face)
        if ($mode === 'external' || $mode === 'auto') {
            return $this->callHuggingFaceAPI($texts);
        }

        throw new Exception('No sentiment service available');
    }

    /**
     * Call local Python Flask API (single prediction)
     */
    private function callLocalAPI($text)
    {
        $localUrl = config_item('sentiment_local_url') ?: 'http://localhost:5000';

        try {
            $ch = curl_init("$localUrl/predict");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['text' => $text]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && $response) {
                $data = json_decode($response, true);
                return [
                    'sentiment' => $data['sentiment'] ?? 'neutral',
                    'confidence' => $data['confidence'] ?? 0,
                    'probabilities' => $data['probabilities'] ?? []
                ];
            }
        } catch (Exception $e) {
            // Return null to trigger fallback
        }

        return null;
    }

    /**
     * Call local Python Flask API (batch prediction)
     */
    private function callLocalAPIBatch($texts)
    {
        $localUrl = config_item('sentiment_local_url') ?: 'http://localhost:5000';

        try {
            $ch = curl_init("$localUrl/predict/batch");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['texts' => $texts]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 60);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && $response) {
                $data = json_decode($response, true);
                return $data['results'] ?? [];
            }
        } catch (Exception $e) {
            // Return null to trigger fallback
        }

        return null;
    }

    /**
     * Call Hugging Face Inference API
     * Makes individual API calls for each text (HF router doesn't support batch)
     * Maps 5-class to 3-class sentiment
     */
    private function callHuggingFaceAPI($texts)
    {
        $hfToken = config_item('sentiment_hf_token');
        $hfUrl = config_item('sentiment_hf_url');

        if (empty($hfToken)) {
            throw new Exception('Hugging Face API token not configured');
        }

        try {
            $results = [];
            
            // Process each text individually
            foreach ($texts as $text) {
                $ch = curl_init($hfUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['inputs' => $text]));
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Content-Type: application/json',
                    "Authorization: Bearer $hfToken"
                ]);
                curl_setopt($ch, CURLOPT_TIMEOUT, 30);
                
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode !== 200 || !$response) {
                    throw new Exception("Hugging Face API error: HTTP $httpCode");
                }

                $hfResults = json_decode($response, true);

                // Debug: Log the actual response
                error_log("HF Response for text: " . json_encode($hfResults));

                if (empty($hfResults) || !is_array($hfResults)) {
                    throw new Exception("Invalid HF API response structure. Response: " . json_encode($hfResults));
                }

                // HF router may return nested arrays like [[{label,score}, ...]]
                if (isset($hfResults[0]) && is_array($hfResults[0]) && isset($hfResults[0][0])) {
                    $hfResults = $hfResults[0];
                }

                // Find sentiment with highest score
                $topResult = null;
                $maxScore = -1;
                foreach ($hfResults as $result) {
                    if (isset($result['score']) && $result['score'] > $maxScore) {
                        $maxScore = $result['score'];
                        $topResult = $result;
                    }
                }
                
                error_log("Top result found: " . json_encode($topResult));
                error_log("Max score: " . $maxScore);
                
                if (!$topResult || !isset($topResult['label'])) {
                    throw new Exception("Could not determine top sentiment from HF results. TopResult: " . json_encode($topResult));
                }
                
                // Map 5-class to 3-class
                $sentiment = $this->mapHFSentimentTo3Class($topResult['label']);
                
                // Aggregate probabilities for 3 classes
                $probabilities = [
                    'positive' => 0,
                    'neutral' => 0,
                    'negative' => 0
                ];
                
                foreach ($hfResults as $result) {
                    if (isset($result['label']) && isset($result['score'])) {
                        $mappedLabel = $this->mapHFSentimentTo3Class($result['label']);
                        $probabilities[$mappedLabel] += $result['score'];
                    }
                }

                $results[] = [
                    'sentiment' => $sentiment,
                    'confidence' => $topResult['score'],
                    'probabilities' => $probabilities
                ];
            }

            return $results;
        } catch (Exception $e) {
            throw new Exception('Hugging Face API call failed: ' . $e->getMessage());
        }
    }

    private function buildWeeklySummary($items, $days, $windowStart, $windowEnd)
    {
        $categories = [];

        foreach ($items as $item) {
            $category = $item['category'] ?? 'General';
            if (!isset($categories[$category])) {
                $categories[$category] = [
                    'total' => 0,
                    'positive' => 0,
                    'neutral' => 0,
                    'negative' => 0,
                    'samples' => []
                ];
            }

            $categories[$category]['total'] += 1;
            $sentiment = strtolower($item['sentiment'] ?? '');
            if (isset($categories[$category][$sentiment])) {
                $categories[$category][$sentiment] += 1;
            }

            if (count($categories[$category]['samples']) < 2) {
                $message = trim($item['message'] ?? '');
                if ($message !== '') {
                    $categories[$category]['samples'][] = substr($message, 0, 180);
                }
            }
        }

        return [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'window_days' => $days,
            'total_feedback' => count($items),
            'categories' => $categories
        ];
    }

    private function callInsightsModel($summary)
    {
        $hfToken = config_item('sentiment_hf_token');
        $hfUrl = config_item('insights_hf_url');
        $hfModel = config_item('insights_hf_model');

        if (empty($hfToken)) {
            throw new Exception('Hugging Face API token not configured');
        }

        if (empty($hfUrl) || empty($hfModel)) {
            throw new Exception('Insights model not configured');
        }

        $payload = [
            'model' => $hfModel,
            'stream' => false,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are an analytics consultant. Return a JSON array of exactly 3 objects with keys "title" and "description". Titles must be short (2-5 words). Descriptions must be actionable directives with a clear next step, not a summary. No extra text.'
                ],
                [
                    'role' => 'user',
                    'content' => 'Weekly feedback summary (JSON): ' . json_encode($summary) . ' Produce actionable insights like: "Payment receipts timing. Delay reports increased. Check receipt batch jobs."'
                ]
            ]
        ];

        $ch = curl_init($hfUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $hfToken"
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            throw new Exception("Insights model error: HTTP $httpCode");
        }

        $data = json_decode($response, true);
        $content = $data['choices'][0]['message']['content'] ?? '';
        $insights = $this->extractJsonArray($content);

        if (!is_array($insights)) {
            throw new Exception('Invalid insights response');
        }

        $normalized = [];
        foreach ($insights as $item) {
            if (count($normalized) >= 3) {
                break;
            }
            if (!is_array($item)) {
                continue;
            }
            $title = trim((string) ($item['title'] ?? ''));
            $description = trim((string) ($item['description'] ?? ''));
            if ($title === '' || $description === '') {
                continue;
            }
            $normalized[] = [
                'title' => $title,
                'description' => $description
            ];
        }

        return $normalized;
    }

    private function extractJsonArray($content)
    {
        $trimmed = trim($content);
        $decoded = json_decode($trimmed, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos($content, '[');
        $end = strrpos($content, ']');
        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        $slice = substr($content, $start, $end - $start + 1);
        $decoded = json_decode($slice, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        return null;
    }

    /**
     * Map Hugging Face 5-class sentiment to 3-class
     * HF labels: "Very Positive", "Positive", "Neutral", "Negative", "Very Negative"
     * Our labels: "positive", "neutral", "negative"
     */
    private function mapHFSentimentTo3Class($hfLabel)
    {
        $label = strtolower($hfLabel);
        
        if (strpos($label, 'positive') !== false) {
            return 'positive';
        } elseif (strpos($label, 'negative') !== false) {
            return 'negative';
        }
        
        return 'neutral';
    }
}
