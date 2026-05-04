<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class ChatbotController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->model('ChatbotKnowledgeModel');
        $this->call->model('ChatbotConversationModel');
        $this->call->library('session');
        $this->call->library('ChatbotDbContextService');
        $this->call->library('ChatbotIntentRouter');
        $this->call->library('ChatbotRouteRegistry');
    }

    public function api_get_knowledge()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $search = $_GET['search'] ?? null;
            $list = $this->ChatbotKnowledgeModel->get_all($search);

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $list]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_create_knowledge()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['title']) || empty($data['content'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Title and content are required']);
                return;
            }

            $payload = [
                'title' => trim($data['title']),
                'content' => trim($data['content']),
                'tags' => $data['tags'] ?? null,
                'route' => $data['route'] ?? null,
                'is_active' => isset($data['is_active']) ? (int) !!$data['is_active'] : 1,
                'created_by' => $this->session->userdata('user_id') ?? null,
                'updated_by' => $this->session->userdata('user_id') ?? null,
            ];

            $res = $this->ChatbotKnowledgeModel->create_entry($payload);
            if ($res) {
                http_response_code(201);
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create knowledge entry']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_update_knowledge($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['title']) || empty($data['content'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Title and content are required']);
                return;
            }

            $payload = [
                'title' => trim($data['title']),
                'content' => trim($data['content']),
                'tags' => $data['tags'] ?? null,
                'route' => $data['route'] ?? null,
                'is_active' => isset($data['is_active']) ? (int) !!$data['is_active'] : 1,
                'updated_by' => $this->session->userdata('user_id') ?? null,
            ];

            $res = $this->ChatbotKnowledgeModel->update_entry($id, $payload);
            if ($res) {
                http_response_code(200);
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update knowledge entry']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_delete_knowledge($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $res = $this->ChatbotKnowledgeModel->delete_entry($id);
            if ($res) {
                http_response_code(200);
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to delete knowledge entry']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_toggle_knowledge($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: admin only']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $isActive = !empty($data['is_active']);

            $res = $this->ChatbotKnowledgeModel->toggle_active(
                $id,
                $isActive,
                $this->session->userdata('user_id') ?? null
            );

            if ($res) {
                http_response_code(200);
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update status']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function api_chat()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $message = trim($data['message'] ?? '');
            $instructions = trim($data['instructions'] ?? '');
            $role = $this->session->userdata('role') ?? 'student';
            $role = strtolower(trim((string) $role));
            $knowledgeOnly = (bool) config_item('chat_knowledge_only');
            $requestKnowledgeOnly = !empty($data['knowledge_only']);
            $knowledgeOnly = $knowledgeOnly || $requestKnowledgeOnly;

            if ($message === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Message is required']);
                return;
            }

            $intentMeta = $this->ChatbotIntentRouter->detect($message, $role);
            $intentCategory = $intentMeta['category'] ?? 'static_knowledge';
            $intentName = $intentMeta['intent'] ?? null;
            $intentParams = $intentMeta['params'] ?? [];
            $userId = $this->session->userdata('user_id') ?? null;

            if ($intentCategory === 'smalltalk_or_greeting') {
                $response = $this->buildGreetingReply($role);
                $source = 'intent';

                $this->ChatbotConversationModel->create_entry([
                    'user_id' => $userId,
                    'role' => $role,
                    'message' => $message,
                    'normalized_message' => $this->normalizeMessage($message),
                    'reply' => $response,
                    'source' => $source,
                ]);

                error_log('Chatbot source: ' . $source);

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'reply' => $response,
                    'source' => $source,
                    'intent' => $intentName,
                    'intent_category' => $intentCategory,
                    'intent_params' => $intentParams,
                ]);
                return;
            }

            if ($intentCategory === 'restricted_or_out_of_scope') {
                $response = 'I cannot access that information for your role.';
                $source = 'guard';

                $this->ChatbotConversationModel->create_entry([
                    'user_id' => $userId,
                    'role' => $role,
                    'message' => $message,
                    'normalized_message' => $this->normalizeMessage($message),
                    'reply' => $response,
                    'source' => $source,
                ]);

                error_log('Chatbot source: ' . $source);

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'reply' => $response,
                    'source' => $source,
                    'intent' => $intentName,
                    'intent_category' => $intentCategory,
                    'intent_params' => $intentParams,
                ]);
                return;
            }

            $validIntentCategories = [
                'live_data',
                'navigation',
                'static_knowledge',
                'support_troubleshooting',
                'smalltalk_or_greeting',
            ];
            $hasValidIntent = isset($intentCategory)
                && in_array($intentCategory, $validIntentCategories, true);

            // Factual questions (fees, balance, teachers, PIN, Tagalog queries) are
            // always about this school system — skip the guard entirely for them.
            if (!$hasValidIntent && !$this->isFactualQuestion($message) && !$this->isSystemQuestion($message)) {
                $response = 'I can only answer questions about the Campus Companion system. Try asking about enrollments, payments, fees, teachers, or your subjects.';
                $source = 'guard';

                $this->ChatbotConversationModel->create_entry([
                    'user_id' => $userId,
                    'role' => $role,
                    'message' => $message,
                    'normalized_message' => $this->normalizeMessage($message),
                    'reply' => $response,
                    'source' => $source,
                ]);

                error_log('Chatbot source: ' . $source);

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'reply' => $response,
                    'source' => $source,
                    'intent' => $intentName,
                    'intent_category' => $intentCategory,
                    'intent_params' => $intentParams,
                ]);
                return;
            }

            if ($role !== 'admin' && $this->isAdminRouteQuestion($message)) {
                $response = 'The admin dashboard is only available to admin accounts. If you believe you need access, please contact an administrator.';
                $source = 'guard';

                $this->ChatbotConversationModel->create_entry([
                    'user_id' => $userId,
                    'role' => $role,
                    'message' => $message,
                    'normalized_message' => $this->normalizeMessage($message),
                    'reply' => $response,
                    'source' => $source,
                ]);

                error_log('Chatbot source: ' . $source);

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'reply' => $response,
                    'source' => $source,
                    'intent' => $intentName,
                    'intent_category' => $intentCategory,
                    'intent_params' => $intentParams,
                ]);
                return;
            }

            $normalizedMessage = $this->normalizeMessage($message);
            $knowledge = $this->ChatbotKnowledgeModel->get_active_for_query($message, 5);
            $knowledge = $this->filterKnowledgeByRole($knowledge, $role);
            // PIN questions always get a structured canned reply — skip shortcut/LLM
            $pinReply = $this->buildPinReply($message);
            $response = null;
            $source = null;

            if ($intentCategory === 'smalltalk_or_greeting') {
                $response = $this->buildGreetingReply($role);
                $source = 'intent';
            } elseif ($pinReply) {
                $response = $pinReply;
                $source = 'knowledge';
            } elseif ($intentCategory === 'navigation') {
                $response = $this->buildNavigationReply($intentName, $role, $message);
                if ($response !== null) {
                    $source = 'route';
                } else {
                    $directIntents = [
                        'enrollment_approval_navigation',
                        'uniform_orders_navigation',
                        'subject_assignment_navigation',
                        'password_help',
                        'pin_help',
                    ];
                    if (in_array($intentName, $directIntents, true)) {
                        $response = 'That page is only available to the roles that can access it.';
                        $source = 'route';
                    } else {
                        $routeBlock = ChatbotRouteRegistry::buildContext($role);
                        if ($routeBlock !== '') {
                            $response = "Here are the pages you can access:\n" . $routeBlock;
                            $source = 'route';
                        }
                    }
                }
            } elseif ($intentCategory === 'live_data') {
                if ($knowledgeOnly) {
                    $response = 'I do not have that information yet. Please contact an administrator or add it to the knowledge base.';
                    $source = 'knowledge';
                } else {
                    $dbContext = $this->ChatbotDbContextService->build(
                        $message,
                        $role,
                        $userId,
                        $intentName,
                        $intentParams
                    );
                    if ($dbContext === '') {
                        $response = $this->buildNoLiveDataReply($intentName, $role);
                        $source = 'live_data';
                    } else {
                        $noKnowledgeIntents = [
                            'student_subjects',
                            'student_teacher_by_subject',
                            'teacher_subjects',
                            'teacher_advisory',
                        ];
                        $knowledgeForLive = in_array($intentName, $noKnowledgeIntents, true) ? [] : $knowledge;
                        $response = $this->callChatModel($message, $knowledgeForLive, $instructions, $dbContext);
                        $source = 'live_data';
                    }
                }
            } elseif ($intentCategory === 'support_troubleshooting') {
                $shortcut = $this->buildShortcutReply($message, $knowledge);
                if ($shortcut) {
                    $response = $shortcut;
                    $source = 'knowledge';
                } elseif ($knowledgeOnly) {
                    $response = 'I do not have that information yet. Please contact an administrator or add it to the knowledge base.';
                    $source = 'knowledge';
                } else {
                    $response = $this->callChatModel($message, $knowledge, $instructions, '');
                    $source = 'llm';
                }
            }

            if ($response === null) {
                $shortcut = $this->isFactualQuestion($message)
                    ? null
                    : $this->buildShortcutReply($message, $knowledge);

                if ($shortcut) {
                    $response = $shortcut;
                    $source = 'knowledge';
                } elseif ($knowledgeOnly) {
                    $response = 'I do not have that information yet. Please contact an administrator or add it to the knowledge base.';
                    $source = 'knowledge';
                } else {
                    $dbContext = $this->ChatbotDbContextService->build($message, $role, $userId);
                    $response = $this->callChatModel($message, $knowledge, $instructions, $dbContext);
                    $source = 'llm';
                }
            }

            $this->ChatbotConversationModel->create_entry([
                'user_id' => $userId,
                'role' => $role,
                'message' => $message,
                'normalized_message' => $normalizedMessage,
                'reply' => $response,
                'source' => $source,
            ]);

            error_log('Chatbot source: ' . $source);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'reply' => $response,
                'source' => $source,
                'intent' => $intentName,
                'intent_category' => $intentCategory,
                'intent_params' => $intentParams,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    private function normalizeMessage($message)
    {
        $value = mb_strtolower(trim($message));
        $value = preg_replace('/\s+/', ' ', $value);
        return $value;
    }

    /**
     * Returns true when the message is asking for specific data (amounts,
     * prices, status, balance, etc.). These questions must bypass the
     * knowledge-shortcut tier and go directly to the DB context + LLM.
     */
    private function isFactualQuestion($message)
    {
        $text = mb_strtolower(trim($message));
        $patterns = [
            // English — fees
            'how much', 'what is the fee', 'what are the fees',
            'what is the tuition', 'what is the cost', 'what is the price',
            'fee for', 'fees for', 'tuition for', 'tuition fee',
            'cost of', 'price of', 'total fee', 'total cost',
            // English — payment
            'my balance', 'my payment', 'remaining balance',
            'outstanding balance', 'how much do i owe', 'what is my balance',
            // English — enrollment
            'enrollment status', 'my enrollment status',
            'am i enrolled', 'what is my enrollment',
            // English — period
            'current period', 'what quarter', 'what school year',
            // English — teachers / subjects
            'who is my teacher', 'who are my teachers', 'who will be my teacher',
            'who will teach', 'who teaches', 'who handles',
            'my class teacher', 'my subject teacher', 'my adviser', 'class adviser',
            'my subject', 'my subjects', 'what subjects',
            'list of subjects', 'what are my subjects',
            // English — PIN
            'forgot pin', 'forgot my pin', 'reset pin',
            // Tagalog — fees
            'magkano', 'bayad', 'bayarin', 'matrikula',
            'gastos', 'halaga', 'presyo', 'singil',
            // Tagalog — payment / balance
            'balanse', 'natitirang bayad', 'natitira', 'hulog',
            'babayaran', 'nagbayad', 'payment ko', 'bayad ko',
            // Tagalog — enrollment
            'mag-enroll', 'enrollment ko', 'naka-enroll', 'pagpatala',
            // Tagalog — teachers / subjects
            'guro ko', 'mga guro', 'sino ang guro', 'sino ang teacher',
            'teacher ko', 'adviser ko', 'sino ang adviser',
            'mga subject ko', 'subject ko', 'anong subject',
            'mga klase ko', 'mga aralin',
            // Tagalog — PIN / navigation
            'nakalimutan', 'nalimutan', 'pin ko', 'ang pin',
        ];
        foreach ($patterns as $pattern) {
            if (mb_strpos($text, $pattern) !== false) {
                return true;
            }
        }
        return false;
    }

    private function isSystemQuestion($message)
    {
        $text = mb_strtolower($message);
        $keywords = [
            // English — system entities
            'campus companion', 'admin', 'dashboard', 'user', 'users', 'teacher', 'teachers',
            'student', 'students', 'subject', 'subjects', 'section', 'sections',
            'enrollment', 'enrollments', 'enrollee', 'payment', 'payments', 'payment plan',
            'installment', 'tuition', 'uniform', 'gcash', 'school service', 'rfid',
            'attendance', 'campus', 'campuses', 'announcement', 'announcements',
            'grading', 'grades', 'pdf', 'report', 'reports', 'feedback', 'sentiment',
            'chatbot', 'knowledge', 'settings', 'academic period', 'enrollment period',
            'document requirement', 'discount', 'penalty', 'waiver', 'schedule',
            'fee', 'fees', 'balance', 'pin', 'password', 'school year', 'quarter',
            // Tagalog — school / fees / payment
            'guro', 'estudyante', 'aralin', 'klase', 'paaralan', 'eskwelahan',
            'matrikula', 'bayad', 'bayarin', 'magkano', 'halaga', 'presyo',
            'balanse', 'hulog', 'singil', 'natitirang', 'babayaran',
            // Tagalog — enrollment / navigation
            'mag-enroll', 'naka-enroll', 'pagpatala', 'saan', 'paano', 'anong', 'nasaan',
            // Tagalog — people / account
            'subject ko', 'mga subject', 'teacher ko', 'adviser ko', 'advisor ko', 'advisory',
            'homeroom', 'class advisory', 'advisory class', 'section na adviser',
            'handled subjects', 'subject na handle', 'teacher load',
            'guro ko', 'mga guro',
            'nakalimutan', 'nalimutan', 'pin ko', 'ang pin', 'password ko',
            // Tagalog — general
            'anunsiyo', 'grado', 'attendance ko',
        ];

        foreach ($keywords as $keyword) {
            if (mb_strpos($text, $keyword) !== false) {
                return true;
            }
        }

        if (preg_match('/\/(admin|teacher|student|enrollee)\//', $text)) {
            return true;
        }

        return false;
    }

    private function isAdminRouteQuestion($message)
    {
        $text = mb_strtolower($message);
        $keywords = [
            'admin dashboard', 'admin page', 'admin panel', 'admin route',
            '/admin', 'admin portal'
        ];

        foreach ($keywords as $keyword) {
            if (mb_strpos($text, $keyword) !== false) {
                return true;
            }
        }

        return false;
    }

    private function filterKnowledgeByRole($knowledge, $role)
    {
        if (!is_array($knowledge) || empty($knowledge)) {
            return [];
        }

        $prefixes = $this->getAllowedRoutePrefixes($role);
        if ($prefixes === null) {
            return $knowledge;
        }

        $filtered = [];
        foreach ($knowledge as $item) {
            $route = trim($item['route'] ?? '');
            if ($route === '') {
                $filtered[] = $item;
                continue;
            }

            if ($this->isRouteAllowed($route, $prefixes)) {
                $filtered[] = $item;
            }
        }

        return $filtered;
    }

    private function getAllowedRoutePrefixes($role)
    {
        switch ($role) {
            case 'admin':
                return null;
            case 'teacher':
                return ['/teacher/', '/adviser/', '/admin/enrollments'];
            case 'student':
                return ['/student/', '/enrollment/', '/enrollee/'];
            case 'enrollee':
                return ['/enrollee/', '/enrollment/'];
            default:
                return [];
        }
    }

    private function isRouteAllowed($route, $prefixes)
    {
        foreach ($prefixes as $prefix) {
            if (mb_strpos($route, $prefix) === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns a guaranteed bilingual canned reply for PIN-related questions.
     * Always includes both Verify PIN and Forgot PIN as clickable route buttons.
     * Returns null when the message is not about a PIN issue.
     */
    private function buildPinReply($message)
    {
        $text = mb_strtolower(trim($message));
        $pinKeywords = [
            'forgot pin', 'forget pin', 'forgot my pin', 'lost my pin',
            'reset pin', 'change pin', 'setup pin', 'set up pin',
            'set pin', 'create pin', 'new pin', 'pin problem',
            'verify pin', 'payment pin', 'pin verification',
            'nakalimutan', 'nalimutan', 'nakalimot', 'hindi ko matandaan',
            'pin ko', 'ang pin ko', 'i-reset ang pin', 'baguhin ang pin',
        ];
        $matches = false;
        foreach ($pinKeywords as $kw) {
            if (mb_strpos($text, $kw) !== false) { $matches = true; break; }
        }
        if (!$matches) return null;

        // Determine which specific sub-scenario the user is in
        $isForgot  = mb_strpos($text, 'forgot') !== false
                  || mb_strpos($text, 'nakalimutan') !== false
                  || mb_strpos($text, 'nalimutan') !== false
                  || mb_strpos($text, 'nakalimot') !== false
                  || mb_strpos($text, 'reset') !== false
                  || mb_strpos($text, 'i-reset') !== false;
        $isSetup   = mb_strpos($text, 'setup') !== false
                  || mb_strpos($text, 'set up') !== false
                  || mb_strpos($text, 'create pin') !== false
                  || mb_strpos($text, 'new pin') !== false;

        if ($isForgot) {
            return "Nakalimutan mo ang iyong payment PIN? Narito ang dalawang paraan:\n\n"
                 . "1. I-verify muna ang iyong PIN sa [link:Verify Payment PIN|/enrollment/verify-pin] — dito mo mahahanap ang \"Forgot PIN?\" link sa ibaba ng page.\n"
                 . "2. O direkta kang pumunta sa [link:Forgot PIN|/auth/forgot-pin] para i-reset ang iyong PIN gamit ang iyong email address.\n\n"
                 . "Kung wala kang access sa iyong email, makipag-ugnayan sa admin para sa tulong.";
        }

        if ($isSetup) {
            return "Para mag-set up ng payment PIN, pumunta sa [link:Setup Payment PIN|/enrollment/setup-pin].\n\n"
                 . "Kapag na-set up na, maaari mo itong i-verify sa [link:Verify Payment PIN|/enrollment/verify-pin].\n"
                 . "Kung nakalimutan mo na ang iyong PIN, gamitin ang [link:Forgot PIN|/auth/forgot-pin].";
        }

        // Generic PIN question — show all options
        return "Para sa iyong payment PIN, narito ang mga available na pages:\n\n"
             . "• [link:Verify Payment PIN|/enrollment/verify-pin] — i-verify ang iyong kasalukuyang PIN\n"
             . "• [link:Forgot PIN|/auth/forgot-pin] — i-reset ang iyong PIN gamit ang email\n"
             . "• [link:Setup Payment PIN|/enrollment/setup-pin] — mag-set up ng bagong PIN\n\n"
             . "Kung may problema pa rin, makipag-ugnayan sa admin.";
    }

    private function buildGreetingReply($role)
    {
        switch ($role) {
            case 'admin':
                return 'Hi! I’m Jiji, your Campus Companion assistant. I can help you with admin tasks like student management, enrollments, payments, announcements, RFID attendance, reports, and chatbot knowledge.';
            case 'teacher':
                return 'Hi! I’m Jiji, your Campus Companion assistant. I can help you with your courses, class students, attendance, grades, activities, quizzes, announcements, and navigation.';
            case 'student':
                return 'Hi! I’m Jiji, your Campus Companion assistant. I can help you with your subjects, activities, quizzes, grades, enrollment status, payments, announcements, and concerns.';
            case 'enrollee':
                return 'Hi! I’m Jiji, your Campus Companion assistant. I can help you with enrollment, payment PIN verification, payment submission, requirements, and application status.';
            default:
                return 'Hi! I’m Jiji, your Campus Companion assistant. I can help you with enrollment, payments, subjects, grades, announcements, RFID attendance, reports, and navigation in the MCA portal.';
        }
    }

    private function buildNavigationReply($intentName, $role, $message)
    {
        if (empty($intentName)) {
            return null;
        }

        if ($intentName === 'password_help') {
            return $this->buildPasswordHelpReply($role, $message);
        }

        if ($intentName === 'pin_help') {
            return $this->buildPinReply($message);
        }

        $link = $this->getRouteSuggestionForIntent($intentName, $role);
        if ($link === null) {
            return null;
        }

        $isTagalog = $this->isTagalogMessage($message);
        switch ($intentName) {
            case 'subject_assignment_navigation':
                return $isTagalog
                    ? 'Sa Subject Assignment page ka mag-aassign ng subjects sa teachers at sections. ' . $link
                    : 'You can assign subjects to teachers and sections on the Subject Assignment page. ' . $link;
            case 'enrollment_approval_navigation':
                return $isTagalog
                    ? 'Sa Enrollments page ina-approve at nire-review ng admin ang enrollment applications. ' . $link
                    : 'Enrollment applications are reviewed and approved on the Enrollments page. ' . $link;
            case 'uniform_orders_navigation':
                return $isTagalog
                    ? 'Sa Uniform Orders page mino-monitor at pini-process ng admin ang uniform orders. ' . $link
                    : 'Uniform orders are managed and processed on the Uniform Orders page. ' . $link;
            case 'teacher_names_navigation':
                return $isTagalog
                    ? 'Makikita ang teacher names sa page na ito: ' . $link
                    : 'You can find teacher names on this page: ' . $link;
            default:
                return $isTagalog
                    ? 'Narito ang tamang page: ' . $link
                    : 'Use this page: ' . $link;
        }
    }

    private function buildPasswordHelpReply($role, $message)
    {
        $isTagalog = $this->isTagalogMessage($message);
        $resetLink = '[link:Forgot Password|/auth/forgot-password]';
        $settingsLink = null;
        $settingsRoute = null;

        switch ($role) {
            case 'student':
                $settingsLink = '[link:Student Settings|/student/settings]';
                $settingsRoute = '/student/settings';
                break;
            case 'teacher':
                $settingsLink = '[link:Teacher Settings|/teacher/settings]';
                $settingsRoute = '/teacher/settings';
                break;
            case 'admin':
                $settingsLink = '[link:Admin Settings|/admin/settings]';
                $settingsRoute = '/admin/settings';
                break;
        }

        $prefixes = $this->getAllowedRoutePrefixes($role);
        if ($settingsLink && $settingsRoute && $prefixes !== null && !$this->isRouteAllowed($settingsRoute, $prefixes)) {
            $settingsLink = null;
        }

        if ($isTagalog) {
            $steps = 'Pwede kang magpalit ng password gamit ang Forgot Password page: ' . $resetLink . '.';
            if ($settingsLink) {
                $steps .= ' Kung naka-login ka, pwede rin sa Settings: ' . $settingsLink . '.';
            }
            return $steps;
        }

        $steps = 'You can change your password via the Forgot Password page: ' . $resetLink . '.';
        if ($settingsLink) {
            $steps .= ' If you are logged in, you can also use Settings: ' . $settingsLink . '.';
        }
        return $steps;
    }

    private function isTagalogMessage($message)
    {
        $text = mb_strtolower((string) $message);
        $keywords = ['paano', 'saan', 'sino', 'ilan', 'magkano', 'bakit', 'ano', 'tulong', 'guro', 'adviser', 'bayad'];
        foreach ($keywords as $kw) {
            if (mb_strpos($text, $kw) !== false) {
                return true;
            }
        }
        return false;
    }

    private function buildNoLiveDataReply($intent, $role)
    {
        $suggestion = $this->getRouteSuggestionForIntent($intent, $role);
        if ($intent === 'teacher_advisory') {
            return 'Wala akong nakitang advisory section na naka-assign sa current records. Maaari mo itong i-check sa My Courses page. [link:Open My Courses|/teacher/courses]';
        }

        $response = 'No record was found for that request.';
        if ($suggestion) {
            $response .= ' You can check ' . $suggestion . '.';
        }
        return $response;
    }

    private function getRouteSuggestionForIntent($intent, $role)
    {
        $map = [
            'student_enrollment_status' => ['label' => 'My Enrollments', 'route' => '/enrollment/my-enrollments'],
            'student_payment_summary' => ['label' => 'My Payment', 'route' => '/enrollment/payment'],
            'student_subjects' => ['label' => 'My Courses', 'route' => '/student/courses'],
            'student_teachers' => ['label' => 'My Courses', 'route' => '/student/courses'],
            'student_teacher_by_subject' => ['label' => 'Open My Courses', 'route' => '/student/courses'],
            'student_grades' => ['label' => 'My Grades', 'route' => '/student/grades'],
            'student_next_payment' => ['label' => 'My Payment', 'route' => '/enrollment/payment'],
            'teacher_subjects' => ['label' => 'My Courses', 'route' => '/teacher/courses'],
            'teacher_advisory' => ['label' => 'Open My Courses', 'route' => '/teacher/courses'],
            'admin_enrollment_summary' => ['label' => 'Enrollments', 'route' => '/admin/enrollments'],
            'admin_payment_summary' => ['label' => 'Payments', 'route' => '/admin/payments'],
            'admin_rfid_summary' => ['label' => 'RFID Attendance', 'route' => '/admin/rfid-attendance'],
            'admin_pending_concerns' => ['label' => 'Concerns', 'route' => '/admin/sentiment'],
            'feedback_negative_count' => ['label' => 'Concerns', 'route' => '/admin/sentiment'],
            'enrollment_count' => ['label' => 'Enrollments', 'route' => '/admin/enrollments'],
            'payment_plan_count' => ['label' => 'Payment Plans', 'route' => '/admin/payment-plans'],
            'teacher_lookup' => ['label' => 'Subject Assignment', 'route' => '/admin/assignments'],
            'subject_assignment_navigation' => ['label' => 'Open Subject Assignment', 'route' => '/admin/assignments'],
            'enrollment_approval_navigation' => ['label' => 'Open Enrollments', 'route' => '/admin/enrollments'],
            'uniform_orders_navigation' => ['label' => 'Open Uniform Orders', 'route' => '/admin/uniform-orders'],
        ];

        if ($intent === 'teacher_names_navigation') {
            if ($role === 'admin') {
                $map[$intent] = ['label' => 'Manage Students', 'route' => '/admin/users/students'];
            } else {
                $map[$intent] = ['label' => 'My Courses', 'route' => '/student/courses'];
            }
        }

        if (empty($intent) || !isset($map[$intent])) {
            return null;
        }

        $entry = $map[$intent];
        $prefixes = $this->getAllowedRoutePrefixes($role);
        if ($prefixes !== null && !$this->isRouteAllowed($entry['route'], $prefixes)) {
            return null;
        }

        return '[link:' . $entry['label'] . '|' . $entry['route'] . ']';
    }

    private function buildShortcutReply($message, $knowledge)
    {
        if (!is_array($knowledge) || empty($knowledge)) {
            return null;
        }

        $needle = mb_strtolower(trim($message));
        if ($needle === '') {
            return null;
        }

        foreach ($knowledge as $item) {
            $title = trim($item['title'] ?? '');
            $content = trim($item['content'] ?? '');
            $route = trim($item['route'] ?? '');
            $tags = trim($item['tags'] ?? '');

            $titleLower = mb_strtolower($title);
            if ($title !== '' && (mb_strpos($needle, $titleLower) !== false || mb_strpos($titleLower, $needle) !== false)) {
                $reply = $content !== '' ? $content : $title;
                if ($route !== '') {
                    $reply .= ' [link:' . $title . '|' . $route . ']';
                }
                error_log('Chatbot shortcut match: ' . $title);
                return $reply;
            }

            if ($tags !== '') {
                $tagParts = array_filter(array_map('trim', explode(',', $tags)));
                foreach ($tagParts as $tag) {
                    $tagLower = mb_strtolower($tag);
                    if ($tag !== '' && mb_strpos($needle, $tagLower) !== false) {
                        $reply = $content !== '' ? $content : $title;
                        if ($route !== '') {
                            $reply .= ' [link:' . ($title !== '' ? $title : 'Open page') . '|' . $route . ']';
                        }
                        error_log('Chatbot shortcut match (tag): ' . $tag);
                        return $reply;
                    }
                }
            }

        }

        return null;
    }

    private function callChatModel($message, $knowledge, $instructions, $dbContext = '')
    {
        $hfToken = config_item('sentiment_hf_token');
        $hfUrl = config_item('chat_hf_url');
        $hfModel = config_item('chat_hf_model');
        $basePrompt = config_item('chat_system_prompt') ?: '';

        if (empty($hfToken)) {
            throw new Exception('Hugging Face API token not configured');
        }

        if (empty($hfUrl) || empty($hfModel)) {
            throw new Exception('Chat model not configured');
        }

        $knowledgeLines = [];
        if (is_array($knowledge)) {
            foreach ($knowledge as $item) {
                $title = trim($item['title'] ?? '');
                $content = trim($item['content'] ?? '');
                $tags = trim($item['tags'] ?? '');
                $route = trim($item['route'] ?? '');
                if ($title === '' && $content === '') {
                    continue;
                }
                $line = $title !== '' ? $title . ': ' . $content : $content;
                if ($route !== '' && $title !== '') {
                    $line .= ' Use this page: [link:' . $title . '|' . $route . ']';
                } elseif ($route !== '') {
                    $line .= ' Use this page: [link:Open page|' . $route . ']';
                }
                if ($tags !== '') {
                    $line .= ' (tags: ' . $tags . ')';
                }
                $knowledgeLines[] = $line;
            }
        }

        $systemParts = [];
        if ($basePrompt !== '') {
            $systemParts[] = $basePrompt;
        }
        if (!empty($instructions)) {
            $systemParts[] = 'Admin instructions: ' . $instructions;
        }
        if (!empty($knowledgeLines)) {
            $systemParts[] = 'Knowledge base:\n- ' . implode("\n- ", $knowledgeLines);
        }
        if (!empty($dbContext)) {
            $systemParts[] = "LIVE DATABASE CONTEXT (use these exact figures to answer — do not invent numbers):\n" . $dbContext;
            $systemParts[] = 'For current or personal data, use only the provided database context. If the context is missing, say the record was not found or direct the user to the correct page.';
        }

        $systemContent = implode("\n\n", $systemParts);
        if ($systemContent === '') {
            $systemContent = 'You are a helpful assistant for the Campus Companion system.';
        }

        // Hard cap: keep system prompt under 3500 chars to avoid model token limits
        if (mb_strlen($systemContent) > 3500) {
            $systemContent = mb_substr($systemContent, 0, 3500);
        }

        $payload = [
            'model'      => $hfModel,
            'stream'     => false,
            'max_tokens' => 512,
            'messages'   => [
                [
                    'role' => 'system',
                    'content' => $systemContent
                ],
                [
                    'role' => 'user',
                    'content' => $message
                ]
            ]
        ];

        $ch = curl_init($hfUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $hfToken"
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            throw new Exception("Chat model error: HTTP $httpCode");
        }

        $data = json_decode($response, true);
        $content = $data['choices'][0]['message']['content'] ?? '';
        $content = trim($content);

        if ($content === '') {
            throw new Exception('Empty chatbot response');
        }

        return $content;
    }
}
