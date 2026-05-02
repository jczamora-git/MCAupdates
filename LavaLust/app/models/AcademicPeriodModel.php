<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * AcademicPeriod Model
 * Handles academic period tracking (school year + quarter for preschool-elementary)
 */
class AcademicPeriodModel extends Model
{
    protected $table = 'academic_periods';

    /**
     * Get all academic periods with optional filters
     */
    public function get_all($filters = [])
    {
        $query = $this->db->table($this->table);

        // Status filter
        if (!empty($filters['status'])) {
            $query = $query->where('status', $filters['status']);
        }

        // School year filter
        if (!empty($filters['school_year'])) {
            $query = $query->where('school_year', $filters['school_year']);
        }

        // Semester filter
        if (!empty($filters['quarter'])) {
            $query = $query->where('quarter', $filters['quarter']);
        }

        return $query->order_by('start_date', 'DESC')->get_all();
    }

    /**
     * Get single academic period by ID
     */
    public function get_period($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->get();
    }

    /**
     * Get the currently active academic period
     * Returns the period with status='active'
     */
    public function get_active_period()
    {
        return $this->db->table($this->table)
                        ->where('status', 'active')
                        ->get();
    }

    /**
     * Get current quarter (active academic period's quarter)
     * Returns '1st Quarter', '2nd Quarter', '3rd Quarter', or '4th Quarter'
     */
    public function get_current_quarter()
    {
        $active = $this->get_active_period();
        return $active ? $active['quarter'] : null;
    }

    /**
     * Get current school year
     * Returns string like '2024-2025'
     */
    public function get_current_school_year()
    {
        $active = $this->get_active_period();
        return $active ? $active['school_year'] : null;
    }

    /**
     * Check if a specific quarter is currently active
     */
    public function is_quarter_active($quarter)
    {
        $active = $this->get_active_period();
        return $active && $active['quarter'] === $quarter;
    }

    /**
     * Create a new academic period
     */
    public function create($data)
    {
        // Validate required fields
        if (empty($data['school_year']) || empty($data['quarter']) || 
            empty($data['start_date']) || empty($data['end_date'])) {
            return false;
        }

        $data['created_at'] = app_now();
        $data['updated_at'] = app_now();
        
        return $this->db->table($this->table)->insert($data);
    }

    /**
     * Update academic period
     */
    public function update($id, $data)
    {
        $data['updated_at'] = app_now();
        
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($data);
    }

    /**
     * Delete academic period
     */
    public function delete($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->delete();
    }

    /**
     * Set a period as active (and update others: periods before it become 'past', periods after become 'upcoming')
     */
    public function set_active($id)
    {
        try {
            // Start transaction using whichever API the DB wrapper exposes
            $usedTx = null;
            if (method_exists($this->db, 'transaction')) {
                $this->db->transaction();
                $usedTx = 'transaction';
            } elseif (method_exists($this->db, 'beginTransaction')) {
                $this->db->beginTransaction();
                $usedTx = 'beginTransaction';
            }

            // Get the selected period to use as reference
            $activePeriod = $this->db->table($this->table)
                                     ->where('id', $id)
                                     ->get();
            
            if (!$activePeriod) {
                return false;
            }
            
            // Get all periods to update their status correctly
            $allPeriods = $this->db->table($this->table)->get_all();
            
            foreach ($allPeriods as $period) {
                if ($period['id'] == $id) {
                    // Set selected period as active
                    $this->db->table($this->table)
                             ->where('id', $id)
                             ->update(['status' => 'active']);
                } else {
                    // Set periods to 'past' if they end before the active period starts
                    // Set periods to 'upcoming' if they start after the active period ends
                    if ($period['end_date'] < $activePeriod['start_date']) {
                        $status = 'past';
                    } elseif ($period['start_date'] > $activePeriod['end_date']) {
                        $status = 'upcoming';
                    } else {
                        // Overlapping periods default to upcoming (shouldn't happen in practice)
                        $status = 'upcoming';
                    }
                    
                    $this->db->table($this->table)
                             ->where('id', $period['id'])
                             ->update(['status' => $status]);
                }
            }

            // Commit transaction if we started one
            if ($usedTx === 'transaction' && method_exists($this->db, 'commit')) {
                $this->db->commit();
            } elseif ($usedTx === 'beginTransaction' && method_exists($this->db, 'commit')) {
                // Database wrapper exposes commit() which calls underlying PDO::commit()
                $this->db->commit();
            }

            return true;
        } catch (Exception $e) {
            // Attempt rollback using available method names
            if (method_exists($this->db, 'roll_back')) {
                $this->db->roll_back();
            } elseif (method_exists($this->db, 'rollback')) {
                $this->db->rollback();
            } elseif (method_exists($this->db, 'rollBack')) {
                $this->db->rollBack();
            }

            return false;
        }
    }

    /**
     * Get subjects relevant to current semester
     * Returns subjects that match the current active semester
     */
    public function get_current_semester_subjects()
    {
        $currentSemester = $this->get_current_semester();
        
        if (!$currentSemester) {
            return [];
        }

        return $this->db->table('subjects')
                        ->where('semester', $currentSemester)
                        ->order_by('year_level, course_code', 'ASC')
                        ->get_all();
    }

    /**
     * Get activities for current academic period
     * Returns activities linked to the active academic period
     */
    public function get_current_period_activities($course_id = null)
    {
        $activePeriod = $this->get_active_period();
        
        if (!$activePeriod) {
            return [];
        }

        $query = $this->db->table('activities')
                          ->where('academic_period_id', $activePeriod['id']);

        if ($course_id) {
            $query = $query->where('course_id', $course_id);
        }

        return $query->order_by('due_at', 'ASC')->get_all();
    }

    /**
     * Get teacher assignments for current semester
     * Returns teacher_subjects filtered by current semester (via subject.semester)
     */
    public function get_current_semester_assignments($teacher_id = null)
    {
        $activePeriod = $this->get_active_period();
        
        if (!$activePeriod) {
            return [];
        }

        $query = $this->db->table('teacher_subjects ts')
                          ->join('subjects s', 'ts.subject_id = s.id')
                          ->select('ts.*, s.course_code, s.course_name, s.semester, s.year_level')
                          ->where('s.semester', $activePeriod['semester']);

        if ($teacher_id) {
            $query = $query->where('ts.teacher_id', $teacher_id);
        }

        return $query->get_all();
    }

    /**
     * Check if system should allow grading based on current period
     * Returns array with allowed status and current period info
     */
    public function get_grading_context()
    {
        $active = $this->get_active_period();
        
        if (!$active) {
            return [
                'allowed' => false,
                'message' => 'No active academic period set',
                'current_period' => null
            ];
        }

        return [
            'allowed' => true,
            'current_period' => [
                'id' => $active['id'],
                'school_year' => $active['school_year'],
                'quarter' => $active['quarter'] ?? null,
                'period_type' => $active['period_type'] ?? null,
                'start_date' => $active['start_date'],
                'end_date' => $active['end_date']
            ],
            'message' => "Current period: {$active['school_year']} " . ($active['quarter'] ?? $active['period_type'] ?? '')
        ];
    }

    /**
     * Get statistics about academic periods
     */
    public function get_stats()
    {
        $total = $this->db->table($this->table)
                         ->select('COUNT(*) as count')
                         ->get();

        $active = $this->db->table($this->table)
                           ->where('status', 'active')
                           ->select('COUNT(*) as count')
                           ->get();

        $upcoming = $this->db->table($this->table)
                             ->where('status', 'upcoming')
                             ->select('COUNT(*) as count')
                             ->get();

        $past = $this->db->table($this->table)
                        ->where('status', 'past')
                        ->select('COUNT(*) as count')
                        ->get();

        return [
            'total' => $total['count'] ?? 0,
            'active' => $active['count'] ?? 0,
            'upcoming' => $upcoming['count'] ?? 0,
            'past' => $past['count'] ?? 0
        ];
    }

    /**
     * Get distinct school years from academic periods
     * Returns array of school years ordered by school_year DESC
     */
    public function get_distinct_school_years()
    {
        $result = $this->db->table($this->table)
                          ->select('school_year')
                          ->group_by('school_year')
                          ->order_by('school_year', 'DESC')
                          ->get_all();

        // Extract just the school_year values
        return array_column($result, 'school_year');
    }
}
