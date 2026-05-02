<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class QuizController extends Controller {
    
    public function __construct() {
        parent::__construct();
        header('Content-Type: application/json');
        // CORS is handled globally in index.php — do NOT set Access-Control-Allow-Origin here,
        // because a wildcard '*' is incompatible with credentials: 'include' (session cookies).
        
        // Load required models
        $this->call->model('ActivityModel');
        $this->call->model('Quiz_model');
    }

    /**
     * Helper method to update activity max_score based on total question points
     */
    private function updateActivityMaxScore($activityId) {
        try {
            // Get all questions for this activity
            $questions = $this->Quiz_model->get_questions_by_activity($activityId);
            
            // Calculate total points
            $totalPoints = 0;
            foreach ($questions as $question) {
                $totalPoints += (int)$question['points'];
            }
            
            // Update activity max_score (without updated_at to avoid conflicts)
            $updated = $this->db->table('activities')
                ->where('id', $activityId)
                ->update(['max_score' => $totalPoints]);
            
            if (!$updated) {
                error_log("Failed to update activity max_score for activity ID: $activityId");
            }
            
            return $totalPoints;
        } catch (Exception $e) {
            // Log error but don't fail the main operation
            error_log('Failed to update activity max_score: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * GET /api/activities/{activityId}/questions
     * Get all questions for an activity
     */
    public function api_get_questions($activityId) {
        try {
            // Verify activity exists
            $activity = $this->ActivityModel->get_activity($activityId);
            if (!$activity) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Activity not found']);
                return;
            }

            // Get questions with choices
            $questions = $this->Quiz_model->get_questions_by_activity($activityId);
            
            // Format response
            foreach ($questions as &$question) {
                // Get choices if it's a multiple choice, multiple select, or matching question
                if (in_array($question['question_type'], ['multiple_choice', 'multiple_select', 'matching'])) {
                    $question['choices'] = $this->Quiz_model->get_question_choices($question['id']);
                }
                
                // Parse JSON fields if needed
                if (!empty($question['image_url']) && $this->isJson($question['image_url'])) {
                    $question['image_url'] = json_decode($question['image_url']);
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $questions,
                'count' => count($questions)
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching questions: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/activities/{activityId}/questions
     * Create a new question for an activity
     */
    public function api_create_question($activityId) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validate required fields
            if (empty($input['question_type']) || empty($input['question_text'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Question type and text are required']);
                return;
            }

            // Verify activity exists
            $activity = $this->ActivityModel->get_activity($activityId);
            if (!$activity) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Activity not found']);
                return;
            }

            // Validate question type (match database enum)
            $validTypes = ['multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'essay', 'matching', 'fill_blank'];
            if (!in_array($input['question_type'], $validTypes)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid question type']);
                return;
            }

            // Prepare question data
            $questionData = [
                'activity_id' => $activityId,
                'question_type' => $input['question_type'],
                'question_text' => $input['question_text'],
                'points' => $input['points'] ?? 1,
                'order_number' => $input['order_number'] ?? 1,
                'image_url' => $input['image_url'] ?? null,
                'correct_answer' => $input['correct_answer'] ?? null,
                'sample_answer' => $input['sample_answer'] ?? null,
                'created_at' => app_now()
            ];

            // Create question
            $questionId = $this->Quiz_model->create_question($questionData);

            if (!$questionId) {
                throw new Exception('Failed to create question');
            }

            // Create choices if multiple choice, multiple select, or matching
            if (in_array($input['question_type'], ['multiple_choice', 'multiple_select', 'matching']) && !empty($input['choices'])) {
                $choiceOrder = 1;
                foreach ($input['choices'] as $choice) {
                    if (!empty($choice['text'])) {
                        $choiceData = [
                            'question_id' => $questionId,
                            'choice_text' => $choice['text'],
                            'is_correct' => $choice['is_correct'] ? 1 : 0,
                            'order_number' => $choiceOrder++,
                            'created_at' => app_now()
                        ];
                        $this->Quiz_model->create_choice($choiceData);
                    }
                }
            }

            // Fetch created question with choices
            $question = $this->Quiz_model->get_question_by_id($questionId);
            if (in_array($question['question_type'], ['multiple_choice', 'multiple_select'])) {
                $question['choices'] = $this->Quiz_model->get_question_choices($questionId);
            }

            // Update activity max_score based on total question points
            $totalPoints = $this->updateActivityMaxScore($activityId);

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Question created successfully',
                'data' => $question,
                'activity_total_points' => $totalPoints
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error creating question: ' . $e->getMessage()]);
        }
    }

    /**
     * PUT /api/activities/{activityId}/questions/{questionId}
     * Update an existing question
     */
    public function api_update_question($activityId, $questionId) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Verify question exists and belongs to activity
            $question = $this->Quiz_model->get_question_by_id($questionId);
            if (!$question || $question['activity_id'] != $activityId) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Question not found']);
                return;
            }

            // Prepare update data - only include fields that are actually sent
            $updateData = [];
            
            if (isset($input['question_type'])) {
                $updateData['question_type'] = $input['question_type'];
            }
            if (isset($input['question_text'])) {
                $updateData['question_text'] = $input['question_text'];
            }
            if (isset($input['points'])) {
                $updateData['points'] = $input['points'];
            }
            if (isset($input['order_number'])) {
                $updateData['order_number'] = $input['order_number'];
            }
            if (isset($input['image_url'])) {
                $updateData['image_url'] = $input['image_url'];
            }
            if (isset($input['correct_answer'])) {
                $updateData['correct_answer'] = $input['correct_answer'];
            }
            if (isset($input['sample_answer'])) {
                $updateData['sample_answer'] = $input['sample_answer'];
            }

            // Update question
            $updated = $this->Quiz_model->update_question($questionId, $updateData);

            if (!$updated) {
                throw new Exception('Failed to update question');
            }

            // Update choices if multiple choice, multiple select, or matching (and choices are provided)
            if (isset($input['question_type']) && in_array($input['question_type'], ['multiple_choice', 'multiple_select', 'matching']) && isset($input['choices'])) {
                // Delete existing choices
                $this->Quiz_model->delete_question_choices($questionId);
                
                // Create new choices
                $choiceOrder = 1;
                foreach ($input['choices'] as $choice) {
                    if (!empty($choice['text'])) {
                        $choiceData = [
                            'question_id' => $questionId,
                            'choice_text' => $choice['text'],
                            'is_correct' => $choice['is_correct'] ? 1 : 0,
                            'order_number' => $choiceOrder++,
                            'created_at' => app_now()
                        ];
                        $this->Quiz_model->create_choice($choiceData);
                    }
                }
            }

            // Fetch updated question
            $updatedQuestion = $this->Quiz_model->get_question_by_id($questionId);
            if (in_array($updatedQuestion['question_type'], ['multiple_choice', 'multiple_select', 'matching'])) {
                $updatedQuestion['choices'] = $this->Quiz_model->get_question_choices($questionId);
            }

            // Update activity max_score based on total question points
            $totalPoints = $this->updateActivityMaxScore($activityId);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Question updated successfully',
                'data' => $updatedQuestion,
                'activity_total_points' => $totalPoints
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error updating question: ' . $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/activities/{activityId}/questions/{questionId}
     * Delete a question
     */
    public function api_delete_question($activityId, $questionId) {
        try {
            // Verify question exists and belongs to activity
            $question = $this->Quiz_model->get_question_by_id($questionId);
            if (!$question || $question['activity_id'] != $activityId) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Question not found']);
                return;
            }

            // Delete question (cascading will delete choices and answers)
            $deleted = $this->Quiz_model->delete_question($questionId);

            if (!$deleted) {
                throw new Exception('Failed to delete question');
            }

            // Update activity max_score based on remaining question points
            $totalPoints = $this->updateActivityMaxScore($activityId);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Question deleted successfully',
                'activity_total_points' => $totalPoints
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error deleting question: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/activities/{activityId}/settings
     * Save quiz settings
     */
    public function api_save_settings($activityId) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Verify activity exists
            $activity = $this->ActivityModel->get_activity($activityId);
            if (!$activity) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Activity not found']);
                return;
            }

            // Prepare settings data
            $settingsData = [
                'activity_id' => $activityId,
                'time_limit' => $input['time_limit'] ?? null,
                'max_attempts' => $input['max_attempts'] ?? 1,
                'shuffle_questions' => isset($input['shuffle_questions']) ? ($input['shuffle_questions'] ? 1 : 0) : 0,
                'shuffle_choices' => isset($input['shuffle_choices']) ? ($input['shuffle_choices'] ? 1 : 0) : 0,
                'show_correct_answers' => isset($input['show_correct_answers']) ? ($input['show_correct_answers'] ? 1 : 0) : 1,
                'pass_threshold' => $input['pass_threshold'] ?? null,
                'available_from' => $input['available_from'] ?? null,
                'available_until' => $input['available_until'] ?? null,
                'section_directions' => isset($input['section_directions']) ? json_encode($input['section_directions']) : null,
                'section_word_boxes' => isset($input['section_word_boxes']) ? json_encode($input['section_word_boxes']) : null,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ];

            // Check if settings exist
            $existingSettings = $this->Quiz_model->get_settings_by_activity($activityId);
            
            if ($existingSettings) {
                // Update existing settings
                unset($settingsData['created_at']);
                $result = $this->Quiz_model->update_settings($activityId, $settingsData);
            } else {
                // Create new settings
                $result = $this->Quiz_model->create_settings($settingsData);
            }

            if (!$result) {
                throw new Exception('Failed to save settings');
            }

            // Fetch updated settings
            $settings = $this->Quiz_model->get_settings_by_activity($activityId);
            if ($settings) {
                if (isset($settings['section_directions']) && is_string($settings['section_directions'])) {
                    $settings['section_directions'] = json_decode($settings['section_directions'], true);
                }
                if (isset($settings['section_word_boxes']) && is_string($settings['section_word_boxes'])) {
                    $settings['section_word_boxes'] = json_decode($settings['section_word_boxes'], true);
                }
            }

            if (!empty($settingsData['available_until'])) {
                $this->ActivityModel->update($activityId, [
                    'due_at' => $settingsData['available_until']
                ]);
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Settings saved successfully',
                'data' => $settings
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error saving settings: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/activities/{activityId}/settings
     * Get quiz settings
     */
    public function api_get_settings($activityId) {
        try {
            // Verify activity exists
            $activity = $this->ActivityModel->get_activity($activityId);
            if (!$activity) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Activity not found']);
                return;
            }

            $settings = $this->Quiz_model->get_settings_by_activity($activityId);
            if (!$settings) {
                $settings = [];
            }
            if ($settings) {
                if (isset($settings['section_directions']) && is_string($settings['section_directions'])) {
                    $settings['section_directions'] = json_decode($settings['section_directions'], true);
                }
                if (isset($settings['section_word_boxes']) && is_string($settings['section_word_boxes'])) {
                    $settings['section_word_boxes'] = json_decode($settings['section_word_boxes'], true);
                }
            }

            if (empty($settings['available_until']) && !empty($activity['due_at'])) {
                $settings['available_until'] = $activity['due_at'];
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $settings
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching settings: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/activities/{activityId}/quiz/start
     * Get quiz data for student (questions without correct answers)
     */
    public function api_start_quiz($activityId) {
        try {
            // Get student ID from session or token
            $userId = $this->session->userdata('user_id'); // User ID from session
            
            if (!$userId) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Get student record from students table
            $student = $this->db->table('students')->where('user_id', $userId)->get();
            if (!$student) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Student record not found']);
                return;
            }
            $studentId = $student['id'];

            // Verify activity exists
            $activity = $this->ActivityModel->get_activity($activityId);
            if (!$activity) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Quiz not found']);
                return;
            }

            // Get quiz settings
            $settings = $this->Quiz_model->get_settings_by_activity($activityId);

            $availability = $this->get_quiz_availability($activity, $settings);
            if (!$availability['allowed']) {
                http_response_code($availability['code']);
                echo json_encode(['success' => false, 'message' => $availability['message']]);
                return;
            }

            // Check if student has exceeded attempts
            if ($settings && $settings['max_attempts']) {
                $attempts = $this->Quiz_model->get_student_attempts($activityId, $studentId);
                if (count($attempts) >= $settings['max_attempts']) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Maximum attempts exceeded']);
                    return;
                }
            }

            // Get questions (without correct answers for security)
            $questions = $this->Quiz_model->get_questions_by_activity($activityId);
            
            foreach ($questions as &$question) {
                // Remove correct answers for security
                unset($question['correct_answer']);
                unset($question['sample_answer']);
                
                // Get choices if multiple choice/select/matching (without is_correct flag)
                if (in_array($question['question_type'], ['multiple_choice', 'multiple_select', 'matching'])) {
                    $choices = $this->Quiz_model->get_question_choices($question['id']);
                    foreach ($choices as &$choice) {
                        unset($choice['is_correct']); // Don't send correct answer to student
                    }
                    $question['choices'] = $choices;
                }
            }

            // Shuffle questions if enabled
            if ($settings && $settings['shuffle_questions']) {
                shuffle($questions);
            }

            // ── Upsert quiz session ─────────────────────────────────────────
            $activeSession = $this->Quiz_model->get_active_session($activityId, $studentId);
            if (!$activeSession) {
                $timeLimitSecs = ($settings && $settings['time_limit'])
                    ? intval($settings['time_limit']) * 60
                    : null;
                $expiresAt = $timeLimitSecs
                    ? date('Y-m-d H:i:s', strtotime(app_now()) + $timeLimitSecs)
                    : null;

                // Store shuffled question IDs order
                $questionOrder = array_column($questions, 'id');

                // Store shuffled matching right-column indices per question
                $matchingOrder = [];
                foreach ($questions as $q) {
                    if ($q['question_type'] === 'matching' && !empty($q['choices'])) {
                        $indices = range(0, count($q['choices']) - 1);
                        shuffle($indices);
                        $matchingOrder[$q['id']] = $indices;
                    }
                }

                $this->Quiz_model->create_session([
                    'activity_id'    => $activityId,
                    'student_id'     => $studentId,
                    'started_at'     => app_now(),
                    'expires_at'     => $expiresAt,
                    'question_order' => json_encode($questionOrder),
                    'matching_order' => json_encode($matchingOrder),
                    'submitted_at'   => null,
                ]);
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => [
                    'activity' => $activity,
                    'questions' => $questions,
                    'settings' => $settings
                ]
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error starting quiz: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/activities/{activityId}/quiz/session
     * Return the current in-progress session for the logged-in student,
     * including all saved answers so the frontend can resume after a refresh.
     */
    public function api_get_session($activityId) {
        try {
            $userId = $this->session->userdata('user_id');
            if (!$userId) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            $student = $this->db->table('students')->where('user_id', $userId)->get();
            if (!$student) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Student not found']);
                return;
            }
            $studentId = $student['id'];

            $session = $this->Quiz_model->get_active_session($activityId, $studentId);

            if (!$session) {
                http_response_code(200);
                echo json_encode(['success' => true, 'data' => null]);
                return;
            }

            // Decode JSON fields
            $session['question_order'] = json_decode($session['question_order'], true);
            $session['matching_order'] = json_decode($session['matching_order'] ?? '{}', true);

            // Backfill expires_at for legacy in-progress sessions where it wasn't set yet
            if (empty($session['expires_at'])) {
                $settings = $this->Quiz_model->get_settings_by_activity($activityId);
                if ($settings && !empty($settings['time_limit']) && !empty($session['started_at'])) {
                    $limitSecs = intval($settings['time_limit']) * 60;
                    $computedExpiresAt = date('Y-m-d H:i:s', strtotime($session['started_at']) + $limitSecs);
                    $session['expires_at'] = $computedExpiresAt;

                    // Persist so succeeding requests are consistent
                    if (!empty($session['id'])) {
                        $this->db->table('quiz_sessions')
                            ->where('id', $session['id'])
                            ->update(['expires_at' => $computedExpiresAt]);
                    }
                }
            }

            // Check if time has already expired
            $expired = false;
            if ($session['expires_at']) {
                $expired = strtotime($session['expires_at']) <= time();
            }

            // Attach saved answers
            $rawAnswers = $this->Quiz_model->get_student_answers_for_session($activityId, $studentId);
            $session['saved_answers'] = $rawAnswers;
            $session['expired'] = $expired;

            // Compute seconds_remaining
            if ($session['expires_at'] && !$expired) {
                $session['seconds_remaining'] = max(0, strtotime($session['expires_at']) - time());
            } else {
                $session['seconds_remaining'] = null;
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $session]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching session: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/activities/{activityId}/quiz/save-answer
     * Auto-save student answer
     */
    public function api_save_answer($activityId) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $userId = $this->session->userdata('user_id');
            
            if (!$userId) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Get student record from students table
            $student = $this->db->table('students')->where('user_id', $userId)->get();
            if (!$student) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Student record not found']);
                return;
            }
            $studentId = $student['id'];

            $activity = $this->ActivityModel->get_activity($activityId);
            if (!$activity) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Quiz not found']);
                return;
            }

            $settings = $this->Quiz_model->get_settings_by_activity($activityId);
            $availability = $this->get_quiz_availability($activity, $settings);
            if (!$availability['allowed']) {
                http_response_code($availability['code']);
                echo json_encode(['success' => false, 'message' => $availability['message']]);
                return;
            }

            $answerText = $input['answer_text'] ?? null;

            // Encode multiple_select choices as JSON
            if (!empty($input['selected_choices']) && is_array($input['selected_choices'])) {
                $answerText = json_encode($input['selected_choices']);
            }

            // Encode matching pairs as JSON
            if (isset($input['matching_pairs']) && is_array($input['matching_pairs'])) {
                $answerText = json_encode($input['matching_pairs']);
            }

            $answerData = [
                'activity_id' => $activityId,
                'question_id' => $input['question_id'],
                'student_id'  => $studentId,
                'answer_text' => $answerText,
                'choice_id'   => $input['choice_id'] ?? null,
                'updated_at'  => app_now()
            ];

            $existing = $this->Quiz_model->get_student_answer($activityId, $input['question_id'], $studentId);
            if ($existing) {
                $this->Quiz_model->update_student_answer($existing['id'], $answerData);
            } else {
                $this->Quiz_model->create_student_answer($answerData);
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Answer saved']);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error saving answer: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/activities/{activityId}/quiz/submit
     * Submit quiz and calculate grade
     */
    public function api_submit_quiz($activityId) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $userId = $this->session->userdata('user_id');
            
            if (!$userId) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Get student record from students table
            $student = $this->db->table('students')->where('user_id', $userId)->get();
            if (!$student) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Student record not found']);
                return;
            }
            $studentId = $student['id'];

            // Get student record from students table
            $student = $this->db->table('students')->where('user_id', $userId)->get();
            if (!$student) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Student record not found']);
                return;
            }
            $studentId = $student['id'];

            $activity = $this->ActivityModel->get_activity($activityId);
            if (!$activity) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Quiz not found']);
                return;
            }

            $settings = $this->Quiz_model->get_settings_by_activity($activityId);
            $availability = $this->get_quiz_availability($activity, $settings);
            if (!$availability['allowed']) {
                http_response_code($availability['code']);
                echo json_encode(['success' => false, 'message' => $availability['message']]);
                return;
            }

            // First, save all answers to activity_student_answers
            if (isset($input['answers']) && is_array($input['answers'])) {
                foreach ($input['answers'] as $answer) {
                    $answerData = [
                        'activity_id' => $activityId,
                        'question_id' => $answer['question_id'],
                        'student_id' => $studentId,
                        'choice_id' => $answer['choice_id'] ?? null,
                        'answer_text' => $answer['answer_text'] ?? null
                    ];

                    // Handle multiple_select questions
                    if (isset($answer['selected_choices']) && is_array($answer['selected_choices'])) {
                        // For multiple select, save as JSON in answer_text
                        $answerData['answer_text'] = json_encode($answer['selected_choices']);
                    }

                    // Handle matching questions
                    if (isset($answer['matching_pairs']) && is_array($answer['matching_pairs'])) {
                        // For matching, save as JSON in answer_text
                        $answerData['answer_text'] = json_encode($answer['matching_pairs']);
                    }

                    // Check if answer exists
                    $existing = $this->Quiz_model->get_student_answer($activityId, $answer['question_id'], $studentId);
                    
                    if ($existing) {
                        $this->Quiz_model->update_student_answer($existing['id'], $answerData);
                    } else {
                        $this->Quiz_model->create_student_answer($answerData);
                    }
                }
            }

            // Load latest session for grading mapping (matching question right-column shuffle)
            $latestSession = $this->Quiz_model->get_latest_session($activityId, $studentId);
            $matchingOrder = [];
            if ($latestSession && !empty($latestSession['matching_order'])) {
                $decodedMatchingOrder = json_decode($latestSession['matching_order'], true);
                if (is_array($decodedMatchingOrder)) {
                    $matchingOrder = $decodedMatchingOrder;
                }
            }

            // Get all questions with correct answers
            $questions = $this->Quiz_model->get_questions_by_activity($activityId);
            
            // Get student answers
            $studentAnswers = $this->Quiz_model->get_student_answers_by_activity($activityId, $studentId);
            
            $totalPoints = 0;
            $earnedPoints = 0;
            $autoGradedPoints = 0;
            $manualGradingRequired = false;

            foreach ($questions as $question) {
                $totalPoints += $question['points'];
                
                // Find student's answer for this question
                $answer = null;
                foreach ($studentAnswers as $sa) {
                    if ($sa['question_id'] == $question['id']) {
                        $answer = $sa;
                        break;
                    }
                }

                if (!$answer) continue;

                // Auto-grade objective questions
                $pointsEarned = 0;
                $isCorrect = false;

                if ($question['question_type'] === 'multiple_choice') {
                    $choices = $this->Quiz_model->get_question_choices($question['id']);
                    foreach ($choices as $choice) {
                        if ($choice['is_correct'] && $choice['id'] == $answer['choice_id']) {
                            $pointsEarned = $question['points'];
                            $isCorrect = true;
                            break;
                        }
                    }
                    $autoGradedPoints += $pointsEarned;
                } elseif ($question['question_type'] === 'true_false') {
                    if (strtolower($answer['answer_text']) === strtolower($question['correct_answer'])) {
                        $pointsEarned = $question['points'];
                        $isCorrect = true;
                    }
                    $autoGradedPoints += $pointsEarned;
                } elseif ($question['question_type'] === 'matching') {
                    // Auto-grade matching questions
                    $studentPairs = json_decode($answer['answer_text'], true);
                    $choices = $this->Quiz_model->get_question_choices($question['id']);
                    
                    if ($studentPairs && is_array($studentPairs)) {
                        $correctCount = 0;
                        $totalPairs = count($choices);
                        $questionMatchingOrder = isset($matchingOrder[$question['id']]) && is_array($matchingOrder[$question['id']])
                            ? $matchingOrder[$question['id']]
                            : [];
                        
                        foreach ($studentPairs as $leftIdxRaw => $rightDisplayIdxRaw) {
                            $leftIdx = intval($leftIdxRaw);
                            $rightDisplayIdx = intval($rightDisplayIdxRaw);

                            if (!isset($choices[$leftIdx])) {
                                continue;
                            }

                            // Map displayed right index back to the original index used in DB choices.
                            $rightOriginalIdx = isset($questionMatchingOrder[$rightDisplayIdx])
                                ? intval($questionMatchingOrder[$rightDisplayIdx])
                                : $rightDisplayIdx;

                            // Correct if left original index matches right original index.
                            if ($leftIdx === $rightOriginalIdx) {
                                $correctCount++;
                            }
                        }
                        
                        if ($totalPairs > 0) {
                            $pointsEarned = ($correctCount / $totalPairs) * $question['points'];
                            $isCorrect = ($correctCount == $totalPairs);
                        }
                        $autoGradedPoints += $pointsEarned;
                    }
                } elseif ($question['question_type'] === 'fill_blank') {
                    // Auto-grade fill in the blank using sample_answer as accepted answers
                    // sample_answer supports comma-separated values (e.g. "am" or "hat, bat")
                    $studentRaw = strtolower(trim((string)($answer['answer_text'] ?? '')));
                    $acceptedRaw = strtolower(trim((string)($question['sample_answer'] ?? '')));

                    $studentParts = array_values(array_filter(array_map('trim', explode(',', $studentRaw)), function ($value) {
                        return $value !== '';
                    }));
                    $acceptedParts = array_values(array_filter(array_map('trim', explode(',', $acceptedRaw)), function ($value) {
                        return $value !== '';
                    }));

                    if (!empty($studentParts) && !empty($acceptedParts)) {
                        if (count($studentParts) === 1) {
                            // Single answer: allow match against any accepted value
                            $isCorrect = in_array($studentParts[0], $acceptedParts, true);
                        } else if (count($studentParts) === count($acceptedParts)) {
                            // Multiple answers: require exact sequence per blank
                            $isCorrect = true;
                            for ($i = 0; $i < count($studentParts); $i++) {
                                if ($studentParts[$i] !== $acceptedParts[$i]) {
                                    $isCorrect = false;
                                    break;
                                }
                            }
                        } else {
                            $isCorrect = false;
                        }
                    } else {
                        $isCorrect = false;
                    }

                    if ($isCorrect) {
                        $pointsEarned = $question['points'];
                    }
                    $autoGradedPoints += $pointsEarned;
                } elseif (in_array($question['question_type'], ['short_answer', 'essay'])) {
                    $manualGradingRequired = true;
                }

                // Update answer with grading info
                $this->db->table('activity_student_answers')
                    ->where('id', $answer['id'])
                    ->update([
                        'is_correct' => $isCorrect ? 1 : 0,
                        'points_earned' => $pointsEarned
                    ]);
            }

            // Create or update grade record
            $existing = $this->db->table('activity_grades')
                ->where('activity_id', $activityId)
                ->where('student_id', $studentId)
                ->get();

            $status = 'Pending'; // Default status from enum
            if (!$manualGradingRequired) {
                // Auto-determine pass/fail based on grade
                $activity = $this->db->table('activities')->where('id', $activityId)->get();
                $maxScore = $activity ? $activity['max_score'] : 100;
                $percentage = $maxScore > 0 ? ($autoGradedPoints / $maxScore) * 100 : 0;
                $status = $percentage >= 60 ? 'Passed' : 'Failed'; // 60% passing grade
            }

            if ($existing) {
                // Update existing grade
                $this->db->table('activity_grades')
                    ->where('activity_id', $activityId)
                    ->where('student_id', $studentId)
                    ->update([
                        'grade' => $autoGradedPoints,
                        'status' => $status,
                        'updated_at' => app_now()
                    ]);
            } else {
                // Insert new grade
                $this->db->table('activity_grades')->insert([
                    'activity_id' => $activityId,
                    'student_id' => $studentId,
                    'grade' => $autoGradedPoints,
                    'status' => $status,
                    'created_at' => app_now(),
                    'updated_at' => app_now()
                ]);
            }

            // Mark quiz session as submitted
            $this->Quiz_model->submit_session($activityId, $studentId);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Quiz submitted successfully',
                'data' => [
                    'total_points' => $totalPoints,
                    'earned_points' => $autoGradedPoints,
                    'percentage' => $totalPoints > 0 ? round(($autoGradedPoints / $totalPoints) * 100, 2) : 0,
                    'requires_manual_grading' => $manualGradingRequired,
                    'status' => $status
                ]
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error submitting quiz: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/activities/{activityId}/student-answers
     * Get student answers for review
     */
    public function api_get_student_answers($activityId) {
        try {
            $studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;
            
            if (!$studentId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'student_id is required']);
                return;
            }

            // Get student answers
            $answers = $this->Quiz_model->get_student_answers_by_activity($activityId, $studentId);

            // Get latest session (submitted or active) to retrieve matching right-column order
            $latestSession = $this->Quiz_model->get_latest_session($activityId, $studentId);
            $matchingOrder = [];
            if ($latestSession && !empty($latestSession['matching_order'])) {
                $decoded = json_decode($latestSession['matching_order'], true);
                if (is_array($decoded)) {
                    $matchingOrder = $decoded;
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => [
                    'answers' => $answers,
                    'matching_order' => $matchingOrder
                ]
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error fetching student answers: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/activities/{activityId}/grade-answer
     * Manually grade a student's answer
     */
    public function api_grade_answer($activityId) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $studentId = $input['student_id'] ?? null;
            $questionId = $input['question_id'] ?? null;
            $pointsEarned = $input['points_earned'] ?? null;
            $feedback = $input['feedback'] ?? null;

            if (!$studentId || !$questionId || $pointsEarned === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required fields']);
                return;
            }

            // Update the answer
            $answer = $this->Quiz_model->get_student_answer($activityId, $questionId, $studentId);
            
            if (!$answer) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Answer not found']);
                return;
            }

            // Get the question to check max points
            $question = $this->Quiz_model->get_question_by_id($questionId);
            
            if (!$question) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Question not found']);
                return;
            }
            
            if ($pointsEarned < 0 || $pointsEarned > $question['points']) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid points value']);
                return;
            }

            // Update answer with points and feedback
            $this->db->table('activity_student_answers')
                ->where('id', $answer['id'])
                ->update([
                    'points_earned' => $pointsEarned,
                    'is_correct' => $pointsEarned == $question['points'] ? 1 : 0
                ]);

            // Recalculate total grade for this student
            $allAnswers = $this->Quiz_model->get_student_answers_by_activity($activityId, $studentId);
            $totalPoints = array_sum(array_column($allAnswers, 'points_earned'));

            // Update activity_grades
            $this->db->table('activity_grades')
                ->where('activity_id', $activityId)
                ->where('student_id', $studentId)
                ->update([
                    'grade' => $totalPoints,
                    'updated_at' => app_now()
                ]);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Grade updated successfully',
                'data' => [
                    'points_earned' => $pointsEarned,
                    'total_grade' => $totalPoints
                ]
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error grading answer: ' . $e->getMessage()]);
        }
    }

    /**
     * Helper function to check if string is JSON
     */
    private function isJson($string) {
        if (!is_string($string)) return false;
        json_decode($string);
        return (json_last_error() == JSON_ERROR_NONE);
    }

    private function get_quiz_availability($activity, $settings) {
        $now = time();

        $availableFrom = null;
        if ($settings && !empty($settings['available_from'])) {
            $availableFrom = strtotime($settings['available_from']);
        }

        $availableUntilRaw = null;
        if ($settings && !empty($settings['available_until'])) {
            $availableUntilRaw = $settings['available_until'];
        }
        if (!$availableUntilRaw && !empty($activity['due_at'])) {
            $availableUntilRaw = $activity['due_at'];
        }

        $availableUntil = $availableUntilRaw ? strtotime($availableUntilRaw) : null;
        $allowLate = !empty($activity['allow_late_submission']);

        if ($availableFrom && $now < $availableFrom) {
            return ['allowed' => false, 'code' => 403, 'message' => 'Quiz is not yet available'];
        }

        if ($availableUntil && $now > $availableUntil && !$allowLate) {
            return ['allowed' => false, 'code' => 403, 'message' => 'Quiz is already closed'];
        }

        return ['allowed' => true, 'code' => 200, 'message' => 'OK'];
    }
}
