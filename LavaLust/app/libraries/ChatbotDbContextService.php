<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ChatbotDbContextService
 *
 * Queries live database tables to build a factual context string that is
 * injected into the LLM prompt, allowing the chatbot to answer questions
 * like "how much is the tuition fee for Nursery 1?" accurately.
 *
 * Topics handled:
 *   - School fees / tuition (school_fees table)
 *   - Active academic period (academic_periods table)
 *   - Student enrollment status (enrollments table, student/enrollee roles only)
 *   - Student payment plan / balance (payment_plans table, student role only)
 */
class ChatbotDbContextService
{
    protected $db;
    protected $lava;

    public function __construct()
    {
        $this->lava =& lava_instance();
        $this->lava->call->database();
        $this->db = $this->lava->db;
        $this->lava->call->library('ChatbotRouteRegistry');
    }

    /**
     * Build a plain-text context block from live DB data.
     *
     * @param  string       $message  The user's chat message
     * @param  string       $role     User role (admin|teacher|student|enrollee)
     * @param  int|null     $userId   Logged-in user ID
     * @param  string|null  $intent   Optional intent name from router
     * @return string                 Multi-line context string (empty string if nothing relevant)
     */
    public function build($message, $role, $userId, $intent = null)
    {
        $lines = [];

        $isFee        = $this->mentionsFees($message);
        $isEnrollment = $this->mentionsEnrollment($message);
        $isPayment    = $this->mentionsPayment($message);
        $isPeriod     = $this->mentionsAcademicPeriod($message);
        $isTeacher    = $this->mentionsTeacher($message);
        $isSubject    = $this->mentionsSubjects($message);
        $isGrades     = $this->mentionsGrades($message);
        $isActivities = $this->mentionsActivities($message);
        $isRfid       = $this->mentionsRfid($message);
        $isConcerns   = $this->mentionsConcerns($message);
        $isNavigation = $this->mentionsNavigation($message);
        $isPinIssue   = $this->mentionsPinIssue($message);
        $yearLevel    = $this->extractYearLevel($message);
        $feeType      = $this->extractFeeType($message);

        $intent = $intent ? mb_strtolower(trim((string) $intent)) : null;
        if (!empty($intent)) {
            $isFee = $isEnrollment = $isPayment = $isPeriod = $isTeacher = $isSubject = false;
            $isGrades = $isActivities = $isRfid = $isConcerns = $isNavigation = $isPinIssue = false;

            if (in_array($intent, ['student_enrollment_status', 'enrollment_status', 'admin_enrollment_summary'], true)) {
                $isEnrollment = true;
            } elseif (in_array($intent, ['student_payment_summary', 'payment_summary', 'admin_payment_summary'], true)) {
                $isPayment = true;
            } elseif (in_array($intent, ['student_subjects', 'student_teachers', 'teacher_subjects'], true)) {
                $isSubject = true;
                $isTeacher = true;
            } elseif (in_array($intent, ['student_grades'], true)) {
                $isGrades = true;
            } elseif (in_array($intent, ['admin_rfid_summary'], true)) {
                $isRfid = true;
            } elseif (in_array($intent, ['admin_pending_concerns'], true)) {
                $isConcerns = true;
            }
        }

        // Attach active academic period when any relevant topic is detected
        if ($isFee || $isEnrollment || $isPayment || $isPeriod || $isTeacher || $isSubject) {
            $period = $this->getActivePeriod();
            if ($period) {
                $lines[] = "Current academic period: {$period['school_year']} – {$period['quarter']} (status: {$period['status']})";
            }
        }

        // ── Fees ─────────────────────────────────────────────────────────────
        if ($isFee) {
            if ($yearLevel) {
                $fees = $this->getFeesForYearLevel($yearLevel, $feeType);
                $feeLabel = $feeType ? "{$feeType} fees" : 'fees';
                if (!empty($fees)) {
                    $lines[] = ucfirst($feeLabel) . " for {$yearLevel}:";
                    $totalRequired = 0;
                    foreach ($fees as $fee) {
                        $req   = $fee['is_required'] ? ' [required]' : ' [optional]';
                        $desc  = !empty($fee['description']) ? ' – ' . $fee['description'] : '';
                        $lines[] = "  • {$fee['fee_name']} ({$fee['fee_type']}): ₱" . number_format($fee['amount'], 2) . "{$req}{$desc}";
                        if ($fee['is_required']) {
                            $totalRequired += (float) $fee['amount'];
                        }
                    }
                    if ($totalRequired > 0) {
                        $lines[] = "  Total required {$feeLabel} for {$yearLevel}: ₱" . number_format($totalRequired, 2);
                    }
                } else {
                    $lines[] = "No active {$feeLabel} found for {$yearLevel}.";
                }
            } else {
                // No specific grade — show summary for all grades
                $all = $this->getAllActiveFeesSummary($feeType);
                if (!empty($all)) {
                    $feeLabel = $feeType ? "{$feeType} fees" : 'required fees';
                    $lines[] = "School {$feeLabel} summary:";
                    foreach ($all as $yl => $total) {
                        $lines[] = "  • {$yl}: ₱" . number_format($total, 2);
                    }
                }
            }
        }

        // ── Enrollment context (student/enrollee or admin summary) ────────────
        if ($isEnrollment) {
            if ($role === 'student' || $role === 'enrollee') {
                if ($userId) {
                    $block = $this->getStudentEnrollmentStatus($userId);
                    if ($block !== '') {
                        $lines[] = $block;
                    }
                }
            } elseif ($role === 'admin') {
                $block = $this->getAdminEnrollmentSummary();
                if ($block !== '') {
                    $lines[] = $block;
                }
            } else {
                $lines[] = $this->buildAccessDeniedContext('enrollment_summary');
            }
        }

        // ── Payment context (student or admin summary) ───────────────────────
        if ($isPayment) {
            if ($role === 'student') {
                if ($userId) {
                    $block = $this->getStudentPaymentSummary($userId);
                    if ($block !== '') {
                        $lines[] = $block;
                    }
                }
            } elseif ($role === 'admin') {
                $block = $this->getAdminPaymentSummary();
                if ($block !== '') {
                    $lines[] = $block;
                }
            } else {
                $lines[] = $this->buildAccessDeniedContext('payment_summary');
            }
        }

        // ── Subjects / teachers context ─────────────────────────────────────
        if (($isTeacher || $isSubject) && $userId) {
            if ($role === 'student') {
                $block = $this->getStudentSubjectsWithTeachers($userId);
                if ($block !== '') {
                    $lines[] = $block;
                }
            } elseif ($role === 'teacher') {
                $block = $this->getTeacherSubjects($userId);
                if ($block !== '') {
                    $lines[] = $block;
                }
            } else {
                $lines[] = $this->buildAccessDeniedContext('subject_assignments');
            }
        }

        // ── Student grades ──────────────────────────────────────────────────
        if ($isGrades) {
            if ($role === 'student' && $userId) {
                $block = $this->getStudentGrades($userId);
                if ($block !== '') {
                    $lines[] = $block;
                }
            } else {
                $lines[] = $this->buildAccessDeniedContext('student_grades');
            }
        }

        // ── RFID attendance summary (admin only) ────────────────────────────
        if ($isRfid) {
            if ($role === 'admin') {
                $block = $this->getAdminRfidSummary();
                if ($block !== '') {
                    $lines[] = $block;
                }
            } else {
                $lines[] = $this->buildAccessDeniedContext('rfid_summary');
            }
        }

        // ── Concerns summary (admin only) ───────────────────────────────────
        if ($isConcerns) {
            if ($role === 'admin') {
                $block = $this->getAdminPendingConcernsSummary();
                if ($block !== '') {
                    $lines[] = $block;
                }
            } else {
                $lines[] = $this->buildAccessDeniedContext('concern_summary');
            }
        }

        // ── PIN issue — inject focused help block BEFORE the full route list ────
        // When the user mentions a forgotten/lost PIN, explicitly surface both
        // the Verify PIN page and the Forgot PIN flow so the LLM always mentions
        // both options and does not pick just one from the route list.
        if ($isPinIssue) {
            $lines[] = '';
            $lines[] = 'PIN HELP OPTIONS (always mention both of these):'
                     . "\n  1. Verify Payment PIN → [link:Verify Payment PIN|/enrollment/verify-pin]"
                     . "\n     Use this first: enter your PIN to receive a verification email."
                     . "\n  2. Forgot PIN → [link:Forgot PIN|/auth/forgot-pin]"
                     . "\n     Use this if you cannot remember your PIN at all and need to reset it via email."
                     . "\n  Both options are available on the Verify Payment PIN page (look for the Forgot PIN? link at the bottom).";
        }

        // ── Navigation routes (only when user is asking about navigation) ─────
        // Injected conditionally to keep token count low for data-only questions.
        if ($isNavigation) {
            $routeBlock = ChatbotRouteRegistry::buildContext($role);
            if ($routeBlock !== '') {
                $lines[] = '';
                $lines[] = $routeBlock;
            }
        }

        return implode("\n", $lines);
    }

    // ── Intent detectors ─────────────────────────────────────────────────────

    private function mentionsFees($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'tuition', 'fee', ' fees', 'how much', 'price', 'cost',
            'miscellaneous', 'school fee', 'payment amount',
            // Tagalog
            'magkano', 'bayad', 'bayarin', 'matrikula', 'tuition fee',
            'school fee', 'miscellaneous', 'libro', 'gastos', 'halaga',
            'presyo', 'singil', 'kontribusyon',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsEnrollment($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'enroll', 'enrollment', 'enrolment', 'my application', 'enrollment status',
            // Tagalog
            'mag-enroll', 'pag-enroll', 'enrollment ko', 'application ko',
            'status ng enrollment', 'naka-enroll', 'nakapag-enroll',
            'pagpatala', 'patala',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsPayment($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'my payment', 'my balance', 'balance', 'installment',
            'paid', 'remaining balance', 'outstanding', 'gcash',
            // Tagalog
            'bayad ko', 'babayaran', 'balanse', 'natitirang bayad',
            'hulog', 'installment', 'gcash', 'natitira', 'utang',
            'magbayad', 'nagbayad', 'payment ko',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsAcademicPeriod($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'academic period', 'school year', 'current period', 'quarter', 'what quarter',
            // Tagalog
            'taong paaralan', 'school year', 'kasalukuyang quarter',
            'anong quarter', 'anong school year',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsTeacher($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'my teacher', 'my teachers', 'who teach', 'who is teaching',
            'who will teach', 'who handles', 'class adviser', 'my adviser',
            'subject teacher', 'class teacher',
            // Tagalog
            'guro ko', 'mga guro', 'sino ang guro', 'sino ang teacher',
            'sino ang magtuturo', 'sino ang nagtuturo', 'adviser ko',
            'teacher ko', 'sino ang adviser', 'sino ang mag-aaral',
            'aking guro', 'aking teacher',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsSubjects($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'my subject', 'my subjects', 'what subjects', 'list of subjects',
            'subjects enrolled', 'enrolled subjects', 'what are my subjects',
            // Tagalog
            'mga subject ko', 'mga paksa', 'subject ko', 'anong subject',
            'listahan ng subject', 'mga klase ko', 'anong klase',
            'mga aralin', 'aralin ko',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsGrades($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'grades', 'grade', 'score', 'rating', 'final grade', 'quarter', 'grading',
            // Tagalog
            'grado', 'marka', 'mark', 'rating', 'grade ko', 'grades ko', 'quarter',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsActivities($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'activity', 'activities', 'quiz', 'exam', 'assignment', 'due', 'overdue',
            'late submission', 'take quiz', 'pending quiz',
            // Tagalog
            'gawain', 'aktibidad', 'pagsusulit', 'exam', 'assignment', 'deadline',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsRfid($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            'rfid', 'attendance', 'scan', 'tap card', 'time in', 'time out',
            'late', 'absent', 'pumasok', 'attendance mode',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsConcerns($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            'concern', 'concerns', 'complaint', 'report', 'issue', 'problem',
            'feedback', 'reklamo', 'sumbong', 'suport', 'help',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsPinIssue($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English
            'forgot pin', 'forget pin', 'forgot my pin', 'lost my pin',
            'reset pin', 'change pin', 'setup pin', 'set up pin',
            'set pin', 'create pin', 'new pin', 'pin problem',
            'verify pin', 'payment pin', 'pin verification',
            // Tagalog
            'nakalimutan', 'nalimutan', 'nakalimot', 'hindi ko matandaan',
            'nakalimutan ko ang pin', 'pin ko', 'ang pin ko',
            'i-reset ang pin', 'baguhin ang pin', 'setup ng pin',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    private function mentionsNavigation($msg)
    {
        $msg = mb_strtolower($msg);
        foreach ([
            // English navigation
            'where', 'how do i go', 'how to go', 'how to access', 'how to find',
            'what page', 'which page', 'navigate', 'open the', 'link to',
            'take me to', 'go to', 'find the page', 'menu', 'sidebar',
            // PIN / password recovery (always needs route context)
            'forgot pin', 'forget pin', 'forgot my pin', 'reset pin', 'change pin',
            'setup pin', 'set up pin', 'set pin', 'create pin', 'new pin',
            'forgot password', 'reset password', 'change password',
            // Tagalog PIN / navigation keywords
            'nakalimutan', 'nalimutan', 'nakalimot', 'hindi ko matandaan',
            'pin ko', 'ang pin', 'i-reset', 'i-change', 'baguhin',
            'saan', 'paano', 'wala akong', 'hindi ko mahanap',
        ] as $kw) {
            if (mb_strpos($msg, $kw) !== false) return true;
        }
        return false;
    }

    // ── Fee-type extractor ────────────────────────────────────────────────────

    /**
     * Detect if the user is asking about a specific fee type.
     * Returns the exact enum value used in school_fees.fee_type, or null for all types.
     */
    private function extractFeeType($msg)
    {
        $msg = mb_strtolower($msg);
        // Order matters: check more specific phrases first
        if (mb_strpos($msg, 'miscellaneous') !== false || mb_strpos($msg, 'misc fee') !== false) return 'Miscellaneous';
        if (mb_strpos($msg, 'book fee') !== false || mb_strpos($msg, 'textbook') !== false || mb_strpos($msg, 'text book') !== false) return 'Book';
        if (mb_strpos($msg, 'uniform fee') !== false || mb_strpos($msg, 'uniform cost') !== false || mb_strpos($msg, 'uniform price') !== false) return 'Uniform';
        if (mb_strpos($msg, 'shuttle') !== false || mb_strpos($msg, 'school service') !== false || mb_strpos($msg, 'service fee') !== false) return 'Service Fee';
        if (mb_strpos($msg, 'contribution') !== false) return 'Contribution';
        if (mb_strpos($msg, 'event fee') !== false || mb_strpos($msg, 'field trip') !== false) return 'Event Fee';
        // "tuition fee" / "tuition" alone → Tuition type only
        if (mb_strpos($msg, 'tuition') !== false) return 'Tuition';
        // Generic "fee"/"fees"/"how much" with no specific type → return null (all types)
        return null;
    }

    private function extractYearLevel($msg)
    {
        $msg = mb_strtolower($msg);
        $map = [
            'nursery 1'    => 'Nursery 1',
            'nursery1'     => 'Nursery 1',
            'nursery 2'    => 'Nursery 2',
            'nursery2'     => 'Nursery 2',
            'kinder'       => 'Kinder',
            'kindergarten' => 'Kinder',
            'grade 1'      => 'Grade 1',
            'grade1'       => 'Grade 1',
            'grade 2'      => 'Grade 2',
            'grade2'       => 'Grade 2',
            'grade 3'      => 'Grade 3',
            'grade3'       => 'Grade 3',
            'grade 4'      => 'Grade 4',
            'grade4'       => 'Grade 4',
            'grade 5'      => 'Grade 5',
            'grade5'       => 'Grade 5',
            'grade 6'      => 'Grade 6',
            'grade6'       => 'Grade 6',
        ];

        foreach ($map as $pattern => $label) {
            if (mb_strpos($msg, $pattern) !== false) {
                return $label;
            }
        }

        return null;
    }

    private function formatCurrency($value)
    {
        if ($value === null || $value === '') {
            return 'N/A';
        }
        return '₱' . number_format((float) $value, 2);
    }

    private function buildAccessDeniedContext($intent)
    {
        return $this->formatContextBlock($intent, [
            'Result' => 'I cannot access that information for your role.'
        ]);
    }

    private function formatContextBlock($intent, array $fields)
    {
        $lines = [
            'Live Context:',
            '- Intent: ' . $intent,
        ];

        foreach ($fields as $label => $value) {
            $lines[] = '- ' . $label . ': ' . $value;
        }

        return implode("\n", $lines);
    }

    private function getStudentRecordByUserId($userId)
    {
        try {
            $stmt = $this->db->raw(
                "SELECT s.id, s.year_level, s.section_id, sec.name as section_name, u.first_name, u.last_name\n"
                . "FROM students s\n"
                . "LEFT JOIN sections sec ON s.section_id = sec.id\n"
                . "LEFT JOIN users u ON s.user_id = u.id\n"
                . "WHERE s.user_id = ? LIMIT 1",
                [$userId]
            );
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentRecordByUserId error: ' . $e->getMessage());
            return null;
        }
    }

    private function getTeacherRecordByUserId($userId)
    {
        try {
            $stmt = $this->db->raw(
                "SELECT id, employee_id FROM teachers WHERE user_id = ? LIMIT 1",
                [$userId]
            );
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getTeacherRecordByUserId error: ' . $e->getMessage());
            return null;
        }
    }

    // ── DB queries ────────────────────────────────────────────────────────────

    private function getActivePeriod()
    {
        try {
            $sql  = "SELECT school_year, quarter, status FROM academic_periods WHERE status = 'active' LIMIT 1";
            $stmt = $this->db->raw($sql);
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getActivePeriod error: ' . $e->getMessage());
            return null;
        }
    }

    private function getFeesForYearLevel($yearLevel, $feeType = null)
    {
        try {
            // school_fees has no academic_period_id — fees are reusable across periods
            $sql = "SELECT fee_name, fee_type, amount, is_required, description
                    FROM school_fees
                    WHERE is_active = 1
                      AND (year_level = ? OR year_level IS NULL OR year_level = '')";
            $params = [$yearLevel];
            if ($feeType !== null) {
                $sql .= " AND fee_type = ?";
                $params[] = $feeType;
            }
            $sql .= " ORDER BY is_required DESC, fee_type, fee_name";
            $stmt = $this->db->raw($sql, $params);
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getFeesForYearLevel error: ' . $e->getMessage());
            return [];
        }
    }

    private function getAllActiveFeesSummary($feeType = null)
    {
        try {
            // school_fees has no academic_period_id — fees are reusable across periods
            $sql = "SELECT year_level, SUM(amount) as total
                    FROM school_fees
                    WHERE is_active = 1
                      AND is_required = 1
                      AND year_level IS NOT NULL
                      AND year_level != ''";
            $params = [];
            if ($feeType !== null) {
                $sql .= " AND fee_type = ?";
                $params[] = $feeType;
            }
            $sql .= " GROUP BY year_level ORDER BY year_level";
            $stmt = $this->db->raw($sql, $params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $map  = [];
            foreach ($rows as $row) {
                $map[$row['year_level']] = $row['total'];
            }
            return $map;
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getAllActiveFeesSummary error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Get the class teacher (adviser) and subject teachers for a student
     * based on their year_level stored in the students table.
     */
    private function getStudentTeachers($userId)
    {
        $result = [
            'year_level'       => null,
            'section'          => null,
            'class_teacher'    => null,
            'subject_teachers' => [],
        ];

        try {
            // 1. Get student's year_level and section
            $stmt = $this->db->raw(
                "SELECT s.year_level, sec.name as section_name
                 FROM students s
                 LEFT JOIN sections sec ON s.section_id = sec.id
                 WHERE s.user_id = ? LIMIT 1",
                [$userId]
            );
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$student || empty($student['year_level'])) {
                return $result;
            }
            $yearLevel = $student['year_level'];
            $result['year_level'] = $yearLevel;
            $result['section']    = $student['section_name'];

            // 2. Get active school year from academic_periods
            $stmt = $this->db->raw(
                "SELECT school_year FROM academic_periods WHERE status = 'active' LIMIT 1"
            );
            $period = $stmt->fetch(PDO::FETCH_ASSOC);
            // teacher_assignments stores school_year like '2026-2027'
            // academic_periods stores school_year like '2025-2026'; try both
            $schoolYear = $period ? $period['school_year'] : null;

            // 3. Get class teacher from teacher_assignments
            $taSql = "SELECT CONCAT(u.first_name, ' ', u.last_name) as teacher_name
                      FROM teacher_assignments ta
                      JOIN teachers t ON ta.teacher_id = t.id
                      JOIN users u ON t.user_id = u.id
                      WHERE ta.level = ?
                      LIMIT 1";
            $taParams = [$yearLevel];
            if ($schoolYear) {
                $taSql = "SELECT CONCAT(u.first_name, ' ', u.last_name) as teacher_name
                          FROM teacher_assignments ta
                          JOIN teachers t ON ta.teacher_id = t.id
                          JOIN users u ON t.user_id = u.id
                          WHERE ta.level = ?
                          ORDER BY ABS(CAST(SUBSTRING_INDEX(ta.school_year,'-',1) AS UNSIGNED)
                                      - CAST(SUBSTRING_INDEX(?, '-', 1) AS UNSIGNED)) ASC
                          LIMIT 1";
                $taParams = [$yearLevel, $schoolYear];
            }
            $stmt = $this->db->raw($taSql, $taParams);
            $ct   = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($ct) {
                $result['class_teacher'] = $ct['teacher_name'];
            }

            // 4. Get subject teachers via teacher_subject_assignments
            $stSql = "SELECT DISTINCT CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
                             sub.name as subject
                      FROM teacher_subject_assignments tsa
                      JOIN teachers t ON tsa.teacher_id = t.id
                      JOIN users u ON t.user_id = u.id
                      JOIN subjects sub ON tsa.subject_id = sub.id
                      WHERE sub.level = ?
                      ORDER BY sub.name";
            $stParams = [$yearLevel];
            if ($schoolYear) {
                $stSql = "SELECT DISTINCT CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
                                 sub.name as subject
                          FROM teacher_subject_assignments tsa
                          JOIN teachers t ON tsa.teacher_id = t.id
                          JOIN users u ON t.user_id = u.id
                          JOIN subjects sub ON tsa.subject_id = sub.id
                          WHERE sub.level = ?
                            AND tsa.school_year = ?
                          ORDER BY sub.name";
                $stParams = [$yearLevel, $schoolYear];
            }
            $stmt = $this->db->raw($stSql, $stParams);
            $result['subject_teachers'] = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentTeachers error: ' . $e->getMessage());
        }

        return $result;
    }

    private function getStudentSubjects($userId)
    {
        $result = ['year_level' => null, 'items' => []];
        try {
            $stmt = $this->db->raw(
                "SELECT year_level FROM students WHERE user_id = ? LIMIT 1",
                [$userId]
            );
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$student || empty($student['year_level'])) return $result;

            $yearLevel = $student['year_level'];
            $result['year_level'] = $yearLevel;

            $stmt = $this->db->raw(
                "SELECT course_code, name FROM subjects
                 WHERE level = ? AND status = 'active'
                 ORDER BY name",
                [$yearLevel]
            );
            $result['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentSubjects error: ' . $e->getMessage());
        }
        return $result;
    }

    private function getStudentSubjectsWithTeachers($userId)
    {
        $student = $this->getStudentRecordByUserId($userId);
        if (!$student || empty($student['year_level'])) {
            return $this->formatContextBlock('student_subjects', [
                'Result' => 'No student profile found for this account.'
            ]);
        }

        $subjects = $this->getStudentSubjects($userId);
        $teachers = $this->getStudentTeachers($userId);
        $teacherMap = [];
        if (!empty($teachers['subject_teachers'])) {
            foreach ($teachers['subject_teachers'] as $row) {
                $subjectName = trim((string)($row['subject'] ?? ''));
                $teacherName = trim((string)($row['teacher_name'] ?? ''));
                if ($subjectName === '' || $teacherName === '') {
                    continue;
                }
                if (!isset($teacherMap[$subjectName])) {
                    $teacherMap[$subjectName] = [];
                }
                $teacherMap[$subjectName][] = $teacherName;
            }
        }

        $lines = [
            'Grade Level' => $student['year_level'],
        ];
        if (!empty($student['section_name'])) {
            $lines['Section'] = $student['section_name'];
        }
        if (!empty($teachers['class_teacher'])) {
            $lines['Class Adviser'] = $teachers['class_teacher'];
        }

        if (!empty($subjects['items'])) {
            $subjectLines = [];
            foreach ($subjects['items'] as $sub) {
                $code = $sub['course_code'] ?? '';
                $name = $sub['name'] ?? '';
                if ($name === '' && $code === '') {
                    continue;
                }
                $label = trim(($code !== '' ? '[' . $code . '] ' : '') . $name);
                $teacherList = $teacherMap[$name] ?? [];
                $teacherLabel = '';
                if (!empty($teacherList)) {
                    $teacherLabel = ' (Teacher: ' . implode(', ', array_unique($teacherList)) . ')';
                }
                $subjectLines[] = $label . $teacherLabel;
                if (count($subjectLines) >= 12) {
                    break;
                }
            }
            $lines['Subjects'] = "\n  • " . implode("\n  • ", $subjectLines);
        } else {
            $lines['Result'] = 'No subjects found for your grade level.';
        }

        return $this->formatContextBlock('student_subjects', $lines);
    }

    private function getStudentEnrollmentStatus($userId)
    {
        try {
            $sql = "SELECT e.id, e.grade_level, e.status, e.submitted_date, e.created_at, ap.school_year, ap.quarter\n"
                 . "FROM enrollments e\n"
                 . "LEFT JOIN academic_periods ap ON e.academic_period_id = ap.id\n"
                 . "WHERE e.created_user_id = ?\n"
                 . "ORDER BY COALESCE(e.submitted_date, e.created_at) DESC\n"
                 . "LIMIT 1";
            $stmt = $this->db->raw($sql, [$userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                return $this->formatContextBlock('student_enrollment_status', [
                    'Result' => 'No enrollment record found for your account.'
                ]);
            }

            $status = $row['status'] ?? 'Unknown';
            $nextStep = 'Check your enrollment details in [link:My Enrollments|/enrollment/my-enrollments].';
            $normalizedStatus = strtolower((string)$status);
            if (in_array($normalizedStatus, ['pending', 'under review', 'review'], true)) {
                $nextStep = 'Your application is under review. Please wait for admin review or check [link:My Enrollments|/enrollment/my-enrollments].';
            } elseif (in_array($normalizedStatus, ['approved', 'accepted'], true)) {
                $nextStep = 'Your enrollment is approved. Proceed to [link:My Payment|/enrollment/payment] if payment is required.';
            } elseif (in_array($normalizedStatus, ['rejected', 'declined'], true)) {
                $nextStep = 'Your enrollment was rejected. Review details in [link:My Enrollments|/enrollment/my-enrollments] or contact admin.';
            }

            return $this->formatContextBlock('student_enrollment_status', [
                'Enrollment ID' => $row['id'] ?? 'N/A',
                'Status' => $status,
                'Grade Level' => $row['grade_level'] ?? 'N/A',
                'School Year' => $row['school_year'] ?? 'N/A',
                'Quarter' => $row['quarter'] ?? 'N/A',
                'Submitted' => $row['submitted_date'] ?? $row['created_at'] ?? 'N/A',
                'Next Step' => $nextStep,
            ]);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentEnrollmentStatus error: ' . $e->getMessage());
            return '';
        }
    }

    private function getStudentPaymentSummary($userId)
    {
        try {
            $planSql = "SELECT pp.schedule_type, pp.total_tuition, pp.total_paid, pp.balance, pp.status, ap.school_year\n"
                     . "FROM payment_plans pp\n"
                     . "LEFT JOIN academic_periods ap ON pp.academic_period_id = ap.id\n"
                     . "WHERE pp.student_id = ?\n"
                     . "ORDER BY pp.created_at DESC\n"
                     . "LIMIT 1";
            $planStmt = $this->db->raw($planSql, [$userId]);
            $plan = $planStmt->fetch(PDO::FETCH_ASSOC);

            $paymentSql = "SELECT amount, status, payment_date, created_at\n"
                        . "FROM payments\n"
                        . "WHERE student_id = ?\n"
                        . "ORDER BY COALESCE(payment_date, created_at) DESC\n"
                        . "LIMIT 1";
            $paymentStmt = $this->db->raw($paymentSql, [$userId]);
            $latest = $paymentStmt->fetch(PDO::FETCH_ASSOC);

            $lines = [];
            if ($plan) {
                $lines['Payment Plan'] = ($plan['schedule_type'] ?? 'Plan') . ' (' . ($plan['status'] ?? 'Unknown') . ')';
                $lines['School Year'] = $plan['school_year'] ?? 'N/A';
                $lines['Total Required'] = $this->formatCurrency($plan['total_tuition'] ?? null);
                $lines['Total Paid'] = $this->formatCurrency($plan['total_paid'] ?? null);
                $lines['Balance'] = $this->formatCurrency($plan['balance'] ?? null);
            } else {
                $sumStmt = $this->db->raw(
                    "SELECT SUM(amount) as total_paid FROM payments WHERE student_id = ? AND status = 'Approved'",
                    [$userId]
                );
                $sumRow = $sumStmt->fetch(PDO::FETCH_ASSOC);
                $lines['Total Paid'] = $this->formatCurrency($sumRow['total_paid'] ?? null);
                $lines['Total Required'] = 'N/A';
                $lines['Balance'] = 'N/A';
            }

            if ($latest) {
                $latestLabel = $this->formatCurrency($latest['amount'] ?? null);
                $date = $latest['payment_date'] ?? $latest['created_at'] ?? null;
                $latestLabel .= $date ? ' on ' . $date : '';
                if (!empty($latest['status'])) {
                    $latestLabel .= ' (Status: ' . $latest['status'] . ')';
                }
                $lines['Latest Payment'] = $latestLabel;
            } else {
                $lines['Latest Payment'] = 'No payment records found.';
            }

            return $this->formatContextBlock('student_payment_summary', $lines);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentPaymentSummary error: ' . $e->getMessage());
            return '';
        }
    }

    private function getStudentGrades($userId)
    {
        $student = $this->getStudentRecordByUserId($userId);
        if (!$student || empty($student['id'])) {
            return $this->formatContextBlock('student_grades', [
                'Result' => 'No student profile found for this account.'
            ]);
        }

        try {
            $sql = "SELECT fgi.final_grade_num, fgi.final_grade, fgi.remarks, fgs.quarter, fgs.status, ap.school_year,\n"
                 . "       sub.course_code, sub.name as subject_name\n"
                 . "FROM final_grade_submission_items fgi\n"
                 . "JOIN final_grade_submissions fgs ON fgs.id = fgi.submission_id\n"
                 . "LEFT JOIN academic_periods ap ON fgs.academic_period_id = ap.id\n"
                 . "LEFT JOIN subjects sub ON fgs.subject_id = sub.id\n"
                 . "WHERE fgi.student_id = ?\n"
                 . "ORDER BY fgi.created_at DESC\n"
                 . "LIMIT 12";
            $stmt = $this->db->raw($sql, [$student['id']]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if (empty($rows)) {
                return $this->formatContextBlock('student_grades', [
                    'Result' => 'No grade records are available yet.'
                ]);
            }

            $entries = [];
            foreach ($rows as $row) {
                $subject = trim((string)($row['subject_name'] ?? ''));
                $code = trim((string)($row['course_code'] ?? ''));
                $label = trim(($code !== '' ? '[' . $code . '] ' : '') . $subject);
                $grade = $row['final_grade'] ?? $row['final_grade_num'] ?? 'N/A';
                $quarter = $row['quarter'] ?? 'N/A';
                $year = $row['school_year'] ?? 'N/A';
                $entries[] = $label . ' — ' . $grade . ' (Quarter: ' . $quarter . ', SY: ' . $year . ')';
                if (count($entries) >= 12) {
                    break;
                }
            }

            return $this->formatContextBlock('student_grades', [
                'Grades' => "\n  • " . implode("\n  • ", $entries)
            ]);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentGrades error: ' . $e->getMessage());
            return '';
        }
    }

    private function getTeacherSubjects($userId)
    {
        $teacher = $this->getTeacherRecordByUserId($userId);
        if (!$teacher || empty($teacher['id'])) {
            return $this->formatContextBlock('teacher_subjects', [
                'Result' => 'No teacher profile found for this account.'
            ]);
        }

        try {
            $periodStmt = $this->db->raw("SELECT school_year FROM academic_periods WHERE status = 'active' LIMIT 1");
            $period = $periodStmt->fetch(PDO::FETCH_ASSOC);
            $schoolYear = $period['school_year'] ?? null;

            $sql = "SELECT s.course_code, s.name as subject_name, s.level, sec.name as section_name\n"
                 . "FROM teacher_subject_assignments tsa\n"
                 . "JOIN subjects s ON tsa.subject_id = s.id\n"
                 . "LEFT JOIN year_levels yl ON yl.name COLLATE utf8mb4_unicode_ci = s.level COLLATE utf8mb4_unicode_ci\n"
                 . "LEFT JOIN year_level_sections yls ON yls.year_level_id = yl.id\n"
                 . "LEFT JOIN sections sec ON sec.id = yls.section_id\n"
                 . "WHERE tsa.teacher_id = ?";
            $params = [$teacher['id']];

            if (!empty($schoolYear)) {
                $sql .= " AND tsa.school_year = ?";
                $params[] = $schoolYear;
            }

            $sql .= " ORDER BY s.course_code ASC";

            $stmt = $this->db->raw($sql, $params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if (empty($rows)) {
                return $this->formatContextBlock('teacher_subjects', [
                    'Result' => 'No subject assignments found for this teacher.'
                ]);
            }

            $entries = [];
            foreach ($rows as $row) {
                $label = trim((string)($row['subject_name'] ?? ''));
                $code = trim((string)($row['course_code'] ?? ''));
                $level = trim((string)($row['level'] ?? ''));
                $section = trim((string)($row['section_name'] ?? ''));
                $line = ($code !== '' ? '[' . $code . '] ' : '') . $label;
                if ($level !== '') {
                    $line .= ' (' . $level . ')';
                }
                if ($section !== '') {
                    $line .= ' — Section ' . $section;
                }
                $entries[] = $line;
                if (count($entries) >= 12) {
                    break;
                }
            }

            return $this->formatContextBlock('teacher_subjects', [
                'Subjects' => "\n  • " . implode("\n  • ", $entries)
            ]);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getTeacherSubjects error: ' . $e->getMessage());
            return '';
        }
    }

    private function getAdminEnrollmentSummary()
    {
        try {
            $periodStmt = $this->db->raw("SELECT id, school_year, quarter FROM academic_periods WHERE status = 'active' LIMIT 1");
            $period = $periodStmt->fetch(PDO::FETCH_ASSOC);
            if (!$period || empty($period['id'])) {
                return $this->formatContextBlock('admin_enrollment_summary', [
                    'Result' => 'No active academic period found.'
                ]);
            }

            $stmt = $this->db->raw(
                "SELECT status, COUNT(*) as total FROM enrollments WHERE academic_period_id = ? GROUP BY status",
                [$period['id']]
            );
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (empty($rows)) {
                return $this->formatContextBlock('admin_enrollment_summary', [
                    'Result' => 'No enrollments found for the current academic period.'
                ]);
            }

            $summary = [];
            $total = 0;
            foreach ($rows as $row) {
                $status = $row['status'] ?? 'Unknown';
                $count = (int)($row['total'] ?? 0);
                $summary[] = $status . ': ' . $count;
                $total += $count;
            }

            return $this->formatContextBlock('admin_enrollment_summary', [
                'School Year' => $period['school_year'] ?? 'N/A',
                'Quarter' => $period['quarter'] ?? 'N/A',
                'Total Enrollments' => $total,
                'By Status' => "\n  • " . implode("\n  • ", $summary),
            ]);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getAdminEnrollmentSummary error: ' . $e->getMessage());
            return '';
        }
    }

    private function getAdminPaymentSummary()
    {
        try {
            $today = date('Y-m-d');
            $stmt = $this->db->raw(
                "SELECT status, COUNT(*) as total, SUM(amount) as total_amount\n"
                . "FROM payments\n"
                . "WHERE DATE(COALESCE(payment_date, created_at)) = ?\n"
                . "GROUP BY status",
                [$today]
            );
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $summary = [];
            $totalPayments = 0;
            $totalAmount = 0.0;
            foreach ($rows as $row) {
                $status = $row['status'] ?? 'Unknown';
                $count = (int)($row['total'] ?? 0);
                $amount = (float)($row['total_amount'] ?? 0);
                $summary[] = $status . ': ' . $count . ' (' . $this->formatCurrency($amount) . ')';
                $totalPayments += $count;
                $totalAmount += $amount;
            }

            if (empty($summary)) {
                return $this->formatContextBlock('admin_payment_summary', [
                    'Result' => 'No payments recorded for today.'
                ]);
            }

            return $this->formatContextBlock('admin_payment_summary', [
                'Date' => $today,
                'Total Payments' => $totalPayments,
                'Total Amount' => $this->formatCurrency($totalAmount),
                'By Status' => "\n  • " . implode("\n  • ", $summary),
            ]);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getAdminPaymentSummary error: ' . $e->getMessage());
            return '';
        }
    }

    private function getAdminRfidSummary()
    {
        try {
            $today = date('Y-m-d');
            $registeredStmt = $this->db->raw(
                "SELECT COUNT(*) as total FROM students WHERE rfid_card IS NOT NULL AND TRIM(rfid_card) != ''",
                []
            );
            $registeredRow = $registeredStmt->fetch(PDO::FETCH_ASSOC);

            $scanStmt = $this->db->raw(
                "SELECT COUNT(*) as total FROM rfid_scans WHERE scan_time >= ? AND scan_time <= ?",
                [$today . ' 00:00:00', $today . ' 23:59:59']
            );
            $scanRow = $scanStmt->fetch(PDO::FETCH_ASSOC);

            $totalScanStmt = $this->db->raw(
                "SELECT COUNT(*) as total FROM rfid_scans",
                []
            );
            $totalScanRow = $totalScanStmt->fetch(PDO::FETCH_ASSOC);

            return $this->formatContextBlock('admin_rfid_summary', [
                'Date' => $today,
                'Registered Cards' => (int)($registeredRow['total'] ?? 0),
                'RFID Scans Today' => (int)($scanRow['total'] ?? 0),
                'Total RFID Scans' => (int)($totalScanRow['total'] ?? 0),
            ]);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getAdminRfidSummary error: ' . $e->getMessage());
            return '';
        }
    }

    private function getAdminPendingConcernsSummary()
    {
        try {
            $stmt = $this->db->raw(
                "SELECT status, COUNT(*) as total FROM concern_tickets GROUP BY status",
                []
            );
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (empty($rows)) {
                return $this->formatContextBlock('admin_pending_concerns', [
                    'Result' => 'No concerns found.'
                ]);
            }

            $summary = [];
            $total = 0;
            foreach ($rows as $row) {
                $status = $row['status'] ?? 'Unknown';
                $count = (int)($row['total'] ?? 0);
                $summary[] = $status . ': ' . $count;
                $total += $count;
            }

            return $this->formatContextBlock('admin_pending_concerns', [
                'Total Tickets' => $total,
                'By Status' => "\n  • " . implode("\n  • ", $summary),
            ]);
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getAdminPendingConcernsSummary error: ' . $e->getMessage());
            return '';
        }
    }

    private function getStudentLatestEnrollment($userId)
    {
        try {
            $sql  = "SELECT e.grade_level, e.status, ap.school_year, ap.quarter
                     FROM enrollments e
                     LEFT JOIN academic_periods ap ON e.academic_period_id = ap.id
                     WHERE e.created_user_id = ?
                     ORDER BY e.created_at DESC
                     LIMIT 1";
            $stmt = $this->db->raw($sql, [$userId]);
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentLatestEnrollment error: ' . $e->getMessage());
            return null;
        }
    }

    private function getStudentPaymentPlan($userId)
    {
        try {
            // Columns: total_tuition, total_paid, balance (pre-computed), schedule_type
            $sql  = "SELECT pp.schedule_type, pp.total_tuition, pp.total_paid, pp.balance, pp.status,
                            ap.school_year
                     FROM payment_plans pp
                     LEFT JOIN academic_periods ap ON pp.academic_period_id = ap.id
                     WHERE pp.student_id = ?
                     ORDER BY pp.created_at DESC
                     LIMIT 1";
            $stmt = $this->db->raw($sql, [$userId]);
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Exception $e) {
            error_log('ChatbotDbContextService::getStudentPaymentPlan error: ' . $e->getMessage());
            return null;
        }
    }
}
