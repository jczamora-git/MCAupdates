<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class UploadController extends Controller
{
    /**
     * Upload file to storage
     * Handles file uploads for learning materials and other resources
     * 
     * POST /api/upload/file
     * Accepts: $_FILES['file'], $_POST['folder'], $_POST['course_id'] (optional)
     * Returns: JSON with file_url and metadata
     */
    public function uploadFile()
    {
        header('Content-Type: application/json');
        
        try {
            // Check if file is uploaded
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No file uploaded or upload error occurred'
                ]);
                return;
            }

            // Get parameters
            $folder = $_POST['folder'] ?? 'general';
            $subjectId = $_POST['subject_id'] ?? null;

            // Validate file
            $file = $_FILES['file'];
            $fileInfo = pathinfo($file['name']);
            $extension = strtolower($fileInfo['extension'] ?? '');
            
            // Allowed file types for learning materials
            $allowedTypes = [
                'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 
                'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif',
                'mp4', 'mp3', 'zip', 'rar'
            ];

            if (!in_array($extension, $allowedTypes)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid file type. Allowed: ' . implode(', ', $allowedTypes)
                ]);
                return;
            }

            // Check file size (max 50MB)
            $maxFileSize = 50 * 1024 * 1024; // 50MB
            if ($file['size'] > $maxFileSize) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'File size exceeds maximum limit of 50MB'
                ]);
                return;
            }

            // Create upload directory path
            $uploadDir = ROOT_DIR . 'public/uploads/' . $folder . '/';
            if ($subjectId) {
                $uploadDir .= $subjectId . '/';
            }

            // Create directory if it doesn't exist
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            // Generate unique filename
            $uniqueId = uniqid();
            $timestamp = date('YmdHis');
            $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $fileInfo['filename']);
            $newFileName = $safeName . '_' . $timestamp . '_' . $uniqueId . '.' . $extension;
            $uploadPath = $uploadDir . $newFileName;

            // Move uploaded file
            if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to save file to server'
                ]);
                return;
            }

            // Generate public URL
            $relativePath = '/uploads/' . $folder . '/';
            if ($subjectId) {
                $relativePath .= $subjectId . '/';
            }
            $relativePath .= $newFileName;

            // Get base URL
            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $baseUrl = $protocol . '://' . $host;
            
            $fileUrl = $baseUrl . $relativePath;

            // Return success response
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'file_url' => $fileUrl,
                'file_name' => $file['name'],
                'file_size' => $file['size'],
                'file_type' => $file['type'],
                'extension' => $extension,
                'relative_path' => $relativePath
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Delete uploaded file
     * 
     * DELETE /api/upload/file
     * Accepts: JSON with file_path
     */
    public function deleteFile()
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $relativePath = $input['file_path'] ?? null;

            if (!$relativePath) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'File path is required'
                ]);
                return;
            }

            // Security: prevent directory traversal
            if (strpos($relativePath, '..') !== false) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid file path'
                ]);
                return;
            }

            // Construct full path
            $fullPath = ROOT_DIR . 'public' . $relativePath;

            // Check if file exists
            if (!file_exists($fullPath)) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'File not found'
                ]);
                return;
            }

            // Delete file
            if (unlink($fullPath)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'File deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete file'
                ]);
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
}
