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
     * @return string                 Multi-line context string (empty string if nothing relevant)
     */
    public function build($message, $role, $userId)
    {
        $lines = [];

        $isFee        = $this->mentionsFees($message);
        $isEnrollment = $this->mentionsEnrollment($message);
        $isPayment    = $this->mentionsPayment($message);
        $isPeriod     = $this->mentionsAcademicPeriod($message);
        $isTeacher    = $this->mentionsTeacher($message);
        $isSubject    = $this->mentionsSubjects($message);
        $isNavigation = $this->mentionsNavigation($message);
        $isPinIssue   = $this->mentionsPinIssue($message);
        $yearLevel    = $this->extractYearLevel($message);
        $feeType      = $this->extractFeeType($message);

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

        // ── Student enrollment status ─────────────────────────────────────────
        if ($isEnrollment && $userId && in_array($role, ['student', 'enrollee'])) {
            $enrollment = $this->getStudentLatestEnrollment($userId);
            if ($enrollment) {
                $lines[] = "Your latest enrollment: grade level \"{$enrollment['grade_level']}\", status: {$enrollment['status']}, school year: {$enrollment['school_year']}";
            } else {
                $lines[] = "No enrollment record found for your account.";
            }
        }

        // ── Student payment plan ──────────────────────────────────────────────
        if ($isPayment && $userId && $role === 'student') {
            $plan = $this->getStudentPaymentPlan($userId);
            if ($plan) {
                $lines[] = "Your payment plan ({$plan['school_year']}): schedule: {$plan['schedule_type']}, total tuition: ₱" . number_format($plan['total_tuition'], 2) . ", paid: ₱" . number_format($plan['total_paid'], 2) . ", remaining balance: ₱" . number_format($plan['balance'], 2) . ", status: {$plan['status']}";
            }
        }

        // ── Teachers for this student ────────────────────────────────────────
        if ($isTeacher && $userId && $role === 'student') {
            $teacherData = $this->getStudentTeachers($userId);
            if (!empty($teacherData['section'])) {
                $lines[] = "Your class: {$teacherData['section']} ({$teacherData['year_level']})";
            }
            if (!empty($teacherData['class_teacher'])) {
                $lines[] = "Your class teacher (adviser): {$teacherData['class_teacher']}";
            }
            if (!empty($teacherData['subject_teachers'])) {
                $lines[] = "Your subject teachers:";
                foreach ($teacherData['subject_teachers'] as $st) {
                    $lines[] = "  • {$st['teacher_name']} – {$st['subject']}";
                }
            }
            if (empty($teacherData['class_teacher']) && empty($teacherData['subject_teachers'])) {
                $lines[] = "No teacher assignments found for your grade level in the current school year.";
            }
        }

        // ── Subjects for this student ─────────────────────────────────────
        if ($isSubject && $userId && $role === 'student') {
            $subjects = $this->getStudentSubjects($userId);
            if (!empty($subjects['year_level'])) {
                $lines[] = "Your grade level: {$subjects['year_level']}";
            }
            if (!empty($subjects['items'])) {
                $lines[] = "Your subjects:";
                foreach ($subjects['items'] as $sub) {
                    $lines[] = "  • [{$sub['course_code']}] {$sub['name']}";
                }
            } else {
                $lines[] = "No subjects found for your grade level.";
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
