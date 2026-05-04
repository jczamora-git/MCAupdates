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
                'requires_live_data' => false,
                'requires_knowledge' => false,
                'requires_route' => false,
            ];
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
                'requires_live_data' => false,
                'requires_knowledge' => false,
                'requires_route' => true,
            ];
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
                'requires_live_data' => false,
                'requires_knowledge' => true,
                'requires_route' => in_array($intent, ['password_reset', 'login_help'], true),
            ];
        }

        $intentData = $this->detectSpecificIntent($text, $role);
        if (!empty($intentData)) {
            return $intentData;
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

        $intents[] = $this->intentMatch(
            'student_enrollment_status',
            'live_data',
            ['enrollment status', 'status ng enrollment', 'approved', 'pending', 'under review', 'enrolled na ba', 'application status'],
            $text
        );

        $intents[] = $this->intentMatch(
            'student_payment_summary',
            'live_data',
            ['balance', 'remaining balance', 'outstanding', 'bayad ko', 'payment status', 'tuition balance', 'magkano'],
            $text
        );

        $intents[] = $this->intentMatch(
            'student_subjects',
            'live_data',
            ['my subjects', 'subjects ko', 'mga subject ko', 'subjects', 'courses', 'klase ko', 'class ko'],
            $text
        );

        $intents[] = $this->intentMatch(
            'student_teachers',
            'live_data',
            ['my teacher', 'teachers ko', 'sino teacher', 'sino guro', 'adviser ko', 'instructor'],
            $text
        );

        $intents[] = $this->intentMatch(
            'student_grades',
            'live_data',
            ['grades', 'grade', 'grado', 'marka', 'score', 'rating', 'final grade'],
            $text
        );

        $intents[] = $this->intentMatch(
            'teacher_subjects',
            'live_data',
            ['my courses', 'subjects i handle', 'classes i handle', 'hawak ko', 'handle ko', 'teacher subjects'],
            $text
        );

        $intents[] = $this->intentMatch(
            'admin_enrollment_summary',
            'live_data',
            ['pending enrollments', 'enrollment summary', 'enrollment stats', 'enrollment count'],
            $text
        );

        $intents[] = $this->intentMatch(
            'admin_payment_summary',
            'live_data',
            ['payment summary', 'total paid', 'pending payments', 'payment stats'],
            $text
        );

        $intents[] = $this->intentMatch(
            'admin_rfid_summary',
            'live_data',
            ['rfid scans', 'rfid attendance', 'rfid summary', 'registered card'],
            $text
        );

        $intents[] = $this->intentMatch(
            'admin_pending_concerns',
            'live_data',
            ['pending concerns', 'concern summary', 'concerns summary', 'open concerns'],
            $text
        );

        $intents[] = $this->intentMatch(
            'password_reset',
            'support_troubleshooting',
            ['password', 'forgot password', 'reset password', 'change password', 'login'],
            $text
        );

        $intents[] = $this->intentMatch(
            'teacher_grade_input',
            'static_knowledge',
            ['encode grades', 'grade input', 'class record', 'input grades'],
            $text
        );

        $intents[] = $this->intentMatch(
            'teacher_quiz_builder',
            'static_knowledge',
            ['quiz builder', 'create quiz', 'build quiz', 'activity', 'assignment'],
            $text
        );

        $intents[] = $this->intentMatch(
            'admin_reports',
            'static_knowledge',
            ['report', 'reports', 'pdf', 'export', 'print'],
            $text
        );

        $intents[] = $this->intentMatch(
            'admin_user_management',
            'static_knowledge',
            ['manage students', 'manage teachers', 'user management', 'users'],
            $text
        );

        $intents[] = $this->intentMatch(
            'announcement_help',
            'static_knowledge',
            ['announcement', 'notice', 'advisory', 'post announcement'],
            $text
        );

        $intents[] = $this->intentMatch(
            'concern_help',
            'static_knowledge',
            ['concern', 'complaint', 'report issue', 'ticket'],
            $text
        );

        foreach ($intents as $intent) {
            if (!empty($intent)) {
                return $intent;
            }
        }

        return null;
    }

    private function intentMatch($intent, $category, $keywords, $text)
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
            'requires_live_data' => $requiresLive,
            'requires_knowledge' => $requiresKnowledge,
            'requires_route' => $requiresRoute,
        ];
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
