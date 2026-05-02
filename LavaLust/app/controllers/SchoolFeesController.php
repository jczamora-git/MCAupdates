<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * SchoolFeesController - Manage school fees catalog
 * Handles fee templates/pricing for different grade levels
 */
class SchoolFeesController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('SchoolFeesModel');
    }

    /**
     * Get all school fees with optional filters
     * GET /api/school-fees?year_level=Grade 1&fee_type=Tuition&is_active=1
     */
    public function api_get_fees()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $filters = [];
            
            // Removed academic_period_id filter - fees are now reusable
            if (!empty($_GET['year_level'])) {
                $filters['year_level'] = $_GET['year_level'];
            }
            if (!empty($_GET['fee_type'])) {
                $filters['fee_type'] = $_GET['fee_type'];
            }
            if (isset($_GET['is_active'])) {
                $filters['is_active'] = $_GET['is_active'];
            }
            if (isset($_GET['is_required'])) {
                $filters['is_required'] = $_GET['is_required'];
            }

            $fees = $this->SchoolFeesModel->get_all($filters);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $fees,
                'count' => is_array($fees) ? count($fees) : 0
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
     * Get single school fee by ID
     * GET /api/school-fees/{id}
     */
    public function api_get_fee($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $fee = $this->SchoolFeesModel->get_fee($id);

            if (!$fee) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Fee not found'
                ]);
                return;
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $fee
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
     * Create new school fee
     * POST /api/school-fees
     */
    public function api_create_fee()
    {
        api_set_json_headers();

        // Check admin authorization
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Admin access required'
            ]);
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            if (empty($input['fee_name']) || empty($input['fee_type']) || !isset($input['amount'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Fee name, fee type, and amount are required'
                ]);
                return;
            }

            // Handle year_levels array
            $year_levels = isset($input['year_levels']) ? $input['year_levels'] : [];
            
            // Set defaults
            if (!isset($input['is_required'])) {
                $input['is_required'] = 0;
            }
            if (!isset($input['is_active'])) {
                $input['is_active'] = 1;
            }

            // Remove academic_period_id if provided (fees are reusable now)
            unset($input['academic_period_id']);

            // If year_levels includes "All Grades" or is empty, create single fee for all grades
            if (empty($year_levels) || in_array('All Grades', $year_levels)) {
                $input['year_level'] = null;
                $fee_id = $this->SchoolFeesModel->create($input);

                if ($fee_id) {
                    $fee = $this->SchoolFeesModel->get_fee($fee_id);
                    http_response_code(201);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Fee created successfully',
                        'data' => $fee
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to create fee'
                    ]);
                }
            } else {
                // Create individual fee records for each selected year level
                $created_fees = [];
                foreach ($year_levels as $year_level) {
                    $fee_data = $input;
                    $fee_data['year_level'] = $year_level;
                    $fee_id = $this->SchoolFeesModel->create($fee_data);
                    if ($fee_id) {
                        $created_fees[] = $this->SchoolFeesModel->get_fee($fee_id);
                    }
                }

                if (count($created_fees) > 0) {
                    http_response_code(201);
                    echo json_encode([
                        'success' => true,
                        'message' => count($created_fees) . ' fee(s) created successfully',
                        'data' => $created_fees
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to create fees'
                    ]);
                }
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
     * Update school fee
     * PUT /api/school-fees/{id}
     */
    public function api_update_fee($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Admin access required'
            ]);
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $year_levels = isset($input['year_levels']) ? $input['year_levels'] : [];

            // Get the existing fee to check current state
            $existing_fee = $this->SchoolFeesModel->get_fee($id);
            if (!$existing_fee) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Fee not found'
                ]);
                return;
            }

            // Check if converting from All Grades to specific grades (multiple)
            $isAllGrades = empty($existing_fee['year_level']);
            $hasMultipleSpecificGrades = !empty($year_levels) && 
                                         !in_array('All Grades', $year_levels) && 
                                         count($year_levels) > 1;

            if ($isAllGrades && $hasMultipleSpecificGrades) {
                // Business logic: Create new records for each grade, deactivate original
                $created_fees = [];
                foreach ($year_levels as $year_level) {
                    $fee_data = [
                        'academic_period_id' => $input['academic_period_id'] ?? $existing_fee['academic_period_id'],
                        'year_level' => $year_level,
                        'fee_type' => $input['fee_type'] ?? $existing_fee['fee_type'],
                        'fee_name' => $input['fee_name'] ?? $existing_fee['fee_name'],
                        'amount' => $input['amount'] ?? $existing_fee['amount'],
                        'is_required' => $input['is_required'] ?? $existing_fee['is_required'],
                        'is_active' => $input['is_active'] ?? $existing_fee['is_active'],
                        'due_date' => $input['due_date'] ?? $existing_fee['due_date'],
                        'description' => $input['description'] ?? $existing_fee['description']
                    ];
                    $fee_id = $this->SchoolFeesModel->create($fee_data);
                    if ($fee_id) {
                        $created_fees[] = $this->SchoolFeesModel->get_fee($fee_id);
                    }
                }

                // Deactivate the original "All Grades" fee
                $this->SchoolFeesModel->update($id, ['is_active' => 0]);

                if (count($created_fees) > 0) {
                    http_response_code(200);
                    echo json_encode([
                        'success' => true,
                        'message' => count($created_fees) . ' individual fee(s) created, original fee deactivated',
                        'data' => $created_fees
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to create individual fees'
                    ]);
                }
            } else {
                // Standard update logic
                if (isset($input['year_levels'])) {
                    if (empty($year_levels) || in_array('All Grades', $year_levels)) {
                        $input['year_level'] = null;
                    } else {
                        $input['year_level'] = $year_levels[0];
                    }
                }

                $updated = $this->SchoolFeesModel->update($id, $input);

                if ($updated) {
                    $fee = $this->SchoolFeesModel->get_fee($id);
                    http_response_code(200);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Fee updated successfully',
                        'data' => $fee
                    ]);
                } else {
                    http_response_code(404);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Fee not found or no changes made'
                    ]);
                }
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
     * Delete school fee
     * DELETE /api/school-fees/{id}
     */
    public function api_delete_fee($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Admin access required'
            ]);
            return;
        }

        try {
            $deleted = $this->SchoolFeesModel->delete($id);

            if ($deleted) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Fee deleted successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Fee not found'
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
     * Toggle fee active status
     * PATCH /api/school-fees/{id}/toggle-status
     */
    public function api_toggle_status($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Admin access required'
            ]);
            return;
        }

        try {
            $fee = $this->SchoolFeesModel->get_fee($id);
            
            if (!$fee) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Fee not found'
                ]);
                return;
            }

            $newStatus = $fee['is_active'] ? 0 : 1;
            $this->SchoolFeesModel->update($id, ['is_active' => $newStatus]);

            $updatedFee = $this->SchoolFeesModel->get_fee($id);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Fee status updated successfully',
                'data' => $updatedFee
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
     * Get fees for a specific student based on their year level
     * GET /api/school-fees/student/{student_id}
     */
    public function api_get_student_fees($student_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $this->call->model('StudentModel');
            $student = $this->StudentModel->get_student($student_id);

            if (!$student) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student not found'
                ]);
                return;
            }

            $fees = $this->SchoolFeesModel->get_fees_for_year_level($student['year_level']);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $fees,
                'student' => [
                    'id' => $student['id'],
                    'name' => $student['first_name'] . ' ' . $student['last_name'],
                    'year_level' => $student['year_level']
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
}
