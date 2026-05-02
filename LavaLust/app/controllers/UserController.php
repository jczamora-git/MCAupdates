<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class UserController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->database();
        $this->call->model('UserModel');
        $this->call->model('AcademicPeriodModel');
        $this->call->library('session');
    }

    public function register()
    {
        if ($this->io->method() === 'post') {
            $userData = [
                'email' => $this->io->post('email'),
                'password' => $this->io->post('password'),
                'first_name' => $this->io->post('first_name'),
                'middle_name' => $this->io->post('middle_name'),
                'last_name' => $this->io->post('last_name'),
                'phone' => $this->io->post('phone'),
                'role' => $this->io->post('role', 'student'),
                'status' => 'active'
            ];

            // Basic validation
            if (empty($userData['email']) || empty($userData['password']) || 
                empty($userData['first_name']) || empty($userData['last_name'])) {
                $this->session->set_flashdata('error', 'All required fields must be filled out');
                redirect('auth/register');
                return;
            }

            // Validate email format
            if (!filter_var($userData['email'], FILTER_VALIDATE_EMAIL)) {
                $this->session->set_flashdata('error', 'Invalid email format');
                redirect('auth/register');
                return;
            }

            // Check password length
            if (strlen($userData['password']) < 6) {
                $this->session->set_flashdata('error', 'Password must be at least 6 characters long');
                redirect('auth/register');
                return;
            }

            // Check if email exists
            if ($this->UserModel->email_exists($userData['email'])) {
                $this->session->set_flashdata('error', 'Email is already registered');
                redirect('auth/register');
                return;
            }

            // Create user
            $userId = $this->UserModel->create($userData);

            if ($userId) {
                $this->session->set_flashdata('success', 'Registration successful! Please login.');
                redirect('auth/login');
            } else {
                $this->session->set_flashdata('error', 'Registration failed. Please try again.');
                redirect('auth/register');
            }
        }

        // Load registration view
        $data = [
            'error' => $this->session->flashdata('error'),
            'success' => $this->session->flashdata('success')
        ];
        $this->call->view('auth/register', $data);
    }

    public function login()
    {
        if ($this->io->method() === 'post') {
            $email = $this->io->post('email');
            $password = $this->io->post('password');

            // Basic validation
            if (empty($email) || empty($password)) {
                $this->session->set_flashdata('error', 'Email and password are required');
                redirect('auth/login');
                return;
            }

            // Verify credentials
            $user = $this->UserModel->verify_credentials($email, $password);

            if ($user) {
                // Set session data
                $this->session->set_userdata([
                    'user_id' => $user['id'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'logged_in' => true
                ]);

                // Redirect based on role
                switch($user['role']) {
                    case 'admin':
                        redirect('admin/dashboard');
                        break;
                    case 'teacher':
                        redirect('teacher/dashboard');
                        break;
                    case 'student':
                        redirect('student/dashboard');
                        break;
                    default:
                        redirect('dashboard');
                }
            } else {
                $this->session->set_flashdata('error', 'Invalid email or password');
                redirect('auth/login');
            }
        }

        // Load login view
        $data = [
            'error' => $this->session->flashdata('error'),
            'success' => $this->session->flashdata('success')
        ];
        $this->call->view('auth/login', $data);
    }

    public function logout()
    {
        $this->session->sess_destroy();
        redirect('auth/login');
    }

    // API Methods for JSON endpoints
    public function api_register()
    {
         api_set_json_headers();
        
        try {
            // Get raw POST data and decode JSON
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            // Extract data
            $email = $json_data['email'] ?? '';
            $password = $json_data['password'] ?? '';
            $first_name = $json_data['first_name'] ?? '';
            $middle_name = $json_data['middle_name'] ?? '';
            $last_name = $json_data['last_name'] ?? '';
            $phone = $json_data['phone'] ?? '';
            $role = $json_data['role'] ?? 'student';
            
            // Validation
            if (empty($email) || empty($password) || empty($first_name) || empty($last_name)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email, password, first name, and last name are required'
                ]);
                return;
            }
            
            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email format'
                ]);
                return;
            }
            
            // Check password length
            if (strlen($password) < 6) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Password must be at least 6 characters long'
                ]);
                return;
            }
            
            // Check if email exists
            if ($this->UserModel->email_exists($email)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already registered'
                ]);
                return;
            }
            
            // Prepare user data
            // Both students and enrollees need email verification
            $userStatus = 'pending';
            
            $userData = [
                'email' => $email,
                'password' => $password,
                'first_name' => $first_name,
                'middle_name' => $middle_name,
                'last_name' => $last_name,
                'phone' => $phone,
                'role' => $role,
                'status' => $userStatus // All users: pending until email verified
            ];
            
            // Create user
            $userId = $this->UserModel->create($userData);
            
            if ($userId) {
                // If role is student, create student profile with auto-generated ID
                if ($role === 'student') {
                    $this->call->model('StudentModel');

                    // Determine start year from active academic period
                    $period = $this->AcademicPeriodModel->get_active_period();
                    $currentYear = date('Y');
                    if ($period && !empty($period['school_year'])) {
                        $parts = explode('-', $period['school_year']);
                        if (count($parts) > 0) $currentYear = $parts[0];
                    }
                    
                    // Create student record with auto-generated ID
                    $studentData = [
                        'user_id' => $userId,
                        'year_level' => 1, // Default to first year
                        'section_id' => null,
                        'status' => 'pending', // Pending until verified
                        'created_at' => app_now(),
                        'updated_at' => app_now()
                    ];
                    
                    // Use StudentModel safe creation to avoid duplicate IDs under concurrency
                    $createdStudent = $this->StudentModel->create_student_with_generated_id($studentData, $currentYear);
                    if (!$createdStudent) {
                        error_log('Failed to create student profile for user ID: ' . $userId);
                    }
                }
                
                // Handle verification - all users need email verification
                // But enrollees will verify through the dashboard, not automatically
                $this->call->helper('mail');
                $this->call->helper('email_templates');
                $this->call->helper('token');
                
                // Only send verification email for non-enrollee roles
                // Enrollees will manually trigger verification from their dashboard
                $emailResult = ['success' => true, 'message' => 'Email not sent for enrollees (manual trigger)'];
                
                if ($role !== 'enrollee') {
                    // Generate verification URL with encrypted token
                    $portalUrl = config_item('portal_url');
                    $verificationUrl = generate_verification_url($userId, $email, $portalUrl);
                    
                    $verificationSubject = 'Verify Your Email - Maranatha';
                    $verificationBody = generate_verification_email($first_name, $verificationUrl, 24);
                    
                    $emailResult = sendNotif($email, $verificationSubject, $verificationBody);
                    
                    if (!$emailResult['success']) {
                        // Log email failure but don't fail the registration
                        error_log('Failed to send verification email to: ' . $email . ' - ' . $emailResult['message']);
                    }
                }
                
                // Get user data (without password)
                $user = $this->UserModel->find_by_id($userId);
                unset($user['password']);
                
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Account created successfully! Please check your email to verify your account.',
                    'requires_verification' => true,
                    'user' => $user,
                    'email_result' => $emailResult
                    ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create user'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    public function api_login()
    {
         api_set_json_headers();
        
        try {
            // Get raw POST data and decode JSON
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            // Use JSON data if available, otherwise fall back to $_POST
            $email = $json_data['email'] ?? $this->io->post('email');
            $password = $json_data['password'] ?? $this->io->post('password');
            
            // Validation
            if (empty($email) || empty($password)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email and password are required'
                ]);
                return;
            }
            
            // First check if user exists and get their status
            $userCheck = $this->UserModel->find_by_email($email);
            
            if ($userCheck && $userCheck['status'] === 'pending' && $userCheck['role'] !== 'enrollee') {
                // User exists but email not verified (block non-enrollees)
                // Enrollees are allowed to login with pending status
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'Please verify your email address before logging in. Check your inbox for the verification link.',
                    'requires_verification' => true,
                    'email' => $email
                ]);
                return;
            }
            
            // Verify credentials
            $user = $this->UserModel->verify_credentials($email, $password);
            
            if (!$user) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email or password'
                ]);
                return;
            }
            
            // Update last login
            $this->UserModel->update_last_login($user['id']);
            
            // Set session data
            $this->session->set_userdata([
                'user_id' => $user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name'],
                'logged_in' => true
            ]);
            
            // Return success response
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => $user
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Check if a student email exists and if password is set
     * POST /api/auth/check-student
     */
    public function api_check_student()
    {
        api_set_json_headers();
        
        try {
            // Get raw POST data
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            $email = $json_data['email'] ?? $this->io->post('email');
            
            if (empty($email)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email is required'
                ]);
                return;
            }
            
            // Find user by email
            $user = $this->UserModel->find_by_email($email);
            
            if (!$user || $user['role'] !== 'student') {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student account not found with this email'
                ]);
                return;
            }
            
            // Check if password is set (not empty/null)
            $passwordIsSet = !empty($user['password']);
            
            // Get student details with section name using JOIN
            $studentId = null;
            $yearLevel = null;
            $sectionName = null;
            
            $query = "SELECT s.student_id, s.year_level, sec.name AS section_name 
                     FROM students s 
                     LEFT JOIN sections sec ON s.section_id = sec.id 
                     WHERE s.user_id = ?";
            
            $studentResults = $this->db->raw($query, [$user['id']])->fetchAll(\PDO::FETCH_ASSOC);
            
            if (is_array($studentResults) && isset($studentResults[0])) {
                $studentData = $studentResults[0];
                $studentId = $studentData['student_id'] ?? null;
                $yearLevel = $studentData['year_level'] ?? null;
                $sectionName = $studentData['section_name'] ?? null;
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Student account found',
                'student_found' => true,
                'password_set' => $passwordIsSet,
                'user_id' => $user['id'],
                'email' => $user['email'],
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name'],
                'student_id' => $studentId,
                'year_level' => $yearLevel,
                'section' => $sectionName
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Set password for a student (first-time setup)
     * POST /api/auth/set-password
     */
    public function api_set_password()
    {
        api_set_json_headers();
        
        try {
            // Get raw POST data
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            $email = $json_data['email'] ?? $this->io->post('email');
            $password = $json_data['password'] ?? $this->io->post('password');
            
            // Validation
            if (empty($email) || empty($password)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email and password are required'
                ]);
                return;
            }
            
            // Check password length
            if (strlen($password) < 6) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Password must be at least 6 characters long'
                ]);
                return;
            }
            
            // Find user by email
            $user = $this->UserModel->find_by_email($email);
            
            if (!$user || $user['role'] !== 'student') {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student account not found with this email'
                ]);
                return;
            }
            
            // Update password
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $updated = $this->UserModel->update($user['id'], [
                'password' => $hashedPassword
            ]);
            
            if (!$updated) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to set password. Please try again.'
                ]);
                return;
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Password set successfully',
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name']
                ]
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * API: Validate set password token
     * POST /api/auth/validate-set-password-token
     * Body JSON: { token }
     */
    public function api_validate_set_password_token()
    {
        api_set_json_headers();

        try {
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);

            $token = isset($json_data['token']) ? trim($json_data['token']) : '';

            if (empty($token)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token is required.']);
                return;
            }

            // Find token record with account_setup type
            $reset = $this->db->table('password_resets')
                ->where('token', $token)
                ->where('type', 'account_setup')
                ->get();

            if (!$reset) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid token.']);
                return;
            }

            // Check if already used
            if ((int)$reset['used'] === 1) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token has already been used.']);
                return;
            }

            // Check expiry
            $expiresAt = strtotime($reset['expires_at']);
            if ($expiresAt === false || $expiresAt < time()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token has expired.']);
                return;
            }

            // Get user info
            $user = $this->UserModel->find($reset['user_id']);
            if (!$user) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found.']);
                return;
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'role' => $user['role']
                ]
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * API: Set password with token (for account setup)
     * POST /api/auth/set-password
     * Body JSON: { token, password }
     */
    public function api_set_password_with_token()
    {
        api_set_json_headers();

        try {
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);

            $token = isset($json_data['token']) ? trim($json_data['token']) : '';
            $password = isset($json_data['password']) ? $json_data['password'] : '';

            if (empty($token) || empty($password)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token and password are required.']);
                return;
            }

            // Validate password strength
            if (strlen($password) < 8) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters long.']);
                return;
            }

            if (!preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Password must contain at least one uppercase letter, one lowercase letter, and one number.']);
                return;
            }

            // Find token record with account_setup type
            $reset = $this->db->table('password_resets')
                ->where('token', $token)
                ->where('type', 'account_setup')
                ->get();

            if (!$reset) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid token.']);
                return;
            }

            // Check if already used
            if ((int)$reset['used'] === 1) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token has already been used.']);
                return;
            }

            // Check expiry
            $expiresAt = strtotime($reset['expires_at']);
            if ($expiresAt === false || $expiresAt < time()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token has expired.']);
                return;
            }

            // Get user
            $user = $this->UserModel->find($reset['user_id']);
            if (!$user) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found.']);
                return;
            }

            // Update password
            $updated = $this->UserModel->update_user($user['id'], ['password' => $password]);

            if (!$updated) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to set password.']);
                return;
            }

            // Mark token as used
            $this->db->table('password_resets')->where('id', $reset['id'])->update([
                'used' => 1,
                'updated_at' => app_now()
            ]);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Password set successfully.',
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'role' => $user['role']
                ]
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Verify email address using encrypted token
     * GET /api/users/verify-email?token=xxx
     */
    public function api_verify_email()
    {
        api_set_json_headers();
        
        try {
            $token = $_GET['token'] ?? '';
            
            if (empty($token)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Verification token is required'
                ]);
                return;
            }
            
            // Load token helper and verify
            $this->call->helper('token');
            $payload = verify_token($token);
            
            if (!$payload) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid or expired verification link. Please request a new one.'
                ]);
                return;
            }
            
            $userId = $payload['user_id'];
            $email = $payload['email'];
            
            error_log('Email verification attempt - User ID: ' . $userId . ', Email: ' . $email);
            
            // Find the user
            $user = $this->UserModel->find_by_id($userId);
            
            if (!$user) {
                error_log('User not found for ID: ' . $userId . '. Token payload: ' . json_encode($payload));
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found'
                ]);
                return;
            }
            
            // Verify email matches
            if ($user['email'] !== $email) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email mismatch. Please request a new verification link.'
                ]);
                return;
            }
            
            // Check if already verified
            if ($user['status'] === 'active') {
                echo json_encode([
                    'success' => true,
                    'message' => 'Email already verified. You can now log in.',
                    'already_verified' => true,
                    'user' => [
                        'email' => $user['email'],
                        'first_name' => $user['first_name'],
                        'role' => $user['role']
                    ]
                ]);
                return;
            }
            
            // Update user status to active
            $updated = $this->UserModel->update_user($userId, ['status' => 'active']);
            
            if (!$updated) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to verify email. Please try again.'
                ]);
                return;
            }
            
            // Also update student record if exists
            $this->db->table('students')
                ->where('user_id', $userId)
                ->update(['status' => 'active', 'updated_at' => app_now()]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Email verified successfully! You can now set your password.',
                'user' => [
                    'email' => $user['email'],
                    'first_name' => $user['first_name'],
                    'role' => $user['role']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Email verification error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Resend verification email
     * POST /api/users/resend-verification
     */
    public function api_resend_verification()
    {
        api_set_json_headers();
        
        try {
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            $email = $json_data['email'] ?? '';
            
            if (empty($email)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email is required'
                ]);
                return;
            }
            
            error_log('Resend verification requested for email: ' . $email);
            
            // Find the user
            $user = $this->UserModel->find_by_email($email);
            
            if (!$user) {
                error_log('User not found for email: ' . $email);
                // Don't reveal if email exists for security
                echo json_encode([
                    'success' => true,
                    'message' => 'If this email is registered, a verification link has been sent.'
                ]);
                return;
            }
            
            error_log('Found user for email: ' . $email . ', User ID: ' . $user['id']);
            
            // Check if already verified
            if ($user['status'] === 'active') {
                echo json_encode([
                    'success' => true,
                    'message' => 'This email is already verified. You can log in.',
                    'already_verified' => true
                ]);
                return;
            }
            
            // Send new verification email
            $this->call->helper('mail');
            $this->call->helper('email_templates');
            $this->call->helper('token');
            
            $portalUrl = config_item('portal_url');
            error_log('Portal URL: ' . $portalUrl);
            $verificationUrl = generate_verification_url($user['id'], $email, $portalUrl);
            error_log('Generated verification URL: ' . $verificationUrl);
            
            $verificationSubject = 'Verify Your Email - Maranatha';
            $verificationBody = generate_verification_email($user['first_name'], $verificationUrl, 24);
            
            $emailResult = sendNotif($email, $verificationSubject, $verificationBody);
            error_log('Email send result: ' . json_encode($emailResult));
            
            echo json_encode([
                'success' => true,
                'message' => 'Verification email sent! Please check your inbox.',
                'email_sent' => $emailResult['success']
            ]);
            
        } catch (Exception $e) {
            error_log('Resend verification error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error'
            ]);
        }
    }

    public function api_logout()
    {
         api_set_json_headers();
        
        try {
            // Destroy session
            $this->session->sess_destroy();
            
            echo json_encode([
                'success' => true,
                'message' => 'Logged out successfully'
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    public function me()
    {
         api_set_json_headers();
        
        // Check if user is logged in
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Not authenticated'
            ]);
            return;
        }
        
        // Get user data from database
        $userId = $this->session->userdata('user_id');
        $user = $this->UserModel->find_by_id($userId);
        
        if (!$user) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'User not found'
            ]);
            return;
        }
        
        // Remove sensitive data
        unset($user['password']);
        
        echo json_encode([
            'success' => true,
            'user' => $user
        ]);
    }

    public function check()
    {
        api_set_json_headers();
        
        try {
            $isAuthenticated = $this->session->userdata('logged_in') === true;
            
            $userData = null;
            if ($isAuthenticated) {
                // Get user data from session and database
                $user_id = $this->session->userdata('user_id');
                
                if ($user_id) {
                    // Use the UserModel instead of direct DB query
                    $user = $this->UserModel->find($user_id);
                    
                    if ($user) {
                        $userData = [
                            'id' => $user['id'],
                            'email' => $user['email'],
                            'role' => $user['role'],
                            'first_name' => $user['first_name'],
                            'middle_name' => $user['middle_name'] ?? null,
                            'last_name' => $user['last_name'],
                            'status' => $user['status'],
                            'profile_photo_path' => $user['profile_photo_path'] ?? null,
                            'payment_pin_set' => !empty($user['payment_pin_hash'])
                        ];
                    }
                }
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'authenticated' => $isAuthenticated && $userData !== null,
                'user' => $userData
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'authenticated' => false,
                'user' => null,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update authenticated user's own profile
     * PUT /api/auth/profile
     */
    public function api_update_my_profile()
    {
         api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $userId = (int) $this->session->userdata('user_id');
            $role = (string) $this->session->userdata('role');
            $existingUser = $this->UserModel->find_by_id($userId);

            if (!$existingUser) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found'
                ]);
                return;
            }

            $rawInput = file_get_contents('php://input');
            $jsonData = json_decode($rawInput, true);
            if (!is_array($jsonData)) {
                $jsonData = [];
            }

            $updateData = [];

            if (array_key_exists('first_name', $jsonData)) {
                $firstName = trim((string) $jsonData['first_name']);
                if ($firstName === '') {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'First name is required'
                    ]);
                    return;
                }
                $updateData['first_name'] = $firstName;
            }

            if (array_key_exists('middle_name', $jsonData)) {
                $middleName = trim((string) $jsonData['middle_name']);
                $updateData['middle_name'] = $middleName === '' ? null : $middleName;
            }

            if (array_key_exists('last_name', $jsonData)) {
                $lastName = trim((string) $jsonData['last_name']);
                if ($lastName === '') {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Last name is required'
                    ]);
                    return;
                }
                $updateData['last_name'] = $lastName;
            }

            if (array_key_exists('phone', $jsonData)) {
                $phone = trim((string) $jsonData['phone']);
                if ($phone !== '' && !preg_match('/^\d{11}$/', $phone)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Phone number must be exactly 11 digits'
                    ]);
                    return;
                }
                $updateData['phone'] = $phone;
            }

            if (!empty($updateData)) {
                $updated = $this->UserModel->update_user($userId, $updateData);
                if (!$updated) {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to update profile'
                    ]);
                    return;
                }
            }

            $studentProfile = null;
            if ($role === 'student' && array_key_exists('gender', $jsonData)) {
                $this->call->model('StudentModel');
                $studentProfile = $this->StudentModel->get_by_user_id($userId);

                if ($studentProfile) {
                    $incomingGender = $jsonData['gender'];
                    $gender = null;
                    if ($incomingGender !== null) {
                        $incomingGender = trim((string) $incomingGender);
                        if ($incomingGender !== '' && !in_array($incomingGender, ['Male', 'Female'])) {
                            http_response_code(400);
                            echo json_encode([
                                'success' => false,
                                'message' => 'Gender must be Male or Female'
                            ]);
                            return;
                        }
                        $gender = $incomingGender === '' ? null : $incomingGender;
                    }

                    $this->StudentModel->update($studentProfile['id'], [
                        'gender' => $gender,
                        'updated_at' => app_now()
                    ]);

                    $studentProfile = $this->StudentModel->get_by_user_id($userId);
                }
            } else if ($role === 'student') {
                $this->call->model('StudentModel');
                $studentProfile = $this->StudentModel->get_by_user_id($userId);
            }

            $user = $this->UserModel->find_by_id($userId);
            unset($user['password']);

            $this->session->set_userdata([
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name']
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Profile updated successfully',
                'user' => $user,
                'student' => $studentProfile
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    // ===================================
    // USER MANAGEMENT API ENDPOINTS
    // ===================================
    
    /**
     * Get all users with optional filters
     * GET /api/users
     */
    public function api_get_users()
    {
         api_set_json_headers();
        
        // Debug: Log session data
        error_log("Session data: " . json_encode([
            'logged_in' => $this->session->userdata('logged_in'),
            'role' => $this->session->userdata('role'),
            'user_id' => $this->session->userdata('user_id'),
            'session_id' => session_id()
        ]));
        
        // Check if user is admin
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.',
                'debug' => [
                    'logged_in' => $this->session->userdata('logged_in'),
                    'role' => $this->session->userdata('role')
                ]
            ]);
            return;
        }
        
        try {
            // Get query parameters safely
            $filters = [];
            
            // Check if 'role' parameter exists
            if (isset($_GET['role']) && !empty($_GET['role'])) {
                $filters['role'] = $_GET['role'];
            } else {
                $filters['role'] = 'all';
            }

            // Exclude admins by default unless explicitly included or role filter requests admin
            $include_admin = isset($_GET['include_admin']) && $_GET['include_admin'] === '1';
            if (!$include_admin && (!isset($filters['role']) || $filters['role'] !== 'admin')) {
                $filters['exclude_role'] = 'admin';
            }
            
            // Check if 'status' parameter exists
            if (isset($_GET['status']) && !empty($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }
            
            // Check if 'search' parameter exists
            if (isset($_GET['search']) && !empty($_GET['search'])) {
                $filters['search'] = $_GET['search'];
            }

            $filters['require_email'] = true;
            
            $users = $this->UserModel->get_all($filters);
            
            // Remove passwords from all users
            foreach ($users as &$user) {
                unset($user['password']);
            }
            
            echo json_encode([
                'success' => true,
                'users' => $users,
                'count' => count($users)
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Get single user by ID
     * GET /api/users/{id}
     */
    public function api_get_user($id)
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            $user = $this->UserModel->find_by_id($id);
            
            if (!$user) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found'
                ]);
                return;
            }
            
            unset($user['password']);
            
            echo json_encode([
                'success' => true,
                'user' => $user
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Create new user
     * POST /api/users
     */
    public function api_create_user()
    {
        api_set_json_headers();        
        // Check if user is admin
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            // Get raw POST data and decode JSON
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            // Extract and validate data
            $email = $json_data['email'] ?? '';
            $first_name = $json_data['firstName'] ?? '';
            $middle_name = $json_data['middleName'] ?? '';
            $last_name = $json_data['lastName'] ?? '';
            $role = $json_data['role'] ?? 'student';
            $phone = $json_data['phone'] ?? '';
            $profile_photo_path = $json_data['profile_photo_path'] ?? ($json_data['profilePhotoPath'] ?? null);
            $password = $json_data['password'] ?? 'password123'; // Default password
            
            // Validation
            if (empty($email) || empty($first_name) || empty($last_name)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email, first name, and last name are required'
                ]);
                return;
            }
            
            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email format'
                ]);
                return;
            }
            
            // Validate role
            if (!in_array($role, ['admin', 'teacher', 'student'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid role'
                ]);
                return;
            }
            
            // Check if email exists
            if ($this->UserModel->email_exists($email)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists'
                ]);
                return;
            }
            
            // Prepare user data
            $userData = [
                'email' => $email,
                'password' => $password,
                'first_name' => $first_name,
                'middle_name' => $middle_name,
                'last_name' => $last_name,
                'phone' => $phone,
                'profile_photo_path' => !empty($profile_photo_path) ? $profile_photo_path : null,
                'role' => $role,
                'status' => 'active'
            ];
            
            // Create user
            $userId = $this->UserModel->create($userData);
            
            if ($userId) {
                // Get created user
                $user = $this->UserModel->find_by_id($userId);
                unset($user['password']);
                
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'User created successfully',
                    'user' => $user
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create user'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Update existing user
     * PUT /api/users/{id}
     */
    public function api_update_user($id)
    {
         api_set_json_headers();
        
        // Check if user is admin
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            // Check if user exists
            $existingUser = $this->UserModel->find_by_id($id);
            if (!$existingUser) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found'
                ]);
                return;
            }
            
            // Get raw POST data and decode JSON
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            // Extract data
            $email = $json_data['email'] ?? '';
            $first_name = $json_data['firstName'] ?? '';
            $middle_name = $json_data['middleName'] ?? '';
            $last_name = $json_data['lastName'] ?? '';
            $role = $json_data['role'] ?? '';
            $status = $json_data['status'] ?? '';
            $phone = $json_data['phone'] ?? '';
            $password = isset($json_data['password']) ? trim((string) $json_data['password']) : '';
            $profile_photo_path = $json_data['profile_photo_path'] ?? ($json_data['profilePhotoPath'] ?? null);
            
            // Validation
            if (empty($email) || empty($first_name) || empty($last_name)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email, first name, and last name are required'
                ]);
                return;
            }
            
            // Check if email exists (excluding current user)
            if ($this->UserModel->email_exists($email, $id)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists'
                ]);
                return;
            }
            
            // Prepare update data
            $updateData = [
                'email' => $email,
                'first_name' => $first_name,
                'middle_name' => $middle_name,
                'last_name' => $last_name,
                'phone' => $phone,
                'profile_photo_path' => !empty($profile_photo_path) ? $profile_photo_path : null
            ];
            
            // Only update role if provided and valid
            if (!empty($role) && in_array($role, ['admin', 'teacher', 'student'])) {
                $updateData['role'] = $role;
            }
            
            // Only update status if provided and valid
            if (!empty($status) && in_array($status, ['active', 'inactive'])) {
                $updateData['status'] = $status;
            }

            // Only update password if provided
            if ($password !== '') {
                $updateData['password'] = $password;
            }
            
            // Update user
            $result = $this->UserModel->update_user($id, $updateData);
            
            if ($result) {
                // Get updated user
                $user = $this->UserModel->find_by_id($id);
                unset($user['password']);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'User updated successfully',
                    'user' => $user
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update user'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Delete user (soft delete - set status to inactive)
     * DELETE /api/users/{id}
     */
    public function api_delete_user($id)
    {
         api_set_json_headers();
        // Check if user is admin
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }
        
        try {
            // Check if user exists
            $user = $this->UserModel->find_by_id($id);
            if (!$user) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found'
                ]);
                return;
            }
            
            // Prevent admin from deleting themselves
            if ($id == $this->session->userdata('user_id')) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Cannot delete your own account'
                ]);
                return;
            }
            
            // Soft delete (set status to inactive)
            $result = $this->UserModel->delete_user($id);
            
            if ($result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'User deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete user'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Admin: Send password reset email to a specific user
     * POST /api/users/{id}/send-password-reset
     */
    public function api_admin_send_password_reset($id)
    {
        api_set_json_headers();

        // Check if user is admin
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }

        try {
            $targetUser = $this->UserModel->find_by_id($id);
            if (!$targetUser) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found.'
                ]);
                return;
            }

            $email = trim((string) ($targetUser['email'] ?? ''));
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Selected user does not have a valid email address.'
                ]);
                return;
            }

            $token = bin2hex(random_bytes(16));
            $expiresAt = date('Y-m-d H:i:s', strtotime(app_now() . ' +24 hours'));

            // Store token first; email should only be sent for a persisted token.
            $this->db->table('password_resets')->insert([
                'email' => $email,
                'user_id' => $targetUser['id'],
                'token' => $token,
                'type' => 'password',
                'expires_at' => $expiresAt,
                'used' => 0,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ]);

            $this->call->helper('mail');
            $this->call->helper('email_templates');

            $portalUrl = rtrim((string) config_item('portal_url'), '/');
            if ($portalUrl === '') {
                $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
                $isLocalHost = ($host === 'localhost') || ($host === '127.0.0.1')
                    || (strpos($host, 'localhost:') === 0) || (strpos($host, '127.0.0.1:') === 0);
                $isDevHost = (strpos($host, 'dev.mcaportal.online') !== false);

                if ($isLocalHost) {
                    $portalUrl = 'http://localhost:5174';
                } elseif ($isDevHost) {
                    $portalUrl = 'https://dev.mcaportal.online/ui';
                } else {
                    $portalUrl = 'https://mcaportal.online';
                }
            }

            $resetUrl = sprintf('%s/auth/reset?token=%s', $portalUrl, $token);
            $logoUrl = $portalUrl . '/logo.png';
            $subject = 'Password Reset Request - Maranatha';
            $body = generate_password_reset_email($targetUser['first_name'] ?? $email, $resetUrl, $logoUrl);

            $emailResult = sendNotif($email, $subject, $body);
            if (!$emailResult['success']) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to send password reset email. Please try again.'
                ]);
                return;
            }

            echo json_encode([
                'success' => true,
                'message' => 'Password reset link sent to ' . $email . '.'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Request a password reset link to be sent to the user's email
     * POST /api/auth/request-reset
     */
    public function api_request_password_reset()
    {
        api_set_json_headers();

        try {
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            $email = trim($json_data['email'] ?? '');

            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Please provide a valid email address.'
                ]);
                return;
            }

            // Find user by email
            $user = $this->UserModel->find_by_email($email);
            if (!$user) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'No email registered in the system for that address.'
                ]);
                return;
            }

            // Generate secure token and expiry (24 hours)
            $token = bin2hex(random_bytes(16));
            $expiresAt = date('Y-m-d H:i:s', strtotime(app_now() . ' +24 hours'));

            // Store token in password_resets table
            try {
                $this->db->table('password_resets')->insert([
                    'email' => $email,
                    'token' => $token,
                    'expires_at' => $expiresAt,
                    'used' => 0,
                    'created_at' => app_now(),
                    'updated_at' => app_now()
                ]);
            } catch (Exception $e) {
                // Log and continue — insertion failure shouldn't stop email send attempt
                error_log('Failed to insert password reset token: ' . $e->getMessage());
            }

            // Prepare email
            $this->call->helper('mail');
            $this->call->helper('email_templates');

            $portalUrl = config_item('portal_url');
            $resetUrl = sprintf('%s/auth/reset?token=%s', $portalUrl, $token);
            $logoUrl = $portalUrl . '/logo.png';
            $subject = 'Password Reset Request - Maranatha';
            $body = generate_password_reset_email($user['first_name'] ?? $user['email'], $resetUrl, $logoUrl);

            $emailResult = sendNotif($email, $subject, $body);

            if (!$emailResult['success']) {
                // Log but don't reveal details to client
                error_log('Password reset email failed: ' . $emailResult['message']);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Password reset link sent. Please check your inbox.'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Render a simple password reset page (GET) or handle form POST
     * URL: /auth/reset?token=...
     */
    public function reset()
    {
        // If POST, process the form submission server-side (non-API)
        if ($this->io->method() === 'post') {
            $token = $this->io->post('token');
            $newPassword = $this->io->post('password');

            // Simple validation
            if (empty($token) || empty($newPassword) || strlen($newPassword) < 6) {
                $this->session->set_flashdata('error', 'Invalid token or password. Password must be at least 6 characters.');
                redirect('auth/reset?token=' . urlencode($token));
                return;
            }

            // Delegate to API handler logic by calling api_reset_password via internal call
            $_POST = ['token' => $token, 'password' => $newPassword];
            $this->api_reset_password();
            return;
        }

        // For GET, display the form view and pass token
        $token = $this->io->get('token');
        $data = ['token' => $token, 'error' => $this->session->flashdata('error'), 'success' => $this->session->flashdata('success')];
        $this->call->view('auth/reset_password', $data);
    }

    /**
     * API: reset password using token
     * POST /api/auth/reset-password
     * Body JSON: { token, password }
     */
    public function api_reset_password()
    {
        api_set_json_headers();

        try {
            // Read raw input once and decode
            $raw_input = file_get_contents('php://input');
            error_log('Reset password raw input: ' . $raw_input);
            
            $json_data = json_decode($raw_input, true);
            error_log('Decoded JSON data: ' . json_encode($json_data));

            // Extract token and password from JSON (prefer JSON over POST for API calls)
            $token = isset($json_data['token']) ? trim($json_data['token']) : '';
            $newPassword = isset($json_data['password']) ? $json_data['password'] : '';

            error_log('Token: ' . $token . ', Password length: ' . strlen($newPassword));

            if (empty($token) || empty($newPassword) || strlen($newPassword) < 6) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid token or password (min 6 chars).']);
                return;
            }

            // Find token record
            error_log('Looking for token in password_resets table: ' . $token);
            $reset = $this->db->table('password_resets')->where('token', $token)->get();
            
            if (!$reset) {
                error_log('Token not found in database');
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid or expired token.']);
                return;
            }

            error_log('Token found: ' . json_encode($reset));

            // Check expiry and usage
            if ((int)$reset['used'] === 1) {
                error_log('Token already used');
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token has already been used.']);
                return;
            }

            $expiresAt = strtotime($reset['expires_at']);
            if ($expiresAt === false || $expiresAt < time()) {
                error_log('Token expired. Expires at: ' . $reset['expires_at'] . ', Current time: ' . app_now());
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token has expired.']);
                return;
            }

            $email = $reset['email'];
            error_log('Finding user by email: ' . $email);
            $user = $this->UserModel->find_by_email($email);
            
            if (!$user) {
                error_log('User not found with email: ' . $email);
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found.']);
                return;
            }

            error_log('User found: ' . $user['id']);

            // Update password (update_user will hash it)
            error_log('Updating password for user ID: ' . $user['id']);
            
            $updated = $this->UserModel->update_user($user['id'], ['password' => $newPassword]);

            if (!$updated) {
                error_log('Failed to update password for user ID: ' . $user['id']);
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update password.']);
                return;
            }

            error_log('Password updated successfully for user ID: ' . $user['id']);

            // Mark token as used
            $tokenUpdate = $this->db->table('password_resets')->where('id', $reset['id'])->update([
                'used' => 1,
                'updated_at' => app_now()
            ]);
            error_log('Token marked as used: ' . ($tokenUpdate ? 'success' : 'failed'));

            echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);
        } catch (Exception $e) {
            error_log('Exception in api_reset_password: ' . $e->getMessage() . ' | ' . $e->getTraceAsString());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * API: Request PIN reset
     * POST /api/auth/request-pin-reset
     * Body JSON: { email }
     */
    public function api_request_pin_reset()
    {
        api_set_json_headers();

        try {
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);

            $email = isset($json_data['email']) ? trim($json_data['email']) : '';

            if (empty($email)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Email is required.']);
                return;
            }

            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
                return;
            }

            // Check if user exists
            $user = $this->db->table('users')->where('email', $email)->get();

            // USER REQUESTED: Send email to ANY address for flexibility
            // Student can use any convenient email, they'll verify account ownership when resetting
            
            // Generate reset token
            $token = bin2hex(random_bytes(16));
            $expiresAt = date('Y-m-d H:i:s', strtotime(app_now() . ' +24 hours')); // 24 hours

            // Delete any existing PIN reset tokens for this email
            $this->db->table('password_resets')
                ->where('email', $email)
                ->where('type', 'pin')
                ->delete();

            // Insert new token record
            $inserted = $this->db->table('password_resets')->insert([
                'email' => $email,
                'token' => $token,
                'type' => 'pin',
                'expires_at' => $expiresAt,
                'used' => 0,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ]);

            if (!$inserted) {
                error_log('Failed to insert PIN reset token for: ' . $email);
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create reset token.']);
                return;
            }

            // Get portal URL from config
            $portalUrl = rtrim(config_item('portal_url') ?: 'https://mcaportal.online', '/');
            
            // Generate reset URL
            $resetUrl = sprintf('%s/auth/reset-pin?token=%s', $portalUrl, $token);

            // Get logo URL
            $logoUrl = $portalUrl . '/assets/images/mcc-logo.png';

            // Generate email HTML using helper
            $this->call->helper('mail');
            $this->call->helper('email_templates');
            
            // Use first name from user if exists, otherwise generic greeting
            $firstName = $user ? $user['first_name'] : 'Student';
            $emailBody = generate_pin_reset_email($firstName, $resetUrl, $logoUrl);

            // Send email to the provided address
            sendNotif($email, 'Reset Your Payment PIN - Maranatha', $emailBody);

            error_log('PIN reset email sent to: ' . $email . ($user ? ' (registered user)' : ' (unregistered email)'));

            // Always return success for security
            echo json_encode([
                'success' => true,
                'message' => 'If your email is registered, you will receive PIN reset instructions shortly.'
            ]);
        } catch (Exception $e) {
            error_log('Exception in api_request_pin_reset: ' . $e->getMessage() . ' | ' . $e->getTraceAsString());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error occurred.']);
        }
    }

    /**
     * API: Verify PIN reset token and identifier
     * POST /api/auth/verify-pin-reset-token
     * Body JSON: { token, identifier }
     * This verifies the account BEFORE allowing PIN reset for security
     */
    public function api_verify_pin_reset_token()
    {
        api_set_json_headers();

        try {
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);

            $token = isset($json_data['token']) ? trim($json_data['token']) : '';
            $identifier = isset($json_data['identifier']) ? trim($json_data['identifier']) : '';

            // Validate inputs
            if (empty($token) || empty($identifier)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token and identifier are required.']);
                return;
            }

            // Find token record
            $reset = $this->db->table('password_resets')
                ->where('token', $token)
                ->where('type', 'pin')
                ->get();

            if (!$reset) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid or expired reset link.']);
                return;
            }

            // Check if token is expired
            $now = new DateTime();
            $expiresAt = new DateTime($reset['expires_at']);

            if ($now > $expiresAt) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Reset link has expired. Please request a new one.']);
                return;
            }

            // Check if already used
            if ($reset['used'] == 1) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Reset link has already been used.']);
                return;
            }

            // Find user by identifier
            // First try to find user by student_id from students table
            $student = $this->db->table('students')->where('student_id', $identifier)->get();
            
            $user = null;
            if ($student && isset($student['user_id'])) {
                // Get user from users table using user_id
                $user = $this->db->table('users')->where('id', $student['user_id'])->get();
            }
            
            // If not found, try student_number in users table (legacy support)
            if (!$user) {
                $user = $this->db->table('users')->where('student_number', $identifier)->get();
            }
            
            // If still not found, try as email in users table
            if (!$user) {
                $user = $this->db->table('users')->where('email', $identifier)->get();
            }

            if (!$user) {
                http_response_code(400);
                echo json_encode([
                    'success' => false, 
                    'message' => 'Unable to verify your account. Please check your student ID or email and try again.'
                ]);
                return;
            }

            // Account verified successfully
            echo json_encode([
                'success' => true, 
                'message' => 'Account verified successfully.',
                'data' => [
                    'user_id' => $user['id'],
                    'first_name' => $user['first_name'],
                    'student_number' => $student ? $student['student_id'] : ($user['student_number'] ?? null)
                ]
            ]);
        } catch (Exception $e) {
            error_log('Exception in api_verify_pin_reset_token: ' . $e->getMessage() . ' | ' . $e->getTraceAsString());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error occurred.']);
        }
    }

    /**
     * API: Reset PIN using token
     * POST /api/auth/reset-pin
     * Body JSON: { token, new_pin, identifier }
     * identifier can be student_id or registered email
     */
    public function api_reset_pin()
    {
        api_set_json_headers();

        try {
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);

            $token = isset($json_data['token']) ? trim($json_data['token']) : '';
            $newPin = isset($json_data['new_pin']) ? trim($json_data['new_pin']) : '';
            $identifier = isset($json_data['identifier']) ? trim($json_data['identifier']) : '';

            // Validate inputs
            if (empty($token) || empty($newPin)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Token and new PIN are required.']);
                return;
            }

            // Validate PIN format (4-6 digits)
            if (!preg_match('/^\d{4,6}$/', $newPin)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'PIN must be 4-6 digits.']);
                return;
            }

            // Find token record
            $reset = $this->db->table('password_resets')
                ->where('token', $token)
                ->where('type', 'pin')
                ->get();

            if (!$reset) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid or expired token.']);
                return;
            }

            // Check if token is expired
            $now = new DateTime();
            $expiresAt = new DateTime($reset['expires_at']);

            if ($now > $expiresAt) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Reset token has expired.']);
                return;
            }

            // Check if already used
            if ($reset['used'] == 1) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Reset token has already been used.']);
                return;
            }

            // Find user by identifier
            // First try to find user by student_id from students table
            $student = $this->db->table('students')->where('student_id', $identifier)->get();
            
            $user = null;
            if ($student && isset($student['user_id'])) {
                // Get user from users table using user_id
                $user = $this->db->table('users')->where('id', $student['user_id'])->get();
            }
            
            // If not found, try student_number in users table (legacy support)
            if (!$user) {
                $user = $this->db->table('users')->where('student_number', $identifier)->get();
            }
            
            // If still not found, try as email in users table
            if (!$user) {
                $user = $this->db->table('users')->where('email', $identifier)->get();
            }

            if (!$user) {
                http_response_code(400);
                echo json_encode([
                    'success' => false, 
                    'message' => 'Unable to verify your account. Please provide your student ID or registered email.'
                ]);
                return;
            }

            // Hash the new PIN
            $hashedPin = password_hash($newPin, PASSWORD_BCRYPT);

            // Update user's PIN
            $updated = $this->db->table('users')->where('id', $user['id'])->update([
                'payment_pin_hash' => $hashedPin,
                'payment_pin_set_at' => app_now(),
                'updated_at' => app_now()
            ]);

            if (!$updated) {
                error_log('Failed to update PIN for user ID: ' . $user['id']);
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update PIN.']);
                return;
            }

            // Mark token as used
            $this->db->table('password_resets')->where('id', $reset['id'])->update([
                'used' => 1,
                'updated_at' => app_now()
            ]);

            error_log('PIN reset successfully for user ID: ' . $user['id'] . ' via token sent to: ' . $reset['email']);

            echo json_encode(['success' => true, 'message' => 'PIN reset successfully.']);
        } catch (Exception $e) {
            error_log('Exception in api_reset_pin: ' . $e->getMessage() . ' | ' . $e->getTraceAsString());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error occurred.']);
        }
    }

    /**
     * Send welcome email to newly created user
     * POST /api/auth/send-welcome-email
     */
    public function api_send_welcome_email()
    {
        api_set_json_headers();

        // Check if user is admin
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access denied. Admin only.'
            ]);
            return;
        }

        try {
            // Get raw POST data and decode JSON
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);

            // Extract data
            $email = $json_data['email'] ?? '';
            $firstName = $json_data['firstName'] ?? '';
            $lastName = $json_data['lastName'] ?? '';
            $password = $json_data['password'] ?? '';
            $role = $json_data['role'] ?? 'student';

            // Validate required fields
            if (empty($email) || empty($firstName) || empty($lastName) || empty($password)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email, name, password, and role are required'
                ]);
                return;
            }

            // Load mail helpers
            $this->call->helper('mail_helper');
            $this->call->helper('email_templates_helper');

            // Generate welcome email using template
            $portalUrl = rtrim(config_item('portal_url') ?: 'https://mcaportal.online', '/') . '/auth';
            $emailBody = generate_welcome_email_with_credentials($firstName, $email, $role, $password, $portalUrl);

            // Send email
            $result = sendNotif($email, 'Your Account Has Been Created - Maranatha', $emailBody);

            if ($result['success']) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Welcome email sent successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => $result['message'] ?? 'Failed to send welcome email'
                ]);
            }
        } catch (Exception $e) {
            error_log('Exception in api_send_welcome_email: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * POST /api/users/register-fcm-token
     * Register a Firebase Cloud Messaging (FCM) device token for the current user
     * Body: { token: string }
     */
    public function api_register_fcm_token()
    {
        api_set_json_headers();
        
        error_log('[FCM] api_register_fcm_token called');

        if (!$this->session->userdata('logged_in')) {
            error_log('[FCM] User not logged in - returning 401');
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $token = $data['token'] ?? null;
            
            error_log('[FCM] Token received: ' . (empty($token) ? 'EMPTY' : substr($token, 0, 30) . '...'));

            if (empty($token)) {
                error_log('[FCM] Token is empty - returning 400');
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'FCM token is required']);
                return;
            }

            $user_id = $this->session->userdata('user_id');
            error_log('[FCM] User ID: ' . $user_id);

            // Check if token already exists for this user
            $existing = $this->db->table('user_fcm_tokens')
                                 ->select('id')
                                 ->where('user_id', $user_id)
                                 ->where('token', $token)
                                 ->where('is_active', 1)
                                 ->get();

            if (!empty($existing) && !empty($existing['id'])) {
                error_log('[FCM] Token already exists, updating timestamp');
                // Token already registered, just update timestamp
                $this->db->table('user_fcm_tokens')
                         ->where('id', $existing['id'])
                         ->update(['created_at' => app_now()]);
                http_response_code(200);
                echo json_encode(['success' => true, 'message' => 'FCM token already registered']);
                return;
            }

            error_log('[FCM] Inserting new token for user ' . $user_id);
            
            // Insert new token
            $result = $this->db->table('user_fcm_tokens')->insert([
                'user_id' => $user_id,
                'token' => $token,
                'is_active' => 1,
                'created_at' => app_now()
            ]);

            if ($result) {
                error_log('[FCM✓] Token inserted successfully for user ' . $user_id);
                http_response_code(201);
                echo json_encode(['success' => true, 'message' => 'FCM token registered successfully']);
            } else {
                error_log('[FCM✗] Token insert failed for user ' . $user_id);
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to register FCM token']);
            }
        } catch (Exception $e) {
            error_log('[FCM✗] Exception: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/debug/my-fcm-tokens
     * Development helper to list active FCM tokens for the logged-in user
     */
    public function api_list_my_fcm_tokens()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');
            $stmt = $this->db->raw("SELECT id, token, is_active, created_at FROM user_fcm_tokens WHERE user_id = ?", [$user_id]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            http_response_code(200);
            echo json_encode(['success' => true, 'tokens' => $rows]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/debug/send-test-notification
     * Sends a simple test notification to the logged-in user's active FCM tokens.
     * Body (optional): { title, body }
     */
    public function api_send_test_notification()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $title = $data['title'] ?? 'EduTrack Test Notification';
            $body = $data['body'] ?? 'This is a test push notification from the server.';

            $user_id = $this->session->userdata('user_id');

            // Load helper and fetch tokens
            $this->call->helper('notification');
            $this->call->model('MessageModel');
            $tokens = $this->MessageModel->get_user_fcm_tokens($user_id);

            if (empty($tokens)) {
                http_response_code(200);
                echo json_encode(['success' => false, 'message' => 'No FCM tokens found for current user']);
                return;
            }

            $results = [];
            foreach ($tokens as $token) {
                $ok = send_fcm_to_token($token, $title, $body, ['type' => 'test_notification']);
                $results[] = ['token' => substr($token, 0, 24) . '...', 'success' => (bool)$ok];
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'results' => $results]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * API: Setup Payment PIN
     * POST /api/auth/setup-payment-pin
     */
    public function api_setup_payment_pin()
    {
        api_set_json_headers();
        try {
            // Check if user is authenticated
            $user_id = $this->session->userdata('user_id');
            if (!$user_id || !$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Get raw POST data and decode JSON (like api_login does)
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            $payment_pin = $json_data['payment_pin'] ?? $this->io->post('payment_pin');

            // Validate PIN format
            if (empty($payment_pin)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'PIN is required']);
                return;
            }

            if (!preg_match('/^\d{4,6}$/', $payment_pin)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'PIN must be 4-6 digits']);
                return;
            }

            // Hash the PIN using bcrypt
            $pin_hash = password_hash($payment_pin, PASSWORD_BCRYPT, ['cost' => 10]);

            // Update user's payment PIN hash in database
            $this->db->table('users')
                ->where('id', $user_id)
                ->update([
                    'payment_pin_hash' => $pin_hash,
                    'payment_pin_set_at' => app_now(),
                    'pin_attempts' => 0,
                    'pin_locked_until' => null
                ]);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Payment PIN successfully set',
                'user' => [
                    'id' => $user_id,
                    'payment_pin_set' => true
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * API: Verify Payment PIN
     * POST /api/auth/verify-payment-pin
     * 
     * Verifies that the provided PIN matches the user's payment PIN
     * Implements brute-force protection with attempt limiting
     */
    public function api_verify_payment_pin()
    {
        api_set_json_headers();
        try {
            // Check if user is authenticated
            $user_id = $this->session->userdata('user_id');
            if (!$user_id || !$this->session->userdata('logged_in')) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                return;
            }

            // Get raw POST data and decode JSON (like api_login does)
            $raw_input = file_get_contents('php://input');
            $json_data = json_decode($raw_input, true);
            
            $payment_pin = $json_data['payment_pin'] ?? $this->io->post('payment_pin');

            // Validate PIN format
            if (empty($payment_pin)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'PIN is required']);
                return;
            }

            if (!preg_match('/^\d{4,6}$/', $payment_pin)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid PIN format']);
                return;
            }

            // Get user's PIN hash and attempt info
            $user = $this->db->table('users')->where('id', $user_id)->get();
            
            // Check if user exists (->get() returns false/empty if no record found)
            if (!$user) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'User not found']);
                return;
            }

            // Check if account is locked due to too many failed attempts
            if ($user['pin_locked_until'] && strtotime($user['pin_locked_until']) > time()) {
                http_response_code(200);
                echo json_encode([
                    'success' => false,
                    'message' => 'Account temporarily locked. Please try again later.'
                ]);
                return;
            }

            // Reset lock if time has passed
            if ($user['pin_locked_until'] && strtotime($user['pin_locked_until']) <= time()) {
                $this->db->table('users')
                    ->where('id', $user_id)
                    ->update([
                        'pin_attempts' => 0,
                        'pin_locked_until' => null
                    ]);
                $user['pin_attempts'] = 0;
            }

            // Check if user has a PIN set
            if (empty($user['payment_pin_hash'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No PIN set for this account']);
                return;
            }

            // Verify PIN against hash
            if (password_verify($payment_pin, $user['payment_pin_hash'])) {
                // PIN is correct - reset attempts and lock
                $this->db->table('users')
                    ->where('id', $user_id)
                    ->update([
                        'pin_attempts' => 0,
                        'pin_locked_until' => null
                    ]);

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'PIN verified successfully'
                ]);
                return;
            }

            // PIN is incorrect - increment attempts
            $new_attempts = ($user['pin_attempts'] ?? 0) + 1;
            $max_attempts = 3;

            if ($new_attempts >= $max_attempts) {
                // Lock account for 2 minutes
                $lock_until = date('Y-m-d H:i:s', strtotime(app_now() . ' +2 minutes'));
                $this->db->table('users')
                    ->where('id', $user_id)
                    ->update([
                        'pin_attempts' => $new_attempts,
                        'pin_locked_until' => $lock_until
                    ]);

                http_response_code(200);
                echo json_encode([
                    'success' => false,
                    'message' => 'Account locked. Try again in 2 minutes.',
                    'attempts_remaining' => 0
                ]);
            } else {
                // Calculate remaining attempts
                $attempts_remaining = $max_attempts - $new_attempts;
                
                // Update attempt count
                $this->db->table('users')
                    ->where('id', $user_id)
                    ->update([
                        'pin_attempts' => $new_attempts
                    ]);

                http_response_code(200);
                echo json_encode([
                    'success' => false,
                    'message' => "Incorrect PIN. You have $attempts_remaining more attempt" . ($attempts_remaining > 1 ? 's' : '') . " until it locks.",
                    'attempts_remaining' => $attempts_remaining
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}
