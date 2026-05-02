<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class LearningMaterialsController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('LearningMaterials_model');
    }

    /**
     * Create new learning material
     * 
     * POST /api/learning-materials
     * Accepts: JSON with course_id, section_id, type, title, description, file_url, file_name, file_size, link_url, created_by
     */
    public function create()
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            $required = ['subject_id', 'type', 'title', 'created_by'];
            foreach ($required as $field) {
                if (!isset($input[$field]) || empty($input[$field])) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => "Missing required field: $field"
                    ]);
                    return;
                }
            }

            // Validate type
            $validTypes = ['text', 'file', 'link'];
            if (!in_array($input['type'], $validTypes)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid type. Must be: text, file, or link'
                ]);
                return;
            }

            // Type-specific validation
            if ($input['type'] === 'file' && empty($input['file_url'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'file_url is required for file type'
                ]);
                return;
            }

            if ($input['type'] === 'link' && empty($input['link_url'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'link_url is required for link type'
                ]);
                return;
            }

            // Prepare data
            $data = [
                'subject_id'  => $input['subject_id'],
                'section_id'  => $input['section_id'] ?? null,
                'school_year' => $input['school_year'] ?? null,
                'type'        => $input['type'],
                'title'       => $input['title'],
                'description' => $input['description'] ?? null,
                'file_url'    => $input['file_url'] ?? null,
                'file_name'   => $input['file_name'] ?? null,
                'file_size'   => $input['file_size'] ?? null,
                'link_url'    => $input['link_url'] ?? null,
                'created_by'  => $input['created_by'],
                'created_at'  => app_now()
            ];

            // Create learning material
            $materialId = $this->LearningMaterials_model->create($data);

            if ($materialId) {
                // Get the created material
                $material = $this->LearningMaterials_model->getById($materialId);
                
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Learning material created successfully',
                    'data' => $material
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create learning material'
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

    /**
     * Get learning materials by subject and section
     * 
     * GET /api/learning-materials/subject/{subject_id}
     * Required query params: section_id
     */
    public function getBySubject($subjectId)
    {
        header('Content-Type: application/json');
        
        try {
            $sectionId  = $_GET['section_id']  ?? null;
            $schoolYear = $_GET['school_year'] ?? null;

            $materials = $this->LearningMaterials_model->getBySubject($subjectId, $sectionId, $schoolYear);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $materials
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
     * Get single learning material by ID
     * 
     * GET /api/learning-materials/{id}
     */
    public function getById($id)
    {
        header('Content-Type: application/json');
        
        try {
            $material = $this->LearningMaterials_model->getById($id);

            if ($material) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => $material
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Learning material not found'
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

    /**
     * Update learning material
     * 
     * PUT /api/learning-materials/{id}
     */
    public function update($id)
    {
        header('Content-Type: application/json');
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);

            // Check if material exists
            $existing = $this->LearningMaterials_model->getById($id);
            if (!$existing) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Learning material not found'
                ]);
                return;
            }

            // Prepare update data
            $data = [
                'title' => $input['title'] ?? $existing['title'],
                'description' => $input['description'] ?? $existing['description'],
                'file_url' => $input['file_url'] ?? $existing['file_url'],
                'file_name' => $input['file_name'] ?? $existing['file_name'],
                'file_size' => $input['file_size'] ?? $existing['file_size'],
                'link_url' => $input['link_url'] ?? $existing['link_url'],
                'updated_at' => app_now()
            ];

            // Update learning material
            $success = $this->LearningMaterials_model->update($id, $data);

            if ($success) {
                $material = $this->LearningMaterials_model->getById($id);
                
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Learning material updated successfully',
                    'data' => $material
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update learning material'
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

    /**
     * Delete learning material
     * 
     * DELETE /api/learning-materials/{id}
     */
    public function delete($id)
    {
        header('Content-Type: application/json');
        
        try {
            // Get material to delete associated file
            $material = $this->LearningMaterials_model->getById($id);
            
            if (!$material) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Learning material not found'
                ]);
                return;
            }

            // Delete associated file if exists
            if ($material['type'] === 'file' && !empty($material['file_url'])) {
                // Extract relative path from URL
                $parsedUrl = parse_url($material['file_url']);
                $relativePath = $parsedUrl['path'] ?? '';
                
                if (!empty($relativePath)) {
                    $fullPath = ROOT_DIR . 'public' . $relativePath;
                    if (file_exists($fullPath)) {
                        unlink($fullPath);
                    }
                }
            }

            // Delete learning material record
            $success = $this->LearningMaterials_model->delete($id);

            if ($success) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Learning material deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete learning material'
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
