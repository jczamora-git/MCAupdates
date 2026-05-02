<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * FinalGrades Model
 * Handles all final grades database operations
 */
class FinalGradesModel extends Model
{
    protected $table = 'final_grade_submissions';
    protected $itemsTable = 'final_grade_submission_items';

    /**
     * Get final grades by filters
     */
    public function get_grades($filters = [])
    {
        $query = $this->db->table($this->itemsTable)
            ->select('final_grade_submission_items.*, final_grade_submissions.subject_id, final_grade_submissions.section_id, final_grade_submissions.academic_period_id, final_grade_submissions.quarter, final_grade_submissions.status, final_grade_submissions.submitted_by, final_grade_submissions.submitted_at, final_grade_submissions.approved_by, final_grade_submissions.approved_at')
            ->join('final_grade_submissions', 'final_grade_submissions.id = final_grade_submission_items.submission_id');

        if (!empty($filters['student_id'])) {
            $query = $query->where('final_grade_submission_items.student_id', $filters['student_id']);
        }
        if (!empty($filters['subject_id'])) {
            $query = $query->where('final_grade_submissions.subject_id', $filters['subject_id']);
        }
        if (!empty($filters['academic_period_id'])) {
            $query = $query->where('final_grade_submissions.academic_period_id', $filters['academic_period_id']);
        }
        if (!empty($filters['section_id'])) {
            $query = $query->where('final_grade_submissions.section_id', $filters['section_id']);
        }
        if (!empty($filters['quarter'])) {
            $query = $query->where('final_grade_submissions.quarter', $filters['quarter']);
        }

        return $query->order_by('final_grade_submission_items.created_at', 'DESC')->get_all();
    }

    /**
     * Get single final grade record
     */
    public function get_grade($id)
    {
        return $this->db->table($this->itemsTable)
                        ->where('id', $id)
                        ->get();
    }

    /**
     * Get submission header by scope
     */
    public function get_submission_by_scope($subject_id, $section_id, $academic_period_id, $quarter)
    {
        return $this->db->table($this->table)
                        ->where('subject_id', $subject_id)
                        ->where('section_id', $section_id)
                        ->where('academic_period_id', $academic_period_id)
                        ->where('quarter', $quarter)
                        ->get();
    }

    /**
     * Create a submission header
     */
    public function create_submission($data)
    {
        $data['created_at'] = app_now();
        $data['updated_at'] = app_now();

        $ok = $this->db->table($this->table)
                       ->insert($data);

        if (!$ok) {
            return false;
        }

        return (int) $this->db->last_id();
    }

    /**
     * Update submission header
     */
    public function update_submission($id, $data)
    {
        $data['updated_at'] = app_now();

        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($data);
    }

    /**
     * Upsert one student grade item for a submission
     */
    public function upsert_submission_item($submission_id, $student_id, $data)
    {
        $existing = $this->db->table($this->itemsTable)
            ->where('submission_id', $submission_id)
            ->where('student_id', $student_id)
            ->get();

        $payload = [
            'submission_id' => $submission_id,
            'student_id' => $student_id,
            'final_grade_num' => $data['final_grade_num'] ?? null,
            'final_grade' => $data['final_grade'] ?? null,
            'remarks' => $data['remarks'] ?? null,
            'updated_at' => app_now(),
        ];

        if ($existing && !empty($existing['id'])) {
            $ok = $this->db->table($this->itemsTable)
                ->where('id', $existing['id'])
                ->update($payload);

            return [
                'success' => (bool) $ok,
                'action' => 'updated',
                'id' => (int) $existing['id'],
            ];
        }

        $payload['created_at'] = app_now();
        $ok = $this->db->table($this->itemsTable)->insert($payload);

        return [
            'success' => (bool) $ok,
            'action' => 'inserted',
            'id' => $ok ? (int) $this->db->last_id() : null,
        ];
    }

    /**
     * Delete all grade items in a submission
     */
    public function delete_submission_items($submission_id)
    {
        return $this->db->table($this->itemsTable)
                        ->where('submission_id', $submission_id)
                        ->delete();
    }

    /**
     * Delete final grade record
     */
    public function delete($id)
    {
        return $this->db->table($this->itemsTable)
                        ->where('id', $id)
                        ->delete();
    }
}
?>
