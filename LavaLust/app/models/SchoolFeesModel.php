<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * SchoolFees Model
 * Handles fee catalog/templates for different grade levels
 */
class SchoolFeesModel extends Model
{
    protected $table = 'school_fees';

    /**
     * Get all school fees with optional filters
     * Note: academic_period_id removed - fees are now reusable
     */
    public function get_all($filters = [])
    {
        $sql = "SELECT sf.* FROM {$this->table} sf WHERE 1=1";
        
        $params = [];

        // Year level filter
        if (!empty($filters['year_level'])) {
            if ($filters['year_level'] === 'All Grades') {
                $sql .= " AND (sf.year_level IS NULL OR sf.year_level = '')";
            } else {
                $sql .= " AND (sf.year_level = ? OR sf.year_level IS NULL)";
                $params[] = $filters['year_level'];
            }
        }

        // Fee type filter
        if (!empty($filters['fee_type'])) {
            $sql .= " AND sf.fee_type = ?";
            $params[] = $filters['fee_type'];
        }

        // Active status filter
        if (isset($filters['is_active'])) {
            $sql .= " AND sf.is_active = ?";
            $params[] = $filters['is_active'];
        }

        // Required status filter
        if (isset($filters['is_required'])) {
            $sql .= " AND sf.is_required = ?";
            $params[] = $filters['is_required'];
        }

        $sql .= " ORDER BY sf.fee_type, sf.fee_name";

        $stmt = $this->db->raw($sql, $params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Build year_levels array for display
        foreach ($results as &$fee) {
            if (!empty($fee['year_level'])) {
                $fee['year_levels'] = [$fee['year_level']];
            } else {
                $fee['year_levels'] = [];
            }
        }

        return $results;
    }

    /**
     * Get single school fee by ID
     */
    public function get_fee($id)
    {
        $sql = "SELECT sf.* FROM {$this->table} sf WHERE sf.id = ?";
        
        $stmt = $this->db->raw($sql, [$id]);
        $fee = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($fee) {
            // Build year_levels array for display
            if (!empty($fee['year_level'])) {
                $fee['year_levels'] = [$fee['year_level']];
            } else {
                $fee['year_levels'] = [];
            }
        }

        return $fee;
    }

    /**
     * Create new school fee
     */
    public function create($data)
    {
        $fields = [
            'academic_period_id',
            'year_level',
            'fee_type',
            'fee_name',
            'amount',
            'is_required',
            'due_date',
            'is_active',
            'description'
        ];

        $insert_data = [];
        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $insert_data[$field] = $data[$field];
            }
        }

        // Ensure required fields have defaults
        if (!isset($insert_data['is_required'])) {
            $insert_data['is_required'] = 0;
        }
        if (!isset($insert_data['is_active'])) {
            $insert_data['is_active'] = 1;
        }

        $result = $this->db->table($this->table)->insert($insert_data);
        
        if ($result) {
            return $this->db->last_id();
        }
        
        return false;
    }

    /**
     * Update school fee
     */
    public function update($id, $data)
    {
        $fields = [
            'academic_period_id',
            'year_level',
            'fee_type',
            'fee_name',
            'amount',
            'is_required',
            'due_date',
            'is_active',
            'description'
        ];

        $update_data = [];
        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $update_data[$field] = $data[$field];
            }
        }

        if (empty($update_data)) {
            return false;
        }

        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($update_data);
    }

    /**
     * Delete school fee
     */
    public function delete($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->delete();
    }

    /**
     * Get fees applicable to a specific year level
     * Includes fees for "All Grades" (year_level = NULL) and specific grade
     */
    public function get_fees_for_year_level($year_level, $academic_period_id = null)
    {
        $sql = "SELECT sf.*, 
                       ap.school_year,
                       ap.quarter,
                       CONCAT(ap.school_year, ' - ', ap.quarter) as academic_period
                FROM {$this->table} sf
                LEFT JOIN academic_periods ap ON sf.academic_period_id = ap.id
                WHERE sf.is_active = 1 
                AND (sf.year_level IS NULL OR sf.year_level = ?)";
        
        $params = [$year_level];

        if ($academic_period_id) {
            $sql .= " AND sf.academic_period_id = ?";
            $params[] = $academic_period_id;
        } else {
            // Get active period
            $sql .= " AND ap.status = 'active'";
        }

        $sql .= " ORDER BY sf.fee_type, sf.fee_name";

        $stmt = $this->db->raw($sql, $params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Build year_levels array for display
        foreach ($results as &$fee) {
            if (!empty($fee['year_level'])) {
                $fee['year_levels'] = [$fee['year_level']];
            } else {
                $fee['year_levels'] = [];
            }
        }

        return $results;
    }

    /**
     * Get total required fees for a year level
     */
    public function get_total_required_fees($year_level, $academic_period_id = null)
    {
        $fees = $this->get_fees_for_year_level($year_level, $academic_period_id);
        
        $total = 0;
        foreach ($fees as $fee) {
            if ($fee['is_required']) {
                $total += $fee['amount'];
            }
        }

        return $total;
    }

    /**
     * Check if fee name already exists for the academic period and year level
     */
    public function fee_exists($fee_name, $academic_period_id, $year_level = null, $exclude_id = null)
    {
        $query = $this->db->table($this->table)
                          ->where('fee_name', $fee_name)
                          ->where('academic_period_id', $academic_period_id);

        if ($year_level === null) {
            $query = $query->where('year_level IS NULL');
        } else {
            $query = $query->where('year_level', $year_level);
        }

        if ($exclude_id) {
            $query = $query->where('id !=', $exclude_id);
        }

        $result = $query->get();
        return !empty($result);
    }
}
