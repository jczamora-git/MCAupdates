<?php
/**
 * Predictive Analytics Dashboard - PHP Backend API
 * 
 * This backend loads Python models via subprocess calls and serves predictions.
 * Endpoints:
 *  - /api/enrollment/predict - Predict enrollment for a year
 *  - /api/enrollment/forecast - Multi-year enrollment forecast
 *  - /api/payment/predict - Predict payment for a year
 *  - /api/payment/forecast - Multi-year payment forecast
 *  - /api/historical - Get historical data
 *  - /api/analysis - Get most/least enrolled analysis
 *  - /api/metrics - Get model performance metrics
 */

// Enable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Configuration — paths resolved relative to this file
define('PYTHON_PATH', 'python');
define('BASE_DIR',    realpath(__DIR__ . '/..')  ?: __DIR__ . '/..');
define('MODELS_PATH', realpath(__DIR__ . '/../saved_models') ?: __DIR__ . '/../saved_models');
define('DATA_PATH',   realpath(__DIR__ . '/..') ?: __DIR__ . '/..');

// Router
$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Remove trailing slash
$request_uri = rtrim($request_uri, '/');

// Normalize URI when this API is hosted under a subfolder (e.g., /ml/predictive_api/api)
$script_dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$script_dir = rtrim($script_dir, '/');
if ($script_dir !== '' && $script_dir !== '/' && strpos($request_uri, $script_dir) === 0) {
    $request_uri = substr($request_uri, strlen($script_dir));
    if ($request_uri === '') {
        $request_uri = '/';
    }
}

// Normalize when accessed through root alias (e.g., /predictive-api -> this API)
$alias_prefix = '/predictive-api';
if ($request_uri === $alias_prefix || $request_uri === $alias_prefix . '/') {
    $request_uri = '/';
} elseif (strpos($request_uri, $alias_prefix . '/') === 0) {
    $request_uri = substr($request_uri, strlen($alias_prefix));
    if ($request_uri === '') {
        $request_uri = '/';
    }
}

try {
    switch (true) {
        // Root info/health (used by frontend online check)
        case preg_match('#^/$#', $request_uri):
            echo json_encode([
                'status' => 'online',
                'message' => 'Predictive Analytics PHP API is running',
                'base_path' => $script_dir !== '' ? $script_dir : '/'
            ]);
            break;

        // Enrollment endpoints
        case preg_match('#^/api/enrollment/predict$#', $request_uri):
            handleEnrollmentPredict();
            break;
        case preg_match('#^/api/enrollment/forecast$#', $request_uri):
            handleEnrollmentForecast();
            break;
        case preg_match('#^/api/forecast$#', $request_uri):
            handleForecastGrade();
            break;
        case preg_match('#^/api/forecast/all$#', $request_uri):
            handleForecastAll();
            break;
        
        // Payment endpoints
        case preg_match('#^/api/payment/predict$#', $request_uri):
            handlePaymentPredict();
            break;
        case preg_match('#^/api/payment/forecast$#', $request_uri):
            handlePaymentForecast();
            break;
        
        // Data endpoints
        case preg_match('#^/api/historical$#', $request_uri):
            handleHistoricalData();
            break;
        case preg_match('#^/api/analysis$#', $request_uri):
            handleAnalysis();
            break;
        case preg_match('#^/api/analysis/trends$#', $request_uri):
            handleAnalysisTrends();
            break;
        case preg_match('#^/api/metrics$#', $request_uri):
            handleMetrics();
            break;
        
        // Health check
        case preg_match('#^/api/health$#', $request_uri):
            echo json_encode(['status' => 'ok', 'timestamp' => date('Y-m-d H:i:s')]);
            break;
        
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/**
 * Handle enrollment prediction for specific year and grade
 */
function handleEnrollmentPredict() {
    $input = getJsonInput();
    $year = $input['year'] ?? date('Y') + 1;
    $grade = $input['grade'] ?? 'TotalOverall';
    
    $result = executePythonScript('enrollment_predict', [
        'year' => $year,
        'grade' => $grade
    ]);
    
    echo json_encode($result);
}

/**
 * Handle multi-year enrollment forecast
 */
function handleEnrollmentForecast() {
    $input = getJsonInput();
    $years = $input['years'] ?? 5;
    $grade = $input['grade'] ?? 'TotalOverall';
    
    $result = executePythonScript('enrollment_forecast', [
        'years' => $years,
        'grade' => $grade
    ]);
    
    echo json_encode($result);
}

/**
 * Flask-compatible endpoint: /api/forecast?grade=...&years=...
 */
function handleForecastGrade() {
    $input = getJsonInput();
    $years = (int)($input['years'] ?? 5);
    $grade = (string)($input['grade'] ?? 'TotalOverall');

    $result = executePythonScript('enrollment_forecast', [
        'years' => $years,
        'grade' => $grade
    ]);

    if (isset($result['success']) && !$result['success']) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => $result['error'] ?? 'Forecast failed'
        ]);
        return;
    }

    echo json_encode([
        'status' => 'success',
        'grade' => $grade,
        'base_year' => (int)($result['base_year'] ?? date('Y')),
        'forecast' => normalizeForecastRows($result['forecast'] ?? [])
    ]);
}

/**
 * Flask-compatible endpoint: /api/forecast/all?years=...
 */
function handleForecastAll() {
    $input = getJsonInput();
    $years = (int)($input['years'] ?? 5);
    $grades = ['Nursery 1', 'Nursery 2', 'Kinder', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'TotalOverall'];

    $allForecasts = [];
    $baseYear = null;

    foreach ($grades as $grade) {
        $result = executePythonScript('enrollment_forecast', [
            'years' => $years,
            'grade' => $grade
        ]);

        if (isset($result['success']) && !$result['success']) {
            continue;
        }

        if ($baseYear === null && isset($result['base_year'])) {
            $baseYear = (int)$result['base_year'];
        }

        $allForecasts[$grade] = normalizeForecastRows($result['forecast'] ?? []);
    }

    if ($baseYear === null) {
        $baseYear = date('Y');
    }

    echo json_encode([
        'status' => 'success',
        'base_year' => $baseYear,
        'forecast_years' => $years,
        'forecasts' => $allForecasts
    ]);
}

/**
 * Handle payment prediction
 */
function handlePaymentPredict() {
    $input = getJsonInput();
    $year = $input['year'] ?? date('Y') + 1;
    
    $result = executePythonScript('payment_predict', [
        'year' => $year
    ]);
    
    echo json_encode($result);
}

/**
 * Handle multi-year payment forecast
 */
function handlePaymentForecast() {
    $input = getJsonInput();
    $years = $input['years'] ?? 5;
    
    $result = executePythonScript('payment_forecast', [
        'years' => $years
    ]);
    
    if (isset($result['success']) && !$result['success']) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => $result['error'] ?? 'Payment forecast failed'
        ]);
        return;
    }

    echo json_encode([
        'status' => 'success',
        'base_year' => (int)($result['base_year'] ?? date('Y')),
        'forecast' => normalizeForecastRows($result['forecast'] ?? [])
    ]);
}

/**
 * Handle historical data retrieval
 */
function handleHistoricalData() {
    $dataFile = DATA_PATH . '/enrollment_data.txt';
    
    if (!file_exists($dataFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Historical data not found']);
        return;
    }
    
    $data = [];
    $headers = [];
    
    if (($handle = fopen($dataFile, "r")) !== FALSE) {
        $row = 0;
        while (($line = fgetcsv($handle)) !== FALSE) {
            if ($row === 0) {
                $headers = $line;
            } else {
                $record = [];
                foreach ($headers as $i => $header) {
                    $value = $line[$i] ?? null;
                    // Convert numeric strings to numbers
                    if (is_numeric($value)) {
                        $value = strpos($value, '.') !== false ? (float)$value : (int)$value;
                    }
                    $record[$header] = $value;
                }
                // Only add years 2018-2025
                if (isset($record['Year']) && $record['Year'] >= 2018 && $record['Year'] <= 2025) {
                    $data[] = $record;
                }
            }
            $row++;
        }
        fclose($handle);
    }
    echo json_encode([
        'success' => true,
        'count' => count($data),
        'data' => $data
    ]);
}

/**
 * Handle most/least enrolled analysis
 */
function handleAnalysis() {
    $input = $_GET;
    $year = $input['year'] ?? null;
    
    $dataFile = DATA_PATH . '/enrollment_data.txt';
    
    if (!file_exists($dataFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Historical data not found']);
        return;
    }
    
    $data = [];
    $headers = [];
    $gradeColumns = ['Nursery 1', 'Nursery 2', 'Kinder', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
    
    if (($handle = fopen($dataFile, "r")) !== FALSE) {
        $row = 0;
        while (($line = fgetcsv($handle)) !== FALSE) {
            if ($row === 0) {
                $headers = $line;
            } else {
                $record = [];
                foreach ($headers as $i => $header) {
                    $value = $line[$i] ?? null;
                    if (is_numeric($value)) {
                        $value = strpos($value, '.') !== false ? (float)$value : (int)$value;
                    }
                    $record[$header] = $value;
                }
                $data[] = $record;
            }
            $row++;
        }
        fclose($handle);
    }
    
    // Filter by year if specified
    if ($year) {
        $data = array_filter($data, function($row) use ($year) {
            return $row['Year'] == $year;
        });
    }
    
    // Analyze most and least enrolled per year
    $analysis = [];
    foreach ($data as $yearData) {
        $yearNum = $yearData['Year'];
        $gradeEnrollments = [];
        
        foreach ($gradeColumns as $grade) {
            if (isset($yearData[$grade])) {
                $gradeEnrollments[$grade] = $yearData[$grade];
            }
        }
        
        if (!empty($gradeEnrollments)) {
            arsort($gradeEnrollments);
            $grades = array_keys($gradeEnrollments);
            $values = array_values($gradeEnrollments);
            
            $analysis[] = [
                'year' => $yearNum,
                'most_enrolled' => [
                    'grade' => $grades[0],
                    'count' => $values[0]
                ],
                'least_enrolled' => [
                    'grade' => end($grades),
                    'count' => end($values)
                ],
                'total' => $yearData['TotalOverall'] ?? array_sum($gradeEnrollments),
                'payment' => $yearData['Total_Payment'] ?? 0,
                'grades' => $gradeEnrollments
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'count' => count($analysis),
        'analysis' => $analysis
    ]);
}

/**
 * Flask-compatible endpoint: /api/analysis/trends
 */
function handleAnalysisTrends() {
    $dataFile = DATA_PATH . '/enrollment_data.txt';
    if (!file_exists($dataFile)) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Historical data not found']);
        return;
    }

    $rows = [];
    if (($handle = fopen($dataFile, 'r')) !== FALSE) {
        $headers = fgetcsv($handle);
        while (($line = fgetcsv($handle)) !== FALSE) {
            $record = [];
            foreach ($headers as $i => $header) {
                $value = $line[$i] ?? null;
                if (is_numeric($value)) {
                    $value = strpos((string)$value, '.') !== false ? (float)$value : (int)$value;
                }
                $record[$header] = $value;
            }
            if (isset($record['Year']) && $record['Year'] >= 2018 && $record['Year'] <= 2025) {
                $rows[] = $record;
            }
        }
        fclose($handle);
    }

    if (count($rows) < 2) {
        echo json_encode(['status' => 'success', 'trends' => []]);
        return;
    }

    $grades = ['Nursery 1', 'Nursery 2', 'Kinder', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'TotalOverall'];
    $years = array_column($rows, 'Year');
    $trends = [];

    foreach ($grades as $grade) {
        $values = [];
        foreach ($rows as $row) {
            if (isset($row[$grade])) {
                $values[] = (float)$row[$grade];
            }
        }

        if (count($values) !== count($years) || count($values) < 2) {
            continue;
        }

        $slope = linearRegressionSlope($years, $values);
        $growthRates = [];
        for ($i = 1; $i < count($values); $i++) {
            if ($values[$i - 1] != 0) {
                $growthRates[] = (($values[$i] - $values[$i - 1]) / $values[$i - 1]) * 100;
            }
        }
        $avgGrowth = count($growthRates) ? array_sum($growthRates) / count($growthRates) : 0;

        $trends[] = [
            'grade' => $grade === 'TotalOverall' ? 'Total Overall' : $grade,
            'trend' => $slope > 0 ? 'increasing' : 'decreasing',
            'slope' => round($slope, 3),
            'avg_growth_rate' => round($avgGrowth, 2),
            'current_value' => (int)round($values[count($values) - 1]),
            'start_value' => (int)round($values[0])
        ];
    }

    echo json_encode([
        'status' => 'success',
        'trends' => $trends
    ]);
}

/**
 * Handle model metrics retrieval
 */
function handleMetrics() {
    $prophMetrics = MODELS_PATH . '/prophet_metrics.json';
    $dlMetrics = MODELS_PATH . '/dl_metrics.json';
    
    $result = [
        'prophet' => null,
        'deep_learning' => null
    ];
    
    if (file_exists($prophMetrics)) {
        $result['prophet'] = json_decode(file_get_contents($prophMetrics), true);
    }
    
    if (file_exists($dlMetrics)) {
        $result['deep_learning'] = json_decode(file_get_contents($dlMetrics), true);
    }
    
    echo json_encode([
        'success' => true,
        'metrics' => $result
    ]);
}

/**
 * Execute Python prediction script
 */
function executePythonScript($action, $params) {
    $scriptPath = __DIR__ . '/predictor.py';
    
    // Build JSON input
    $jsonInput = json_encode([
        'action' => $action,
        'params' => $params
    ]);
    
    $pythonCandidates = getPythonCandidates();
    $attemptErrors = [];

    foreach ($pythonCandidates as $pythonBin) {
        $run = executePythonOnce($pythonBin, $scriptPath, $jsonInput);
        if (!$run['started']) {
            $attemptErrors[] = $pythonBin . ': failed to start process';
            continue;
        }

        $output = trim(($run['stdout'] ?? '') . "\n" . ($run['stderr'] ?? ''));
        if ($output === '') {
            $attemptErrors[] = $pythonBin . ': no output';
            continue;
        }

        // Find JSON in output (in case there are warnings before/after JSON)
        if (preg_match('/\{.*\}/s', $output, $matches)) {
            $result = json_decode($matches[0], true);
            if ($result !== null) {
                return $result;
            }
        }

        // Try direct decode
        $result = json_decode($output, true);
        if ($result !== null) {
            return $result;
        }

        $attemptErrors[] = $pythonBin . ': ' . substr($output, 0, 250);
    }

    throw new Exception('Python execution failed. Tried [' . implode(', ', $pythonCandidates) . ']. Last errors: ' . implode(' | ', $attemptErrors));
}

/**
 * Get JSON input from request body
 */
function getJsonInput() {
    $input = file_get_contents('php://input');
    if (empty($input)) {
        return $_GET;
    }
    $data = json_decode($input, true);
    return $data ?? [];
}

/**
 * Convert predictor rows to frontend shape.
 */
function normalizeForecastRows($rows) {
    $normalized = [];
    foreach ($rows as $row) {
        $normalized[] = [
            'year' => (int)($row['year'] ?? 0),
            'prediction' => isset($row['prediction']) ? (float)$row['prediction'] : (float)($row['predicted'] ?? 0),
            'lower_bound' => isset($row['lower_bound']) ? (float)$row['lower_bound'] : (float)($row['lower'] ?? 0),
            'upper_bound' => isset($row['upper_bound']) ? (float)$row['upper_bound'] : (float)($row['upper'] ?? 0),
        ];
    }
    return $normalized;
}

/**
 * Least-squares slope of y over x.
 */
function linearRegressionSlope($x, $y) {
    $n = count($x);
    if ($n < 2) {
        return 0.0;
    }

    $sumX = array_sum($x);
    $sumY = array_sum($y);
    $sumXY = 0.0;
    $sumXX = 0.0;

    for ($i = 0; $i < $n; $i++) {
        $sumXY += ((float)$x[$i]) * ((float)$y[$i]);
        $sumXX += ((float)$x[$i]) * ((float)$x[$i]);
    }

    $den = ($n * $sumXX) - ($sumX * $sumX);
    if ($den == 0.0) {
        return 0.0;
    }

    return (($n * $sumXY) - ($sumX * $sumY)) / $den;
}

/**
 * Return Python command candidates for shared-host/VPS environments.
 */
function getPythonCandidates() {
    $candidates = [];

    $envPython = getenv('PREDICTIVE_PYTHON');
    if ($envPython) {
        $candidates[] = $envPython;
    }

    // Default + common Linux binaries
    $candidates[] = PYTHON_PATH;
    $candidates[] = 'python3';
    $candidates[] = '/usr/bin/python3';
    $candidates[] = '/usr/local/bin/python3';

    // If a virtualenv exists in/near the API folder, prefer it.
    $venvLocal = __DIR__ . '/venv/bin/python';
    $venvParent = dirname(__DIR__) . '/venv/bin/python';
    if (file_exists($venvLocal)) {
        $candidates[] = $venvLocal;
    }
    if (file_exists($venvParent)) {
        $candidates[] = $venvParent;
    }

    // Unique and non-empty
    $final = [];
    foreach ($candidates as $c) {
        $c = trim((string)$c);
        if ($c !== '' && !in_array($c, $final, true)) {
            $final[] = $c;
        }
    }
    return $final;
}

/**
 * Run predictor.py once with a specific Python binary.
 */
function executePythonOnce($pythonBin, $scriptPath, $jsonInput) {
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];

    $command = escapeshellcmd($pythonBin) . ' ' . escapeshellarg($scriptPath);
    $process = proc_open($command, $descriptors, $pipes, __DIR__);
    if (!is_resource($process)) {
        return ['started' => false, 'stdout' => '', 'stderr' => ''];
    }

    fwrite($pipes[0], $jsonInput);
    fclose($pipes[0]);

    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    proc_close($process);

    return ['started' => true, 'stdout' => $stdout ?: '', 'stderr' => $stderr ?: ''];
}
