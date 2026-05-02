<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * File Upload Helper for Proof of Payment
 * Handles secure file uploads for payment verification
 */

/**
 * Upload proof of payment file
 *
 * @param string $field_name The name of the file input field
 * @param array $config Configuration options
 * @return array Upload result with success status and file info
 */
function upload_proof_of_payment($field_name = 'proof_of_payment', $config = [])
{
    // Default configuration
    $default_config = [
        'upload_path' => ROOT_DIR . 'public/uploads/payments/',
        'allowed_types' => ['jpg', 'jpeg', 'png', 'pdf'],
        'max_size' => 5 * 1024 * 1024, // 5MB
        'encrypt_name' => true,
        'folder_structure' => 'year_month' // Organize by year/month
    ];

    $config = array_merge($default_config, $config);

    // Check if file was uploaded
    if (!isset($_FILES[$field_name]) || $_FILES[$field_name]['error'] !== UPLOAD_ERR_OK) {
        return [
            'success' => false,
            'message' => 'No file uploaded or upload error occurred',
            'error_code' => $_FILES[$field_name]['error'] ?? UPLOAD_ERR_NO_FILE
        ];
    }

    $file = $_FILES[$field_name];
    $file_info = pathinfo($file['name']);
    $extension = strtolower($file_info['extension'] ?? '');

    // Validate file extension
    if (!in_array($extension, $config['allowed_types'])) {
        return [
            'success' => false,
            'message' => 'Invalid file type. Allowed: ' . implode(', ', $config['allowed_types']),
            'file_type' => $extension
        ];
    }

    // Validate file size
    if ($file['size'] > $config['max_size']) {
        $max_size_mb = $config['max_size'] / (1024 * 1024);
        return [
            'success' => false,
            'message' => "File size exceeds maximum limit of {$max_size_mb}MB",
            'file_size' => $file['size'],
            'max_size' => $config['max_size']
        ];
    }

    // Validate file content (basic check for images)
    if (in_array($extension, ['jpg', 'jpeg', 'png'])) {
        $image_info = getimagesize($file['tmp_name']);
        if (!$image_info) {
            return [
                'success' => false,
                'message' => 'Invalid image file',
                'file_type' => $extension
            ];
        }
    }

    // Create upload directory with folder structure
    $upload_dir = $config['upload_path'];
    if ($config['folder_structure'] === 'year_month') {
        $upload_dir .= date('Y') . '/' . date('m') . '/';
    }

    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    // Generate unique filename
    if ($config['encrypt_name']) {
        $unique_id = uniqid();
        $timestamp = date('YmdHis');
        $safe_name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $file_info['filename']);
        $new_filename = $safe_name . '_' . $timestamp . '_' . $unique_id . '.' . $extension;
    } else {
        $new_filename = $file['name'];
    }

    $upload_path = $upload_dir . $new_filename;

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $upload_path)) {
        return [
            'success' => false,
            'message' => 'Failed to save file to server',
            'upload_path' => $upload_path
        ];
    }

    // Generate public URL
    $relative_path = str_replace(ROOT_DIR . 'public/', '', $upload_path);

    // Get base URL
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $base_url = $protocol . '://' . $host;

    $file_url = $base_url . '/' . $relative_path;

    return [
        'success' => true,
        'message' => 'File uploaded successfully',
        'file_url' => $file_url,
        'file_name' => $file['name'],
        'file_size' => $file['size'],
        'file_type' => $file['type'],
        'extension' => $extension,
        'relative_path' => $relative_path,
        'upload_path' => $upload_path
    ];
}

/**
 * Delete proof of payment file
 *
 * @param string $file_path Relative path to the file
 * @return array Delete result
 */
function delete_proof_of_payment($file_path)
{
    // Security: prevent directory traversal
    if (strpos($file_path, '..') !== false) {
        return [
            'success' => false,
            'message' => 'Invalid file path'
        ];
    }

    // Construct full path
    $full_path = ROOT_DIR . 'public/' . $file_path;

    // Check if file exists
    if (!file_exists($full_path)) {
        return [
            'success' => false,
            'message' => 'File not found',
            'file_path' => $file_path
        ];
    }

    // Delete file
    if (unlink($full_path)) {
        return [
            'success' => true,
            'message' => 'File deleted successfully',
            'file_path' => $file_path
        ];
    } else {
        return [
            'success' => false,
            'message' => 'Failed to delete file',
            'file_path' => $file_path
        ];
    }
}

/**
 * Get file information for proof of payment
 *
 * @param string $file_path Relative path to the file
 * @return array File information
 */
function get_proof_of_payment_info($file_path)
{
    // Security: prevent directory traversal
    if (strpos($file_path, '..') !== false) {
        return [
            'success' => false,
            'message' => 'Invalid file path'
        ];
    }

    $full_path = ROOT_DIR . 'public/' . $file_path;

    if (!file_exists($full_path)) {
        return [
            'success' => false,
            'message' => 'File not found',
            'file_path' => $file_path
        ];
    }

    $file_info = pathinfo($full_path);
    $file_size = filesize($full_path);
    $mime_type = mime_content_type($full_path);

    return [
        'success' => true,
        'file_name' => $file_info['basename'],
        'file_size' => $file_size,
        'file_size_formatted' => format_file_size($file_size),
        'mime_type' => $mime_type,
        'extension' => strtolower($file_info['extension'] ?? ''),
        'last_modified' => date('Y-m-d H:i:s', filemtime($full_path)),
        'file_path' => $file_path
    ];
}

/**
 * Format file size in human readable format
 *
 * @param int $bytes File size in bytes
 * @return string Formatted file size
 */
function format_file_size($bytes)
{
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);

    return round($bytes, 2) . ' ' . $units[$pow];
}

/**
 * Validate proof of payment file before upload
 *
 * @param string $field_name The name of the file input field
 * @return array Validation result
 */
function validate_proof_of_payment_file($field_name = 'proof_of_payment')
{
    if (!isset($_FILES[$field_name])) {
        return [
            'valid' => false,
            'message' => 'No file provided'
        ];
    }

    $file = $_FILES[$field_name];

    // Check for upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $error_messages = [
            UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize directive',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE directive',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
        ];

        return [
            'valid' => false,
            'message' => $error_messages[$file['error']] ?? 'Unknown upload error',
            'error_code' => $file['error']
        ];
    }

    // Basic validation passed
    return [
        'valid' => true,
        'file_name' => $file['name'],
        'file_size' => $file['size'],
        'file_type' => $file['type']
    ];
}