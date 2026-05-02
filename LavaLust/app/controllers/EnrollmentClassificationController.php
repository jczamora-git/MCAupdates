<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * EnrollmentClassificationController
 * Classifies students based on enrollment type and history
 * Determines whether student should use auto-enrollment or go to form
 */
class EnrollmentClassificationController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('EnrollmentModel');
        $this->call->model('AcademicPeriodModel');
    }

    /**
     * Classify student and determine enrollment action
     * POST /api/enrollments/classify-student
     * 
     * Expected input:
     * {
     *   "enrollment_type": "Continuing Student|Returning Student|New Student|Transferee",
     *   "student_id": "user_id"
     * }
     * 
     * Response:
     * {
     *   "success": true,
     *   "classification": "first_timer|returning|continuing_with_records",
     *   "action": "go_to_form|auto_generate",
     *   "has_approved_enrollment": true/false,
     *   "latest_enrollment": {...}, // if continuing with records
     *   "preview_data": {...} // if auto_generate
     * }
     */
    public function api_classify_student()
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
            $input = json_decode(file_get_contents('php://input'), true);

            $enrollment_type = $input['enrollment_type'] ?? null;
            $student_id = $input['student_id'] ?? null;

            if (!$enrollment_type || !$student_id) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'enrollment_type and student_id are required'
                ]);
                return;
            }

            // Get active enrollment period
            $active_period = $this->AcademicPeriodModel->get_active_period();
            if (!$active_period) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No active enrollment period'
                ]);
                return;
            }

            // Get all student's approved enrollments (excluding current period)
            // We check both created_user_id and created_student_id because the frontend passes user.id as student_id
            $approved_enrollments = $this->EnrollmentModel->get_all([
                'created_user_id' => $student_id,
                'status' => 'Approved'
            ]);

            if (empty($approved_enrollments)) {
                $approved_enrollments = $this->EnrollmentModel->get_all([
                    'created_student_id' => $student_id,
                    'status' => 'Approved'
                ]);
            }

            $has_approved_enrollment = !empty($approved_enrollments);
            $latest_enrollment = $has_approved_enrollment ? $approved_enrollments[0] : null;

            // Determine classification and action
            $classification = $this->classify_enrollment($enrollment_type, $has_approved_enrollment);
            $action = $this->determine_action($enrollment_type, $has_approved_enrollment);

            $response = [
                'success' => true,
                'classification' => $classification,
                'action' => $action,
                'has_approved_enrollment' => $has_approved_enrollment,
                'enrollment_type' => $enrollment_type
            ];

            // If auto_generate, fetch preview data from latest enrollment
            if ($action === 'auto_generate' && $latest_enrollment) {
                $preview_data = $this->EnrollmentModel->get_enrollment_with_details($latest_enrollment['id']);
                
                // Calculate grade progression for the preview
                $currentGrade = $preview_data['grade_level'] ?? 'N/A';
                $gradeProgression = [
                    'Nursery 1' => 'Nursery 2',
                    'Nursery 2' => 'Kinder',
                    'Kinder' => 'Grade 1',
                    'Grade 1' => 'Grade 2',
                    'Grade 2' => 'Grade 3',
                    'Grade 3' => 'Grade 4',
                    'Grade 4' => 'Grade 5',
                    'Grade 5' => 'Grade 6',
                    'Grade 6' => 'Grade 7',
                    'Grade 7' => 'Grade 8',
                    'Grade 8' => 'Grade 9',
                    'Grade 9' => 'Grade 10',
                    'Grade 10' => 'Grade 11',
                    'Grade 11' => 'Grade 12',
                    'Grade 12' => 'Graduated'
                ];
                
                $nextGrade = $gradeProgression[$currentGrade] ?? $currentGrade;
                
                // Add calculations to the preview data for frontend display
                $preview_data['current_grade'] = $currentGrade;
                $preview_data['next_grade'] = $nextGrade;
                $preview_data['enrolling_school_year'] = $active_period['school_year'] ?? 'Next School Year';

                $response['latest_enrollment'] = $latest_enrollment;
                $response['preview_data'] = $preview_data;
            }

            http_response_code(200);
            echo json_encode($response);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Classify student based on enrollment type and history
     */
    private function classify_enrollment($enrollment_type, $has_approved_enrollment)
    {
        switch ($enrollment_type) {
            case 'New Student':
                return 'new_student';
            
            case 'Transferee':
                return 'transferee';
            
            case 'Continuing Student':
                return $has_approved_enrollment ? 'continuing_with_records' : 'continuing_first_timer';
            
            case 'Returning Student':
                return $has_approved_enrollment ? 'returning_with_records' : 'returning_first_timer';
            
            default:
                return 'unknown';
        }
    }

    /**
     * Determine action: go_to_form or auto_generate
     */
    private function determine_action($enrollment_type, $has_approved_enrollment)
    {
        // Only Continuing Students with records go to auto_generate
        if ($enrollment_type === 'Continuing Student' && $has_approved_enrollment) {
            return 'auto_generate';
        }

        // All others go to form
        return 'go_to_form';
    }
}
