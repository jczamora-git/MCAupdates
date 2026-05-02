<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Payment Schedule Template Controller
 * Handles payment schedule template CRUD operations
 */
class PaymentScheduleTemplateController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('PaymentScheduleTemplateModel');
    }

    private function is_admin()
    {
        return $this->session->userdata('logged_in') === true && 
               $this->session->userdata('role') === 'admin';
    }

    private function is_logged_in()
    {
        return $this->session->userdata('logged_in') === true;
    }

    /**
     * Get all payment schedule templates
     * GET /api/payment-schedule-templates
     * Accessible to all authenticated users (students, enrollees, admin)
     * Non-admin users only see active templates
     */
    public function get_templates()
    {
        api_set_json_headers();

        // Allow any authenticated user to view templates
        if (!$this->is_logged_in()) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            return;
        }

        try {
            $filters = [];
            
            // For non-admin users, only show active templates
            if (!$this->is_admin()) {
                $filters['status'] = 'active';
            } else {
                // Admin can filter by status if provided
                if (!empty($_GET['status'])) {
                    $filters['status'] = $_GET['status'];
                }
            }
            
            if (!empty($_GET['schedule_type'])) {
                $filters['schedule_type'] = $_GET['schedule_type'];
            }

            $templates = $this->PaymentScheduleTemplateModel->get_all($filters);

            echo json_encode([
                'success' => true,
                'data' => $templates
            ]);
        } catch (Exception $e) {
            error_log('Get templates error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching templates: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get single payment schedule template by ID
     * GET /api/payment-schedule-templates/{id}
     * Accessible to all authenticated users
     */
    public function get_template($id)
    {
        api_set_json_headers();

        // Allow any authenticated user to view template details
        if (!$this->is_logged_in()) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            return;
        }

        try {
            $template = $this->PaymentScheduleTemplateModel->get_by_id($id);

            if (!$template) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Template not found'
                ]);
                return;
            }

            // Non-admin users can only view active templates
            if (!$this->is_admin() && $template['status'] !== 'active') {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Template not found'
                ]);
                return;
            }

            echo json_encode([
                'success' => true,
                'data' => $template
            ]);
        } catch (Exception $e) {
            error_log('Get template error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching template'
            ]);
        }
    }

    /**
     * Create new payment schedule template with installments
     * POST /api/payment-schedule-templates
     * 
     * Expected payload:
     * {
     *   "name": "Standard Monthly Plan",
     *   "description": "Monthly payment schedule",
     *   "schedule_type": "Monthly",
     *   "number_of_installments": 10,
     *   "installments": [
     *     { "installment_number": 1, "month": null, "week_of_month": "Upon Enrollment", "label": "Upon Enrollment" },
     *     { "installment_number": 2, "month": "08", "week_of_month": "2nd week", "label": "August - 2nd week" },
     *     ...
     *   ]
     * }
     */
    public function create_template()
    {
        api_set_json_headers();

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true) ?? [];

            // Validation
            if (empty($data['name'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Template name is required']);
                return;
            }

            if (empty($data['schedule_type'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Schedule type is required']);
                return;
            }

            if (empty($data['number_of_installments']) || !is_numeric($data['number_of_installments'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Valid number of installments is required']);
                return;
            }

            if (empty($data['installments']) || !is_array($data['installments'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Installments array is required']);
                return;
            }

            // Create template with installments
            $template_id = $this->PaymentScheduleTemplateModel->create($data);

            if ($template_id) {
                // Get created template with installments
                $template = $this->PaymentScheduleTemplateModel->get_by_id($template_id);

                echo json_encode([
                    'success' => true,
                    'message' => 'Template created successfully',
                    'data' => $template
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create template'
                ]);
            }
        } catch (Exception $e) {
            error_log('Create template error: ' . $e->getMessage());
            error_log('Create template trace: ' . $e->getTraceAsString());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error creating template: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update payment schedule template
     * PUT /api/payment-schedule-templates/{id}
     */
    public function update_template($id)
    {
        api_set_json_headers();

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true) ?? [];

            $result = $this->PaymentScheduleTemplateModel->update($id, $data);

            if ($result) {
                $template = $this->PaymentScheduleTemplateModel->get_by_id($id);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Template updated successfully',
                    'data' => $template
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update template'
                ]);
            }
        } catch (Exception $e) {
            error_log('Update template error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error updating template: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Toggle template status (active/inactive)
     * PUT /api/payment-schedule-templates/{id}/toggle-status
     */
    public function toggle_status($id)
    {
        api_set_json_headers();

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            $result = $this->PaymentScheduleTemplateModel->toggle_status($id);

            if ($result) {
                $template = $this->PaymentScheduleTemplateModel->get_by_id($id);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Template status updated',
                    'data' => $template
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to toggle status'
                ]);
            }
        } catch (Exception $e) {
            error_log('Toggle status error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error toggling status'
            ]);
        }
    }

    /**
     * Delete payment schedule template
     * DELETE /api/payment-schedule-templates/{id}
     */
    public function delete_template($id)
    {
        api_set_json_headers();

        if (!$this->is_admin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin only.']);
            return;
        }

        try {
            // Check if template is in use
            $in_use = $this->PaymentScheduleTemplateModel->is_template_in_use($id);
            
            if ($in_use) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Cannot delete template that is currently in use. Set it to inactive instead.'
                ]);
                return;
            }

            $result = $this->PaymentScheduleTemplateModel->delete($id);

            if ($result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Template deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete template'
                ]);
            }
        } catch (Exception $e) {
            error_log('Delete template error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error deleting template'
            ]);
        }
    }
}
