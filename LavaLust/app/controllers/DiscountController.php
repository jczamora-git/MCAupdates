<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class DiscountController extends Controller {

    public function __construct() {
        parent::__construct();
        $this->call->model('Discount_model');
    }

    public function api_discount_templates_get() {
        try {
            $templates = $this->Discount_model->get_all_templates();
            echo json_encode(['success' => true, 'data' => $templates]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_discount_templates_create() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validation
            if (empty($data['name']) || !isset($data['value'])) {
                echo json_encode(['success' => false, 'message' => 'Missing required fields']);
                return;
            }

            $id = $this->Discount_model->create_template($data);
            
            if ($id) {
                echo json_encode(['success' => true, 'message' => 'Discount template created', 'id' => $id]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to create template']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_discount_templates_update($id) {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $result = $this->Discount_model->update_template($id, $data);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Discount template updated']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to update template']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_discount_templates_delete($id) {
        try {
            // Soft delete or hard delete? Let's check if used.
            // For now, simple delete or toggle active.
            // User likely wants delete for management.
            $result = $this->Discount_model->delete_template($id);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Discount template deleted']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to delete template']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_discount_templates_toggle($id) {
         try {
            $data = json_decode(file_get_contents('php://input'), true);
            // expect is_active in body or just toggle
            // easier to just toggle current state
            $result = $this->Discount_model->toggle_template_status($id);
             if ($result) {
                echo json_encode(['success' => true, 'message' => 'Discount template status updated']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to update status']);
            }
         } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
