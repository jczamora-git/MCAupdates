<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class ChatbotIntentRouter
{
    public function detect($message, $role = null)
    {
        $text = mb_strtolower(trim((string) $message));
        $role = $role ? mb_strtolower(trim((string) $role)) : null;

        $result = [
            'category' => 'static_knowledge',
            'intent' => 'general_help',
            'confidence' => 0.3,
            'keywords' => [],
            'params' => [],
            'requires_live_data' => false,
            'requires_knowledge' => true,
            'requires_route' => false,
        ];

        if ($text === '') {
            return $result;
        }

        $capabilityKeywords = [
            'what can you do', 'what can u do', 'how can you help', 'help', 'tulong',
            'ano kaya mong gawin', 'ano pwede mong gawin', 'anong kaya mo',
            'ano ginagawa mo', 'paano mo ako matutulungan', 'paano mo ako tulungan',
        ];

        $greetingKeywords = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'kumusta', 'kamusta', 'sino ka', 'who are you', 'help me',
            'jiji', 'campus companion assistant',
        ];

        if ($this->hasAny($text, $capabilityKeywords, $matched)) {
            return [
                'category' => 'smalltalk_or_greeting',
                'intent' => 'capabilities',
                'confidence' => 0.9,
                'keywords' => $matched,
                'params' => [],
                'requires_live_data' => false,
                'requires_knowledge' => false,
                'requires_route' => false,
            ];
        }

        if ($this->hasAny($text, $greetingKeywords, $matched)) {
            return [
                'category' => 'smalltalk_or_greeting',
                'intent' => 'greeting',
                'confidence' => 0.9,
                'keywords' => $matched,
                'params' => [],
                'requires_live_data' => false,
                'requires_knowledge' => false,
                'requires_route' => false,
            ];
        }

        if ($this->isRestrictedRequest($text, $role, $matched)) {
            return [
                'category' => 'restricted_or_out_of_scope',
                'intent' => 'restricted_request',
                'confidence' => 0.9,
                'keywords' => $matched,
                'params' => [],
                'requires_live_data' => false,
                'requires_knowledge' => false,
                'requires_route' => false,
            ];
        }

        if ($role === 'teacher') {
            $advisoryKeywords = [
                'advisory ko', 'ano ang advisory ko', 'ano ang handle kong advisory',
                'handle kong advisory', 'handled advisory', 'my advisory',
                'advisory class', 'class advisory', 'homeroom ko',
                'section na adviser ako', 'adviser ako', 'adviser ako saang section',
                'advisory section ko',
            ];

            if ($this->hasAny($text, $advisoryKeywords, $matched)) {
                return [
                    'category' => 'live_data',
                    'intent' => 'teacher_advisory',
                    'confidence' => 0.99,
                    'keywords' => $matched,
                    'params' => [],
                    'requires_live_data' => true,
                    'requires_knowledge' => false,
                    'requires_route' => false,
                ];
            }
        }

        $supportKeywords = [
            'cannot', "can't", 'cant', 'unable', 'error', 'issue', 'problem',
            'not working', 'ayaw', 'hindi', 'failed', 'missing', 'blocked',
            'hindi maka', 'di maka', 'cannot access', 'hindi ma-open',
        ];

        if ($this->hasAny($text, $supportKeywords, $matched)) {
            $intent = $this->detectSupportIntent($text, $matched);
            return [
                'category' => 'support_troubleshooting',
                'intent' => $intent,
                'confidence' => 0.7,
                'keywords' => $matched,
                'params' => [],
                'requires_live_data' => false,
                'requires_knowledge' => true,
                'requires_route' => in_array($intent, ['password_reset', 'login_help'], true),
            ];
        }

        $intentData = $this->detectSpecificIntent($text, $role);
        if (!empty($intentData)) {
            return $intentData;
        }

        $navigationKeywords = [
            'where', 'where can i find', 'how do i go', 'how to go', 'open page',
            'go to', 'link', 'route', 'page', 'dashboard', 'menu', 'sidebar',
            'saan', 'paano pumunta', 'pupunta', 'nasaan', 'buksan', 'open',
        ];

        if ($this->hasAny($text, $navigationKeywords, $matched)) {
            return [
                'category' => 'navigation',
                'intent' => 'navigation_route',
                'confidence' => 0.75,
                'keywords' => $matched,
                'params' => [],
                'requires_live_data' => false,
                'requires_knowledge' => false,
                'requires_route' => true,
            ];
        }

        $howToKeywords = ['how to', 'paano', 'steps', 'process', 'guide', 'instruction'];
        if ($this->hasAny($text, $howToKeywords, $matched)) {
            $result['keywords'] = $matched;
            $result['confidence'] = 0.55;
        }

        return $result;
    }

    private function detectSpecificIntent($text, $role)
    {
        $intents = [];

        $gradeLevel = $this->extractGradeLevel($text);
        $subject = $this->extractSubjectName($text);
        $dateScope = $this->extractDateScope($text);
        $enrollmentStatus = $this->extractEnrollmentStatus($text);
        $planType = $this->extractPlanType($text);
        $teacherScope = $this->extractTeacherScope($text, $gradeLevel, $subject);

        $intents[] = $this->intentMatch(
            'feedback_negative_count',
            'live_data',
            ['negative feedback', 'negative comments', 'negative sentiment', 'nagfeedback ng negative', 'feedback na negative', 'bad feedback', 'complaints negative'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'enrollment_count',
            'live_data',
            ['enrollees', 'enrollment', 'enrollments', 'nag enroll', 'nag-enroll', 'applications', 'applicants', 'ilan ang enrollees', 'ilan ang nag enroll'],
            $text,
            [
                'date_scope' => $dateScope,
                'status' => $enrollmentStatus,
            ]
        );

        $intents[] = $this->intentMatch(
            'payment_plan_count',
            'live_data',
            ['full payment', 'fully paid', 'full tuition', 'nag full payment', 'installment', 'hulugan', 'payment plan'],
            $text,
            [
                'plan_type' => $planType,
            ]
        );

        if ($role === 'student') {
            $intents[] = $this->intentMatch(
                'student_teacher_by_subject',
                'live_data',
                [
                    'sino ang teacher ko sa', 'sino teacher ko sa', 'teacher ko sa',
                    'sino guro ko sa', 'instructor ko sa', 'my teacher in',
                    'who is my', 'subject teacher',
                ],
                $text,
                [
                    'subject' => $subject,
                ]
            );
        }

        $intents[] = $this->intentMatch(
            'teacher_lookup',
            'live_data',
            ['sino ang teacher', 'teacher ko', 'teacher ng grade', 'subject teacher', 'adviser', 'class adviser', 'guro', 'teacher ng'],
            $text,
            [
                'grade_level' => $gradeLevel,
                'subject' => $subject,
                'scope' => $teacherScope,
            ]
        );

        $intents[] = $this->intentMatch(
            'student_next_payment',
            'live_data',
            ['next kong babayaran', 'next payment', 'next installment', 'susunod na bayad', 'magkano babayaran', 'installment ko', 'due payment'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'password_help',
            'navigation',
            ['palit password', 'magpalit ng password', 'magpalit password', 'change password', 'reset password', 'forgot password', 'password reset', 'login password'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'pin_help',
            'navigation',
            ['palit pin', 'magpalit ng pin', 'magpalit pin', 'change pin', 'reset pin', 'forgot pin', 'payment pin', 'verify pin'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'subject_assignment_navigation',
            'navigation',
            [
                'saan ako mag aassign ng subject for teachers', 'saan mag assign ng subject',
                'subject assignment', 'assign subject', 'assign teacher subject',
                'assign subjects to teachers', 'mag assign ng subject', 'subject for teachers',
            ],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'enrollment_approval_navigation',
            'navigation',
            [
                'saan nag aapprove ng enrollment', 'saan nag approve ng enrollment',
                'approve enrollment', 'enrollment approval', 'review enrollment',
                'enrollment applications', 'applications approval', 'saan nag approve', 'nag aapprove',
            ],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'uniform_orders_navigation',
            'navigation',
            [
                'saan nagiinput ng uniform orders', 'saan nag input ng uniform orders',
                'uniform orders', 'input uniform orders', 'uniform order',
                'process uniform orders', 'saan nagiinput ng uniform',
            ],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'teacher_names_navigation',
            'navigation',
            ['names ng teacher', 'teacher names', 'mga names ng teacher', 'saan makikita ang teacher'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'student_enrollment_status',
            'live_data',
            ['enrollment status', 'status ng enrollment', 'approved', 'pending', 'under review', 'enrolled na ba', 'application status'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'student_payment_summary',
            'live_data',
            ['balance', 'remaining balance', 'outstanding', 'bayad ko', 'payment status', 'tuition balance', 'magkano'],
            $text,
            []
        );

        if ($role === 'student') {
            $intents[] = $this->intentMatch(
                'student_subjects',
                'live_data',
                [
                    'ano ang mga subjects ko', 'ano subjects ko', 'anong subjects ko',
                    'my subjects', 'subjects ko', 'courses ko', 'mga subject ko',
                    'enrolled subjects', 'current subjects', 'mga klase ko',
                    'asignatura ko', 'subjects', 'courses', 'klase ko', 'class ko',
                ],
                $text,
                []
            );
        }

        $intents[] = $this->intentMatch(
            'student_teachers',
            'live_data',
            ['my teacher', 'teachers ko', 'sino teacher', 'sino guro', 'adviser ko', 'instructor'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'student_grades',
            'live_data',
            ['grades', 'grade', 'grado', 'marka', 'score', 'rating', 'final grade'],
            $text,
            []
        );

        if ($role === 'teacher') {
            $intents[] = $this->intentMatch(
                'teacher_advisory',
                'live_data',
                [
                    'ano ang advisory ko', 'advisory ko', 'adviser ako saang section',
                    'advisory section ko', 'class advisory', 'homeroom ko',
                    'section na adviser ako', 'my advisory class', 'what is my advisory',
                ],
                $text,
                []
            );

            $intents[] = $this->intentMatch(
                'teacher_subjects',
                'live_data',
                [
                    'ano ang mga subject na handle ko', 'ano subjects na handle ko',
                    'subject na handle ko', 'subjects ko as teacher', 'my handled subjects',
                    'classes ko', 'ano classes ko', 'teaching load', 'assigned subjects',
                    'mga hawak kong subject', 'hawak ko na subject', 'my courses',
                    'subjects i handle', 'classes i handle', 'hawak ko', 'handle ko', 'teacher subjects',
                ],
                $text,
                []
            );
        }

        $intents[] = $this->intentMatch(
            'admin_enrollment_summary',
            'live_data',
            ['pending enrollments', 'enrollment summary', 'enrollment stats', 'enrollment count'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'admin_payment_summary',
            'live_data',
            ['payment summary', 'total paid', 'pending payments', 'payment stats'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'admin_rfid_summary',
            'live_data',
            ['rfid scans', 'rfid attendance', 'rfid summary', 'registered card'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'admin_pending_concerns',
            'live_data',
            ['pending concerns', 'concern summary', 'concerns summary', 'open concerns'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'password_reset',
            'support_troubleshooting',
            ['password', 'forgot password', 'reset password', 'change password', 'login'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'teacher_grade_input',
            'static_knowledge',
            ['encode grades', 'grade input', 'class record', 'input grades'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'teacher_quiz_builder',
            'static_knowledge',
            ['quiz builder', 'create quiz', 'build quiz', 'activity', 'assignment'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'admin_reports',
            'static_knowledge',
            ['report', 'reports', 'pdf', 'export', 'print'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'admin_user_management',
            'static_knowledge',
            ['manage students', 'manage teachers', 'user management', 'users'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'announcement_help',
            'static_knowledge',
            ['announcement', 'notice', 'advisory', 'post announcement'],
            $text,
            []
        );

        $intents[] = $this->intentMatch(
            'concern_help',
            'static_knowledge',
            ['concern', 'complaint', 'report issue', 'ticket'],
            $text,
            []
        );

        foreach ($intents as $intent) {
            if (!empty($intent)) {
                return $intent;
            }
        }

        return null;
    }

    private function intentMatch($intent, $category, $keywords, $text, $params = [])
    {
        if (!$this->hasAny($text, $keywords, $matched)) {
            return null;
        }

        $requiresLive = $category === 'live_data';
        $requiresKnowledge = $category === 'static_knowledge' || $category === 'support_troubleshooting';
        $requiresRoute = $category === 'navigation';

        return [
            'category' => $category,
            'intent' => $intent,
            'confidence' => 0.8,
            'keywords' => $matched,
            'params' => is_array($params) ? $params : [],
            'requires_live_data' => $requiresLive,
            'requires_knowledge' => $requiresKnowledge,
            'requires_route' => $requiresRoute,
        ];
    }

    private function extractGradeLevel($text)
    {
        $map = [
            'nursery 1' => 'Nursery 1',
            'nursery1' => 'Nursery 1',
            'nursery 2' => 'Nursery 2',
            'nursery2' => 'Nursery 2',
            'kinder' => 'Kinder',
            'kindergarten' => 'Kinder',
            'grade 1' => 'Grade 1',
            'grade1' => 'Grade 1',
            'grade 2' => 'Grade 2',
            'grade2' => 'Grade 2',
            'grade 3' => 'Grade 3',
            'grade3' => 'Grade 3',
            'grade 4' => 'Grade 4',
            'grade4' => 'Grade 4',
            'grade 5' => 'Grade 5',
            'grade5' => 'Grade 5',
            'grade 6' => 'Grade 6',
            'grade6' => 'Grade 6',
        ];

        foreach ($map as $needle => $label) {
            if (mb_strpos($text, $needle) !== false) {
                return $label;
            }
        }

        return null;
    }

    private function extractSubjectName($text)
    {
        $subjects = [
            'english' => 'English',
            'language' => 'Language',
            'reading' => 'Reading',
            'filipino' => 'Filipino',
            'math' => 'Math',
            'mathematics' => 'Math',
            'science' => 'Science',
            'gmrc' => 'GMRC',
            'araling panlipunan' => 'Araling Panlipunan',
            'ap' => 'Araling Panlipunan',
            'makabansa' => 'Makabansa',
        ];

        foreach ($subjects as $needle => $label) {
            if (mb_strpos($text, $needle) !== false) {
                return $label;
            }
        }

        return null;
    }

    private function extractDateScope($text)
    {
        $todayKeywords = ['today', 'ngayong araw', 'ngayon', 'this day'];
        foreach ($todayKeywords as $kw) {
            if (mb_strpos($text, $kw) !== false) {
                return 'today';
            }
        }

        $periodKeywords = ['current period', 'school year', 'this period', 'current year'];
        foreach ($periodKeywords as $kw) {
            if (mb_strpos($text, $kw) !== false) {
                return 'current_period';
            }
        }

        return 'all';
    }

    private function extractEnrollmentStatus($text)
    {
        $map = [
            'pending' => 'pending',
            'approved' => 'approved',
            'accepted' => 'approved',
            'rejected' => 'rejected',
            'declined' => 'rejected',
            'under review' => 'under_review',
            'review' => 'under_review',
        ];

        foreach ($map as $needle => $status) {
            if (mb_strpos($text, $needle) !== false) {
                return $status;
            }
        }

        return 'all';
    }

    private function extractPlanType($text)
    {
        if (mb_strpos($text, 'installment') !== false || mb_strpos($text, 'hulugan') !== false) {
            return 'installment';
        }

        if (mb_strpos($text, 'full') !== false || mb_strpos($text, 'buo') !== false) {
            return 'full';
        }

        return null;
    }

    private function extractTeacherScope($text, $gradeLevel, $subject)
    {
        if (mb_strpos($text, 'adviser') !== false || mb_strpos($text, 'class adviser') !== false) {
            return 'adviser';
        }

        if (!empty($gradeLevel) && !empty($subject)) {
            return 'grade_subject_teacher';
        }

        if (mb_strpos($text, 'teacher ko') !== false || mb_strpos($text, 'my teacher') !== false) {
            return 'own_student_teacher';
        }

        return 'grade_subject_teacher';
    }

    private function detectSupportIntent($text, array &$matched)
    {
        $passwordKeywords = ['password', 'forgot password', 'reset password', 'login', 'cannot login', 'cant login', 'hindi makalogin'];
        if ($this->hasAny($text, $passwordKeywords, $match)) {
            $matched = array_values(array_unique(array_merge($matched, $match)));
            return 'password_reset';
        }

        return 'support_troubleshooting';
    }

    private function isRestrictedRequest($text, $role, array &$matched)
    {
        $matched = [];
        if (empty($role)) {
            return false;
        }

        $adminOnlyKeywords = [
            'admin', 'admin summary', 'all students', 'all payments', 'all enrollments',
            'student list', 'payment summary', 'enrollment summary', 'rfid summary',
            'enrollees', 'enrollment count', 'payment plan', 'full payment', 'installment',
            'negative feedback', 'negative sentiment', 'feedback count',
        ];

        if ($role !== 'admin' && $this->hasAny($text, $adminOnlyKeywords, $matched)) {
            return true;
        }

        $otherUserKeywords = [
            'other student', 'another student', 'student payment', 'student grades',
            'show student', 'view student', 'somebody else', 'ibang student',
        ];

        if (in_array($role, ['student', 'enrollee'], true) && $this->hasAny($text, $otherUserKeywords, $matched)) {
            return true;
        }

        return false;
    }

    private function hasAny($text, array $keywords, &$matched = null)
    {
        $matched = [];
        foreach ($keywords as $kw) {
            $kw = trim((string) $kw);
            if ($kw === '') {
                continue;
            }
            if (mb_strpos($text, mb_strtolower($kw)) !== false) {
                $matched[] = $kw;
            }
        }

        return !empty($matched);
    }
}
