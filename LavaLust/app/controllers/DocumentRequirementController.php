<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class DocumentRequirementController extends Controller {

    public function __construct() {
        parent::__construct();
        $this->call->model('DocumentRequirement_model');
    }

    /**
     * Get all document requirements
     * GET /api/admin/document-requirements
     */
    public function api_get_all() {
        header('Content-Type: application/json');
        
        try {
            $requirements = $this->DocumentRequirement_model->get_all_requirements();
            
            echo json_encode([
                'success' => true,
                'data' => $requirements
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch requirements: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get requirements for specific grade level and enrollment type
     * GET /api/document-requirements/:gradeLevel/:enrollmentType
     */
    public function api_get_by_criteria($gradeLevel = null, $enrollmentType = null) {
        header('Content-Type: application/json');

        $gradeLevel = $gradeLevel !== null ? urldecode($gradeLevel) : null;
        $enrollmentType = $enrollmentType !== null ? urldecode($enrollmentType) : null;

        if ($enrollmentType === null && $gradeLevel !== null && strpos($gradeLevel, '/') !== false) {
            $parts = explode('/', $gradeLevel, 2);
            $gradeLevel = urldecode($parts[0]);
            $enrollmentType = isset($parts[1]) ? urldecode($parts[1]) : null;
        }
        
        if (!$gradeLevel) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Grade level is required'
            ]);
            return;
        }

        try {
            $requirements = $this->DocumentRequirement_model->get_requirements_by_criteria(
                $gradeLevel,
                $enrollmentType
            );

            echo json_encode([
                'success' => true,
                'data' => $requirements
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch requirements: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get requirements for enrollment step using resilient matching
     * GET /api/document-requirements-enrollment/:gradeLevel/:enrollmentType
     */
    public function api_get_for_enrollment($gradeLevel = null, $enrollmentType = null) {
        header('Content-Type: application/json');

        $gradeLevel = $gradeLevel !== null ? urldecode($gradeLevel) : null;
        $enrollmentType = $enrollmentType !== null ? urldecode($enrollmentType) : null;

        if ($enrollmentType === null && $gradeLevel !== null && strpos($gradeLevel, '/') !== false) {
            $parts = explode('/', $gradeLevel, 2);
            $gradeLevel = urldecode($parts[0]);
            $enrollmentType = isset($parts[1]) ? urldecode($parts[1]) : null;
        }

        if (!$gradeLevel) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Grade level is required'
            ]);
            return;
        }

        try {
            $result = $this->DocumentRequirement_model->get_requirements_for_enrollment($gradeLevel, $enrollmentType);

            echo json_encode([
                'success' => true,
                'data' => $result
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch enrollment requirements: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Create reusable document in catalog only
     * POST /api/admin/document-catalog
     */
    public function api_create_catalog() {
        header('Content-Type: application/json');

        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['document_name'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Document name is required'
            ]);
            return;
        }

        try {
            $id = $this->DocumentRequirement_model->create_catalog_document([
                'document_name' => $input['document_name'],
                'description' => $input['description'] ?? null,
                'is_active' => $input['is_active'] ?? true
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Document created in catalog successfully',
                'data' => ['id' => $id]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to create document: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get reusable documents in catalog
     * GET /api/admin/document-catalog
     */
    public function api_get_catalog() {
        header('Content-Type: application/json');

        try {
            $activeOnly = isset($_GET['active_only'])
                ? ($_GET['active_only'] === '1' || strtolower($_GET['active_only']) === 'true')
                : false;

            $documents = $this->DocumentRequirement_model->get_catalog_documents($activeOnly);

            echo json_encode([
                'success' => true,
                'data' => $documents
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch document catalog: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update reusable document in catalog
     * PUT /api/admin/document-catalog/:id
     */
    public function api_update_catalog($id) {
        header('Content-Type: application/json');

        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Document ID is required'
            ]);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);

        try {
            $updated = $this->DocumentRequirement_model->update_catalog_document($id, [
                'name' => $input['name'] ?? null,
                'description' => array_key_exists('description', $input ?? []) ? $input['description'] : null,
                'is_active' => $input['is_active'] ?? null
            ]);

            if ($updated) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document updated successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Document not found'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update document: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Toggle active status for catalog document
     * PATCH /api/admin/document-catalog/:id/toggle
     */
    public function api_toggle_catalog($id) {
        header('Content-Type: application/json');

        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Document ID is required'
            ]);
            return;
        }

        try {
            $toggled = $this->DocumentRequirement_model->toggle_catalog_document($id);
            if ($toggled) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document status toggled successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Document not found'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to toggle document: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Create new document requirement
     * POST /api/admin/document-requirements
     */
    public function api_create() {
        header('Content-Type: application/json');
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validation
        if (empty($input['grade_level']) || empty($input['document_name'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Grade level and document name are required'
            ]);
            return;
        }

        try {
            $data = [
                'grade_level' => $input['grade_level'],
                'enrollment_type' => $input['enrollment_type'] ?? null,
                'document_name' => $input['document_name'],
                'is_required' => $input['is_required'] ?? true,
                'display_order' => $input['display_order'] ?? 0,
                'description' => $input['description'] ?? null,
                'is_active' => $input['is_active'] ?? true
            ];

            $id = $this->DocumentRequirement_model->create_requirement($data);
            
            echo json_encode([
                'success' => true,
                'message' => 'Document requirement created successfully',
                'data' => ['id' => $id]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to create requirement: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update document requirement
     * PUT /api/admin/document-requirements/:id
     */
    public function api_update($id) {
        header('Content-Type: application/json');
        
        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Requirement ID is required'
            ]);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        
        try {
            $data = [];
            
            if (isset($input['grade_level'])) $data['grade_level'] = $input['grade_level'];
            if (isset($input['enrollment_type'])) $data['enrollment_type'] = $input['enrollment_type'];
            if (isset($input['document_name'])) $data['document_name'] = $input['document_name'];
            if (isset($input['is_required'])) $data['is_required'] = $input['is_required'];
            if (isset($input['display_order'])) $data['display_order'] = $input['display_order'];
            if (isset($input['description'])) $data['description'] = $input['description'];
            if (isset($input['is_active'])) $data['is_active'] = $input['is_active'];

            $updated = $this->DocumentRequirement_model->update_requirement($id, $data);
            
            if ($updated) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document requirement updated successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Requirement not found'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update requirement: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Delete document requirement
     * DELETE /api/admin/document-requirements/:id
     */
    public function api_delete($id) {
        header('Content-Type: application/json');
        
        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Requirement ID is required'
            ]);
            return;
        }

        try {
            $deleted = $this->DocumentRequirement_model->delete_requirement($id);
            
            if ($deleted) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document requirement deleted successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Requirement not found'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to delete requirement: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Toggle active status
     * PATCH /api/admin/document-requirements/:id/toggle
     */
    public function api_toggle_active($id) {
        header('Content-Type: application/json');
        
        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Requirement ID is required'
            ]);
            return;
        }

        try {
            $toggled = $this->DocumentRequirement_model->toggle_active($id);
            
            if ($toggled) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Status toggled successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Requirement not found'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to toggle status: ' . $e->getMessage()
            ]);
        }
    }
}
?>
