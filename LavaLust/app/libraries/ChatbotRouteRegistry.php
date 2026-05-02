<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ChatbotRouteRegistry
 *
 * Single source of truth for all frontend routes, mirrored from App.tsx.
 * Each entry declares:
 *   route       – exact frontend path (use the canonical form, no :param placeholders in labels)
 *   label       – human-readable page name used in [link:Label|/route] tokens
 *   description – one-line description of what the page does
 *   roles       – array of roles that may access this route
 *
 * The chatbot uses this registry instead of (or in addition to) the
 * chatbot_knowledge table so it always gives role-appropriate navigation links.
 * The knowledge table remains the offline / custom-content fallback.
 *
 * Keep this file in sync with EduTrackUI/src/App.tsx whenever routes change.
 */
class ChatbotRouteRegistry
{
    /**
     * Return all routes accessible to the given role as an array of entries.
     * Each entry: ['route', 'label', 'description']
     *
     * @param  string $role  admin | teacher | student | enrollee
     * @return array
     */
    public static function forRole(string $role): array
    {
        return array_values(array_filter(
            self::all(),
            static function (array $r) use ($role): bool {
                return in_array($role, $r['roles'], true) || in_array('*', $r['roles'], true);
            }
        ));
    }

    /**
     * Format routes for a given role into a compact string block
     * ready to be injected into the LLM system prompt.
     *
     * @param  string $role
     * @return string
     */
    public static function buildContext(string $role): string
    {
        $routes = self::forRole($role);
        if (empty($routes)) {
            return '';
        }

        $roleName = ucfirst($role);
        $lines    = ["AVAILABLE NAVIGATION ROUTES for {$roleName} (always use [link:Label|/route] format):"];
        foreach ($routes as $r) {
            $lines[] = "  • [{$r['label']}] → {$r['route']}  — {$r['description']}";
        }
        return implode("\n", $lines);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Route definitions — mirrored from EduTrackUI/src/App.tsx
    // ─────────────────────────────────────────────────────────────────────────
    private static function all(): array
    {
        return [

            // ── ADMIN ────────────────────────────────────────────────────────

            [
                'route'       => '/admin/dashboard',
                'label'       => 'Admin Dashboard',
                'description' => 'Main admin overview: enrollment counts, payments, announcements',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/users',
                'label'       => 'User Management',
                'description' => 'View and manage all system users',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/users/teachers',
                'label'       => 'Manage Teachers',
                'description' => 'Add, edit, or deactivate teacher accounts',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/users/students',
                'label'       => 'Manage Students',
                'description' => 'View and manage student accounts',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/users/subjects',
                'label'       => 'Manage Subjects',
                'description' => 'Create and edit school subjects',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/users/sections',
                'label'       => 'Manage Sections',
                'description' => 'Create and manage class sections',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/assignments',
                'label'       => 'Subject Assignment',
                'description' => 'Assign subjects to teachers and sections',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/enrollments',
                'label'       => 'Enrollments',
                'description' => 'Review and manage all student enrollment applications',
                'roles'       => ['admin', 'teacher'],
            ],
            [
                'route'       => '/admin/enrollments/new',
                'label'       => 'New Enrollment (Admin)',
                'description' => 'Manually create a new enrollment on behalf of a student',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/payments',
                'label'       => 'Payments',
                'description' => 'View and process all student payment transactions',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/payment-plans',
                'label'       => 'Payment Plans',
                'description' => 'Manage student payment plans and installment schedules',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/installment-schedules',
                'label'       => 'Installment Schedule Management',
                'description' => 'Configure installment schedule templates',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/tuition-packages',
                'label'       => 'Tuition Packages',
                'description' => 'Manage tuition packages and pricing bundles per grade level',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/uniform-management',
                'label'       => 'Uniform Management',
                'description' => 'Manage school uniform items and pricing',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/uniform-orders',
                'label'       => 'Uniform Orders',
                'description' => 'View and process student uniform orders',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/school-services',
                'label'       => 'School Services',
                'description' => 'Manage school service subscriptions (e.g. school vehicle)',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/rfid-attendance',
                'label'       => 'RFID Attendance',
                'description' => 'View RFID-based student attendance logs',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/rfid-management',
                'label'       => 'RFID Management',
                'description' => 'Manage RFID card assignments for students',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/grading',
                'label'       => 'Grading System',
                'description' => 'Configure grading rules and view system-wide grades',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/announcements',
                'label'       => 'Announcements',
                'description' => 'Create and manage school-wide announcements',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/pdf',
                'label'       => 'PDF / Grade Reports',
                'description' => 'Generate and download PDF grade reports',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/academic-periods',
                'label'       => 'Academic Periods',
                'description' => 'Manage school years and quarterly academic periods',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/enrollment-settings',
                'label'       => 'Enrollment Settings',
                'description' => 'Configure enrollment period rules and requirements',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/campuses',
                'label'       => 'Campuses',
                'description' => 'Manage campus locations used for attendance tracking',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/settings',
                'label'       => 'Admin Settings',
                'description' => 'General system settings and configuration',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/sentiment',
                'label'       => 'Sentiment Analytics',
                'description' => 'View AI-powered sentiment analysis of student feedback',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/predictive-analytics',
                'label'       => 'Predictive Analytics',
                'description' => 'View enrollment and payment trend forecasts',
                'roles'       => ['admin'],
            ],
            [
                'route'       => '/admin/chatbot-knowledge',
                'label'       => 'Chatbot Knowledge Base',
                'description' => 'Manage the chatbot\'s knowledge entries and custom replies',
                'roles'       => ['admin'],
            ],

            // ── TEACHER ──────────────────────────────────────────────────────

            [
                'route'       => '/teacher/dashboard',
                'label'       => 'Teacher Dashboard',
                'description' => 'Teacher overview: assigned courses, recent activity',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/courses',
                'label'       => 'My Courses (Teacher)',
                'description' => 'View all courses assigned to you',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/activities',
                'label'       => 'Activities',
                'description' => 'Manage quizzes and activities across all courses',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/grades',
                'label'       => 'Grade Input',
                'description' => 'Enter and submit student grades',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/grade-input-edit',
                'label'       => 'Edit Grades',
                'description' => 'Edit previously submitted grade entries',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/attendance',
                'label'       => 'Attendance Dashboard',
                'description' => 'View attendance summaries for your sections',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/attendance-session',
                'label'       => 'Attendance Session',
                'description' => 'Start a new RFID attendance scanning session',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/attendance-history',
                'label'       => 'Attendance History',
                'description' => 'Browse past attendance session records',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/messages',
                'label'       => 'Messages (Teacher)',
                'description' => 'Send and receive messages with students and admins',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/notifications',
                'label'       => 'Notifications (Teacher)',
                'description' => 'View your notifications and alerts',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/teacher/settings',
                'label'       => 'Teacher Settings',
                'description' => 'Update your profile and account preferences',
                'roles'       => ['teacher'],
            ],
            [
                'route'       => '/adviser/enrollments/new',
                'label'       => 'Manual Enrollment (Adviser)',
                'description' => 'Manually enroll a student on behalf of a guardian (adviser role)',
                'roles'       => ['teacher'],
            ],

            // ── STUDENT ──────────────────────────────────────────────────────

            [
                'route'       => '/student/dashboard',
                'label'       => 'Student Dashboard',
                'description' => 'Student home: upcoming activities, grades summary, announcements',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/courses',
                'label'       => 'My Courses',
                'description' => 'Browse and open your enrolled courses',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/activities',
                'label'       => 'My Activities',
                'description' => 'View all pending and completed activities',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/grades',
                'label'       => 'My Grades',
                'description' => 'View your grades for all subjects',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/progress',
                'label'       => 'My Progress',
                'description' => 'Track your academic performance over time',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/feedback',
                'label'       => 'Feedback',
                'description' => 'Submit feedback or complaints about the school',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/messages',
                'label'       => 'Messages (Student)',
                'description' => 'Send and receive messages with teachers',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/notifications',
                'label'       => 'Notifications (Student)',
                'description' => 'View your notifications and alerts',
                'roles'       => ['student'],
            ],
            [
                'route'       => '/student/settings',
                'label'       => 'Student Settings',
                'description' => 'Update your profile and account preferences',
                'roles'       => ['student'],
            ],
            // Enrollment — accessible by both student and enrollee
            [
                'route'       => '/enrollment/new',
                'label'       => 'Enroll Now',
                'description' => 'Start a new enrollment application for the current school year',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/enrollment/my-enrollments',
                'label'       => 'My Enrollments',
                'description' => 'View the status of your enrollment applications',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/enrollment/payment',
                'label'       => 'My Payment',
                'description' => 'View your payment summary and proof-of-payment uploads',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/enrollment/payment-process',
                'label'       => 'Pay Now',
                'description' => 'Process a new payment via GCash or other methods',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/enrollment/installment-plans',
                'label'       => 'Installment Plans',
                'description' => 'View your installment schedule and remaining balance',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/enrollment/waiver-requests',
                'label'       => 'Waiver Requests',
                'description' => 'Submit or track fee waiver / discount requests',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/enrollment/setup-pin',
                'label'       => 'Set Up Payment PIN',
                'description' => 'Create a new payment PIN for secure payment transactions',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/enrollment/verify-pin',
                'label'       => 'Verify Payment PIN',
                'description' => 'Enter your payment PIN to authorize a transaction',
                'roles'       => ['student', 'enrollee'],
            ],
            [
                'route'       => '/auth/forgot-pin',
                'label'       => 'Forgot Payment PIN',
                'description' => 'Reset your forgotten payment PIN via email verification',
                'roles'       => ['student', 'enrollee', 'admin', 'teacher'],
            ],

            // ── ENROLLEE ─────────────────────────────────────────────────────

            [
                'route'       => '/enrollee/dashboard',
                'label'       => 'Enrollee Dashboard',
                'description' => 'Home page for new enrollees: enrollment status, payment info',
                'roles'       => ['enrollee'],
            ],
            [
                'route'       => '/enrollee/enrollment',
                'label'       => 'My Enrollment',
                'description' => 'View and manage your current enrollment application',
                'roles'       => ['enrollee'],
            ],
            [
                'route'       => '/enrollee/enrollment-form',
                'label'       => 'Enrollment Form',
                'description' => 'Fill in or update your enrollment form details',
                'roles'       => ['enrollee'],
            ],
            [
                'route'       => '/enrollee/payment',
                'label'       => 'Enrollee Payment',
                'description' => 'Submit payment for your enrollment fees',
                'roles'       => ['enrollee'],
            ],
        ];
    }
}
