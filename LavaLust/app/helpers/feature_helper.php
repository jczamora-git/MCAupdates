<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Feature Flag Helper Functions
 * 
 * Provides utility functions to check feature availability
 * and handle disabled feature requests.
 */

/**
 * Load feature configuration
 * 
 * @return array Feature flags
 */
function get_features() {
    static $features = null;
    
    if ($features === null) {
        $features = require APPPATH . 'config/features.php';
    }
    
    return $features;
}

/**
 * Check if a feature is enabled
 * 
 * @param string $feature_name Feature name from config
 * @return bool True if enabled
 */
function is_feature_enabled($feature_name) {
    $features = get_features();
    return isset($features[$feature_name]) && $features[$feature_name] === true;
}

/**
 * Require a feature to be enabled or return error response
 * Terminates script execution if feature is disabled
 * 
 * @param string $feature_name Feature name to check
 * @param string $custom_message Optional custom error message
 * @return void
 */
function require_feature($feature_name, $custom_message = null) {
    if (!is_feature_enabled($feature_name)) {
        // Ensure JSON headers are set
        if (function_exists('api_set_json_headers')) {
            api_set_json_headers();
        } else {
            header('Content-Type: application/json');
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
        }
        
        http_response_code(503); // Service Unavailable
        
        $message = $custom_message ?? 'This feature is currently unavailable';
        
        echo json_encode([
            'success' => false,
            'error' => $message,
            'feature' => $feature_name,
            'available' => false,
            'message' => 'Feature temporarily disabled. Please contact administrator for more information.'
        ]);
        
        exit;
    }
}

/**
 * Check if feature is enabled and return boolean (doesn't terminate)
 * Useful for conditional logic
 * 
 * @param string $feature_name Feature to check
 * @return bool True if enabled
 */
function check_feature($feature_name) {
    return is_feature_enabled($feature_name);
}

/**
 * Get all enabled features
 * 
 * @return array List of enabled feature names
 */
function get_enabled_features() {
    $features = get_features();
    return array_keys(array_filter($features, function($enabled) {
        return $enabled === true;
    }));
}

/**
 * Get all disabled features
 * 
 * @return array List of disabled feature names
 */
function get_disabled_features() {
    $features = get_features();
    return array_keys(array_filter($features, function($enabled) {
        return $enabled === false;
    }));
}

/**
 * Check if all specified features are enabled
 * 
 * @param array $feature_names Array of feature names
 * @return bool True if all are enabled
 */
function are_all_features_enabled($feature_names) {
    foreach ($feature_names as $feature) {
        if (!is_feature_enabled($feature)) {
            return false;
        }
    }
    return true;
}

/**
 * Check if any of specified features are enabled
 * 
 * @param array $feature_names Array of feature names
 * @return bool True if any is enabled
 */
function is_any_feature_enabled($feature_names) {
    foreach ($feature_names as $feature) {
        if (is_feature_enabled($feature)) {
            return true;
        }
    }
    return false;
}

/**
 * Return feature status information (for debugging/admin panel)
 * 
 * @return array Feature status details
 */
function get_feature_status() {
    $features = get_features();
    $status = [
        'total' => count($features),
        'enabled' => count(array_filter($features)),
        'disabled' => count($features) - count(array_filter($features)),
        'features' => $features
    ];
    
    return $status;
}

/**
 * Environment-based feature override (optional)
 * Allows enabling features via environment variables
 * 
 * @param string $feature_name Feature to check
 * @return bool|null Override value or null if not set
 */
function get_feature_env_override($feature_name) {
    $env_key = 'FEATURE_' . strtoupper($feature_name);
    $env_value = getenv($env_key);
    
    if ($env_value === false) {
        return null;
    }
    
    return filter_var($env_value, FILTER_VALIDATE_BOOLEAN);
}

/**
 * Get final feature state with environment overrides
 * 
 * @param string $feature_name Feature name
 * @return bool Final enabled state
 */
function get_final_feature_state($feature_name) {
    $override = get_feature_env_override($feature_name);
    
    if ($override !== null) {
        return $override;
    }
    
    return is_feature_enabled($feature_name);
}
