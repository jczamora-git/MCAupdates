<?php

/**
 * EnrollmentPeriodController.php - Enrollment Period Management
 * 
 * This controller handles enrollment period operations matching the actual database schema:
 * Fields: enrollment_name, enrollment_type, allowed_grade_levels
 * Status: Upcoming, Open, Closed, Cancelled
 * Enrollment Types: Regular, Mid-Year, Transferee
 */

class EnrollmentPeriodController extends Controller
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Get live enrollee count for an enrollment period.
     */
    private function get_current_enrollees_count($enrollmentPeriodId)
    {
        $stmt = $this->db->raw(
            "SELECT COUNT(*) AS cnt FROM enrollments WHERE enrollment_period_id = ?",
            [(int)$enrollmentPeriodId]
        );

        $row = $stmt ? $stmt->fetch() : null;
        return $row && isset($row['cnt']) ? (int)$row['cnt'] : 0;
    }

    /**
     * GET /api/enrollment-periods
     * Fetch all enrollment periods
     */
    public function api_enrollment_periods()
    {
        api_set_json_headers();
        
        try {
            $query = "
                SELECT 
                    ep.*,
                    (
                        SELECT COUNT(*)
                        FROM enrollments e
                        WHERE e.enrollment_period_id = ep.id
                    ) AS current_enrollees,
                    ap.school_year,
                    ap.quarter,
                    ap.status as academic_period_status
                FROM enrollment_periods ep
                LEFT JOIN academic_periods ap ON ap.id = ep.academic_period_id
                ORDER BY ep.start_date DESC, ep.created_at DESC
            ";
            
            $result = $this->db->raw($query)->fetchAll();
            
            // Parse JSON fields
            foreach ($result as &$period) {
                if (isset($period['allowed_grade_levels']) && is_string($period['allowed_grade_levels'])) {
                    $period['allowed_grade_levels'] = json_decode($period['allowed_grade_levels'], true);
                }
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching enrollment periods: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * GET /api/enrollment-periods/active
     * Get currently active (Open status) enrollment period
     */
    public function api_enrollment_period_active()
    {
        api_set_json_headers();
        
        try {
            $query = "
                SELECT 
                    ep.*,
                    (
                        SELECT COUNT(*)
                        FROM enrollments e
                        WHERE e.enrollment_period_id = ep.id
                    ) AS current_enrollees,
                    ap.school_year,
                    ap.quarter,
                    ap.status as academic_period_status
                FROM enrollment_periods ep
                LEFT JOIN academic_periods ap ON ap.id = ep.academic_period_id
                WHERE ep.status = 'Open'
                ORDER BY ep.start_date ASC
                LIMIT 1
            ";
            
            $result = $this->db->raw($query)->fetch();
            
            if ($result && isset($result['allowed_grade_levels']) && is_string($result['allowed_grade_levels'])) {
                $result['allowed_grade_levels'] = json_decode($result['allowed_grade_levels'], true);
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result ?: null
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching active enrollment period: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * GET /api/enrollment-periods/{id}
     * Get specific enrollment period
     */
    public function api_enrollment_period_by_id($id)
    {
        api_set_json_headers();
        
        try {
            $query = "
                SELECT 
                    ep.*,
                    (
                        SELECT COUNT(*)
                        FROM enrollments e
                        WHERE e.enrollment_period_id = ep.id
                    ) AS current_enrollees,
                    ap.school_year,
                    ap.quarter,
                    ap.status as academic_period_status
                FROM enrollment_periods ep
                LEFT JOIN academic_periods ap ON ap.id = ep.academic_period_id
                WHERE ep.id = ?
            ";
            
            $stmt = $this->db->raw($query, [(int)$id]);
            $result = $stmt->fetch();
            
            if (!$result) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Enrollment period not found'
                ]);
                return;
            }
            
            if (isset($result['allowed_grade_levels']) && is_string($result['allowed_grade_levels'])) {
                $result['allowed_grade_levels'] = json_decode($result['allowed_grade_levels'], true);
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching enrollment period: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * POST /api/enrollment-periods
     * Create new enrollment period
     */
    public function api_enrollment_period_create()
    {
        api_set_json_headers();
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validation
            $required = ['academic_period_id', 'enrollment_name', 'start_date', 'end_date'];
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
            
            // Date Range Validation
            $startTime = strtotime($input['start_date']);
            $endTime = strtotime($input['end_date']);
            
            if (!$startTime || !$endTime) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid date format. Use YYYY-MM-DD format.'
                ]);
                return;
            }
            
            if ($endTime <= $startTime) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'End date must be after start date'
                ]);
                return;
            }
            
            // Capacity Validation
            if (isset($input['max_slots']) && !empty($input['max_slots'])) {
                $maxSlots = (int)$input['max_slots'];
                
                if ($maxSlots < 0) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Max slots cannot be negative'
                    ]);
                    return;
                }
                
            }
            
            // Convert allowed_grade_levels to JSON if array
            $allowedGradeLevels = null;
            if (isset($input['allowed_grade_levels'])) {
                if (is_array($input['allowed_grade_levels'])) {
                    $allowedGradeLevels = json_encode($input['allowed_grade_levels']);
                } else if (is_string($input['allowed_grade_levels'])) {
                    $allowedGradeLevels = $input['allowed_grade_levels'];
                }
            }
            
            $data = [
                'academic_period_id' => (int)$input['academic_period_id'],
                'enrollment_name' => $input['enrollment_name'],
                'enrollment_type' => $input['enrollment_type'] ?? 'Regular',
                'start_date' => $input['start_date'],
                'end_date' => $input['end_date'],
                'status' => $input['status'] ?? 'Upcoming',
                'max_slots' => isset($input['max_slots']) && !empty($input['max_slots']) ? (int)$input['max_slots'] : null,
                'allowed_grade_levels' => $allowedGradeLevels,
                'description' => $input['description'] ?? null
            ];
            
            $insertedId = (int)$this->db->table('enrollment_periods')->insert([
                'academic_period_id' => $data['academic_period_id'],
                'enrollment_name' => $data['enrollment_name'],
                'enrollment_type' => $data['enrollment_type'],
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'status' => $data['status'],
                'max_slots' => $data['max_slots'],
                'allowed_grade_levels' => $data['allowed_grade_levels'],
                'description' => $data['description']
            ]);
            
            if ($insertedId) {
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Enrollment period created successfully',
                    'id' => $insertedId
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create enrollment period'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error creating enrollment period: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * PUT /api/enrollment-periods/{id}
     * Update enrollment period
     */
    public function api_enrollment_period_update($id)
    {
        api_set_json_headers();
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Check if period exists
            $existing = $this->db->raw("SELECT * FROM enrollment_periods WHERE id = ?", [(int)$id])->fetch();
            if (!$existing) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Enrollment period not found'
                ]);
                return;
            }
            
            // Date Range Validation (if dates are being updated)
            if (isset($input['start_date']) || isset($input['end_date'])) {
                $startDate = isset($input['start_date']) ? $input['start_date'] : $existing['start_date'];
                $endDate = isset($input['end_date']) ? $input['end_date'] : $existing['end_date'];
                
                $startTime = strtotime($startDate);
                $endTime = strtotime($endDate);
                
                if (!$startTime || !$endTime) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Invalid date format. Use YYYY-MM-DD format.'
                    ]);
                    return;
                }
                
                if ($endTime <= $startTime) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'End date must be after start date'
                    ]);
                    return;
                }
            }
            
            // Capacity Validation (if max_slots is being updated)
            if (array_key_exists('max_slots', $input)) {
                $maxSlots = !empty($input['max_slots']) ? (int)$input['max_slots'] : null;

                // Validate max_slots is not negative
                if ($maxSlots !== null && $maxSlots < 0) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Max slots cannot be negative'
                    ]);
                    return;
                }

                $currentEnrollees = $this->get_current_enrollees_count((int)$id);

                // Validate live enrollee count doesn't exceed max_slots
                if ($maxSlots !== null && $currentEnrollees > $maxSlots) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => "Current enrollees ($currentEnrollees) cannot exceed max slots ($maxSlots)"
                    ]);
                    return;
                }
            }
            
            $updates = [];
            $params = [];
            
            if (isset($input['academic_period_id'])) {
                $updates[] = "academic_period_id = ?";
                $params[] = (int)$input['academic_period_id'];
            }
            if (isset($input['enrollment_name'])) {
                $updates[] = "enrollment_name = ?";
                $params[] = $input['enrollment_name'];
            }
            if (isset($input['enrollment_type'])) {
                $updates[] = "enrollment_type = ?";
                $params[] = $input['enrollment_type'];
            }
            if (isset($input['start_date'])) {
                $updates[] = "start_date = ?";
                $params[] = $input['start_date'];
            }
            if (isset($input['end_date'])) {
                $updates[] = "end_date = ?";
                $params[] = $input['end_date'];
            }
            if (isset($input['status'])) {
                $updates[] = "status = ?";
                $params[] = $input['status'];
            }
            if (isset($input['max_slots'])) {
                $updates[] = "max_slots = ?";
                $params[] = !empty($input['max_slots']) ? (int)$input['max_slots'] : null;
            }
            if (isset($input['description'])) {
                $updates[] = "description = ?";
                $params[] = $input['description'];
            }
            if (isset($input['allowed_grade_levels'])) {
                $updates[] = "allowed_grade_levels = ?";
                if (is_array($input['allowed_grade_levels'])) {
                    $params[] = json_encode($input['allowed_grade_levels']);
                } else {
                    $params[] = $input['allowed_grade_levels'];
                }
            }
            
            if (empty($updates)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No fields to update'
                ]);
                return;
            }
            
            $params[] = (int)$id;
            $query = "UPDATE enrollment_periods SET " . implode(', ', $updates) . " WHERE id = ?";
            
            $stmt = $this->db->raw($query, $params);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment period updated successfully'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error updating enrollment period: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * POST /api/enrollment-periods/{id}/set-active
     * Set enrollment period status (Open/Closed)
     */
    public function api_enrollment_period_set_active($id)
    {
        api_set_json_headers();
        
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $set_open = isset($input['is_active']) ? (bool)$input['is_active'] : false;
            
            $newStatus = $set_open ? 'Open' : 'Closed';
            
            $query = "UPDATE enrollment_periods SET status = ? WHERE id = ?";
            $stmt = $this->db->raw($query, [$newStatus, (int)$id]);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => "Period status set to $newStatus"
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error updating period status: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * DELETE /api/enrollment-periods/{id}
     * Delete enrollment period
     */
    public function api_enrollment_period_delete($id)
    {
        api_set_json_headers();
        
        try {
            // Check if period is open
            $period = $this->db->raw("SELECT status FROM enrollment_periods WHERE id = ?", [(int)$id])->fetch();
            
            if (!$period) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Enrollment period not found'
                ]);
                return;
            }
            
            if ($period['status'] === 'Open') {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Cannot delete an open enrollment period. Please close it first.'
                ]);
                return;
            }

            $enrolleeCount = $this->get_current_enrollees_count((int)$id);
            if ($enrolleeCount > 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => "Cannot delete enrollment period with existing enrollments ($enrolleeCount)."
                ]);
                return;
            }
            
            $query = "DELETE FROM enrollment_periods WHERE id = ?";
            $stmt = $this->db->raw($query, [(int)$id]);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Enrollment period deleted successfully'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error deleting enrollment period: ' . $e->getMessage()
            ]);
        }
    }
}
