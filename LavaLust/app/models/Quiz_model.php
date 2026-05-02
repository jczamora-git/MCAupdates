<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Quiz_model extends Model {
    
    /**
     * Get all questions for an activity
     */
    public function get_questions_by_activity($activityId) {
        return $this->db->table('activity_questions')
            ->where('activity_id', $activityId)
            ->order_by('order_number', 'ASC')
            ->get_all();
    }

    /**
     * Get a single question by ID
     */
    public function get_question_by_id($questionId) {
        return $this->db->table('activity_questions')
            ->where('id', $questionId)
            ->get();
    }

    /**
     * Create a new question
     */
    public function create_question($data) {
        return $this->db->table('activity_questions')->insert($data);
    }

    /**
     * Update a question
     */
    public function update_question($questionId, $data) {
        return $this->db->table('activity_questions')
            ->where('id', $questionId)
            ->update($data);
    }

    /**
     * Delete a question
     */
    public function delete_question($questionId) {
        // First delete all related choices
        $this->delete_question_choices($questionId);
        
        // Then delete the question
        return $this->db->table('activity_questions')
            ->where('id', $questionId)
            ->delete();
    }

    /**
     * Get choices for a question
     */
    public function get_question_choices($questionId) {
        return $this->db->table('activity_question_choices')
            ->where('question_id', $questionId)
            ->order_by('id', 'ASC')
            ->get_all();
    }

    /**
     * Create a choice
     */
    public function create_choice($data) {
        return $this->db->table('activity_question_choices')->insert($data);
    }

    /**
     * Delete all choices for a question
     */
    public function delete_question_choices($questionId) {
        return $this->db->table('activity_question_choices')
            ->where('question_id', $questionId)
            ->delete();
    }

    /**
     * Get quiz settings for an activity
     */
    public function get_settings_by_activity($activityId) {
        return $this->db->table('activity_settings')
            ->where('activity_id', $activityId)
            ->get();
    }

    /**
     * Create quiz settings
     */
    public function create_settings($data) {
        return $this->db->table('activity_settings')->insert($data);
    }

    /**
     * Update quiz settings
     */
    public function update_settings($activityId, $data) {
        return $this->db->table('activity_settings')
            ->where('activity_id', $activityId)
            ->update($data);
    }

    /**
     * Get student's answer for a specific question
     */
    public function get_student_answer($activityId, $questionId, $studentId) {
        return $this->db->table('activity_student_answers')
            ->where('activity_id', $activityId)
            ->where('question_id', $questionId)
            ->where('student_id', $studentId)
            ->get();
    }

    /**
     * Get all student answers for an activity
     */
    public function get_student_answers_by_activity($activityId, $studentId) {
        return $this->db->table('activity_student_answers')
            ->where('activity_id', $activityId)
            ->where('student_id', $studentId)
            ->get_all();
    }

    /**
     * Create student answer
     */
    public function create_student_answer($data) {
        if (!isset($data['answered_at'])) {
            $data['answered_at'] = app_now();
        }
        if (!isset($data['updated_at'])) {
            $data['updated_at'] = app_now();
        }

        return $this->db->table('activity_student_answers')->insert($data);
    }

    /**
     * Update student answer
     */
    public function update_student_answer($answerId, $data) {
        return $this->db->table('activity_student_answers')
            ->where('id', $answerId)
            ->update($data);
    }

    /**
     * Get student's quiz attempts
     */
    public function get_student_attempts($activityId, $studentId) {
        return $this->db->table('activity_grades')
            ->where('activity_id', $activityId)
            ->where('student_id', $studentId)
            ->get_all();
    }

    // ─── Quiz Sessions ────────────────────────────────────────────────────────

    /**
     * Get the current in-progress session for a student (submitted_at IS NULL)
     */
    public function get_active_session($activityId, $studentId) {
        return $this->db->table('quiz_sessions')
            ->where('activity_id', $activityId)
            ->where('student_id', $studentId)
            ->where_null('submitted_at')
            ->order_by('started_at', 'DESC')
            ->get();
    }

    /**
     * Get latest session for a student (active or submitted)
     */
    public function get_latest_session($activityId, $studentId) {
        return $this->db->table('quiz_sessions')
            ->where('activity_id', $activityId)
            ->where('student_id', $studentId)
            ->order_by('started_at', 'DESC')
            ->get();
    }

    /**
     * Create a new quiz session
     */
    public function create_session($data) {
        if (!isset($data['created_at'])) {
            $data['created_at'] = app_now();
        }
        if (!isset($data['updated_at'])) {
            $data['updated_at'] = app_now();
        }

        return $this->db->table('quiz_sessions')->insert($data);
    }

    /**
     * Mark a session as submitted
     */
    public function submit_session($activityId, $studentId) {
        return $this->db->table('quiz_sessions')
            ->where('activity_id', $activityId)
            ->where('student_id', $studentId)
            ->where_null('submitted_at')
            ->update(['submitted_at' => app_now()]);
    }

    /**
     * Get all saved answers for a student on an activity
     */
    public function get_student_answers_for_session($activityId, $studentId) {
        return $this->db->table('activity_student_answers')
            ->where('activity_id', $activityId)
            ->where('student_id', $studentId)
            ->get_all();
    }

    /**
     * Get quiz submission details
     */
    public function get_submission($activityId, $studentId) {
        return $this->db->table('activity_submissions')
            ->where('activity_id', $activityId)
            ->where('student_id', $studentId)
            ->get();
    }

    /**
     * Create quiz submission
     */
    public function create_submission($data) {
        return $this->db->table('activity_submissions')->insert($data);
    }

    /**
     * Update quiz submission
     */
    public function update_submission($submissionId, $data) {
        return $this->db->table('activity_submissions')
            ->where('id', $submissionId)
            ->update($data);
    }

    /**
     * Get all submissions for an activity (for teacher grading)
     */
    public function get_activity_submissions($activityId) {
        return $this->db->table('activity_submissions as s')
            ->join('students as st', 's.student_id = st.id')
            ->join('users as u', 'st.user_id = u.id')
            ->where('s.activity_id', $activityId)
            ->select('s.*, st.id as student_id, u.firstname, u.lastname, u.email')
            ->order_by('s.submitted_at', 'DESC')
            ->get_all();
    }

    /**
     * Get detailed submission with questions and answers
     */
    public function get_submission_details($submissionId) {
        // Get submission
        $submission = $this->db->table('activity_submissions as s')
            ->join('students as st', 's.student_id = st.id')
            ->join('users as u', 'st.user_id = u.id')
            ->where('s.id', $submissionId)
            ->select('s.*, st.id as student_id, u.firstname, u.lastname, u.email')
            ->get();

        if (!$submission) {
            return null;
        }

        // Get questions and student answers
        $questions = $this->get_questions_by_activity($submission['activity_id']);
        $studentAnswers = $this->get_student_answers_by_activity($submission['activity_id'], $submission['student_id']);

        // Map answers to questions
        foreach ($questions as &$question) {
            $question['student_answer'] = null;
            foreach ($studentAnswers as $answer) {
                if ($answer['question_id'] == $question['id']) {
                    $question['student_answer'] = $answer;
                    break;
                }
            }

            // Get choices if multiple choice/select
            if (in_array($question['question_type'], ['multiple_choice', 'multiple_select'])) {
                $question['choices'] = $this->get_question_choices($question['id']);
            }
        }

        $submission['questions'] = $questions;
        return $submission;
    }
}
