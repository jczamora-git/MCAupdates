// API Configuration for LavaLust Backend
// Use empty string for development (Vite proxy), or full URL for production
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const isLocalhostApiBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(configuredApiBaseUrl);
const shouldUseProxyBaseInDev = import.meta.env.DEV && (!configuredApiBaseUrl || isLocalhostApiBase);
const isBrowserLocalhost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
const shouldIgnoreConfiguredLocalhostOnLive = !import.meta.env.DEV && isLocalhostApiBase && !isBrowserLocalhost;

export const API_BASE_URL = shouldUseProxyBaseInDev
  ? ''
  : shouldIgnoreConfiguredLocalhostOnLive
    ? ''
    : configuredApiBaseUrl.replace(/\/+$/, '');

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  ME: `${API_BASE_URL}/api/auth/me`,
  CHECK: `${API_BASE_URL}/api/auth/check`,
  UPDATE_PROFILE: `${API_BASE_URL}/api/auth/profile`,
  CHECK_STUDENT: `${API_BASE_URL}/api/auth/check-student`,
  SET_PASSWORD: `${API_BASE_URL}/api/auth/set-password`,
  VALIDATE_SET_PASSWORD_TOKEN: `${API_BASE_URL}/api/auth/validate-set-password-token`,
  SET_PASSWORD_WITH_TOKEN: `${API_BASE_URL}/api/auth/set-password-with-token`,
  SETUP_PAYMENT_PIN: `${API_BASE_URL}/api/auth/setup-payment-pin`,
  VERIFY_PAYMENT_PIN: `${API_BASE_URL}/api/auth/verify-payment-pin`,
  REQUEST_PIN_RESET: `${API_BASE_URL}/api/auth/request-pin-reset`,
  VERIFY_PIN_RESET_TOKEN: `${API_BASE_URL}/api/auth/verify-pin-reset-token`,
  RESET_PIN: `${API_BASE_URL}/api/auth/reset-pin`,
  
  // Email Verification
  VERIFY_EMAIL: `${API_BASE_URL}/api/users/verify-email`,
  RESEND_VERIFICATION: `${API_BASE_URL}/api/users/resend-verification`,
  
  // User Management
  USERS: `${API_BASE_URL}/api/users`,
  USER_BY_ID: (id: string | number) => `${API_BASE_URL}/api/users/${id}`,
  USER_SEND_PASSWORD_RESET: (id: string | number) => `${API_BASE_URL}/api/users/${id}/send-password-reset`,
  USERS_REGISTER_FCM_TOKEN: `${API_BASE_URL}/api/users/register-fcm-token`,
  
  // Teacher Management
  TEACHERS: `${API_BASE_URL}/api/teachers`,
  TEACHER_BY_ID: (id: string | number) => `${API_BASE_URL}/api/teachers/${id}`,
  TEACHER_STATS: `${API_BASE_URL}/api/teachers/stats`,
  
  // Teacher Adviser & Subject Assignments
  TEACHER_ADVISERS: `${API_BASE_URL}/api/teacher-advisers`,
  TEACHER_ASSIGN_ADVISER: `${API_BASE_URL}/api/teachers/assign-adviser`,
  TEACHER_ASSIGN_SUBJECT: `${API_BASE_URL}/api/teachers/assign-subject`,
  TEACHER_ASSIGNMENTS_LIST: `${API_BASE_URL}/api/teachers/assignments`,
  TEACHER_SUBJECTS: (teacher_id: string | number) => `${API_BASE_URL}/api/teachers/${teacher_id}/subjects`,
  TEACHER_ASSIGNMENT_REMOVE: `${API_BASE_URL}/api/teachers/assignment`,
  
  // Student Management
  STUDENTS: `${API_BASE_URL}/api/students`,
  STUDENTS_ACTIVE: `${API_BASE_URL}/api/students/active`,
  STUDENTS_ENROLLEES: `${API_BASE_URL}/api/students-enrollees`,
  STUDENT_BY_ID: (id: string | number) => `${API_BASE_URL}/api/students/${id}`,
  STUDENT_BY_USER: (user_id: string | number) => `${API_BASE_URL}/api/students/by-user/${user_id}`,
  STUDENT_PORTAL_ACCOUNT: (id: string | number) => `${API_BASE_URL}/api/students/${id}/portal-account`,
  STUDENTS_IMPORT: `${API_BASE_URL}/api/students/import`,
  STUDENTS_EXPORT: `${API_BASE_URL}/api/students/export`,
  STUDENT_ASSIGN_RFID: (id: string | number) => `${API_BASE_URL}/api/students/${id}/rfid`,
  RFID_CARD_CHECK: `${API_BASE_URL}/api/rfid/cards/check`,
  RFID_SESSIONS: `${API_BASE_URL}/api/rfid/sessions`,
  RFID_SCANS: `${API_BASE_URL}/api/rfid/scans`,
  
  // Subjects
  SUBJECTS: `${API_BASE_URL}/api/subjects`,
  SUBJECT_BY_ID: (id: string | number) => `${API_BASE_URL}/api/subjects/${id}`,
  SUBJECTS_FOR_STUDENT: `${API_BASE_URL}/api/subjects/for-student`,

  // Year levels & year_level_sections
  YEAR_LEVELS: `${API_BASE_URL}/api/year-levels`,
  YEAR_LEVEL_SECTIONS: `${API_BASE_URL}/api/year-level-sections`,

  // Teacher assignments
  TEACHER_ASSIGNMENTS: `${API_BASE_URL}/api/teacher-assignments`,
  TEACHER_ASSIGNMENTS_BY_TEACHER: (teacher_id: string | number) => `${API_BASE_URL}/api/teacher-assignments/by-teacher/${teacher_id}`,
  TEACHER_ASSIGNMENTS_FOR_STUDENT: `${API_BASE_URL}/api/teacher-assignments/for-student`,
  TEACHER_SUBJECT_ASSIGNMENTS: `${API_BASE_URL}/api/teacher-subject-assignments`,
  TEACHER_BY_ID_PUBLIC: (id: string | number) => `${API_BASE_URL}/api/teachers/${id}/public`,
  TEACHER_MY_SUBJECTS: `${API_BASE_URL}/api/teachers/me/subjects`,
  // Student subjects (enrollments)
  DISCOUNT_TEMPLATES: `${API_BASE_URL}/api/admin/discount-templates`,
  DISCOUNT_TEMPLATE_BY_ID: (id: string | number) => `${API_BASE_URL}/api/admin/discount-templates/${id}`,
  DISCOUNT_TEMPLATE_TOGGLE: (id: string | number) => `${API_BASE_URL}/api/admin/discount-templates/${id}/toggle`,
  STUDENT_SUBJECTS: `${API_BASE_URL}/api/student-subjects`,

  // School Fees
  SCHOOL_FEES: `${API_BASE_URL}/api/school-fees`,
  SCHOOL_FEE_BY_ID: (id: string | number) => `${API_BASE_URL}/api/school-fees/${id}`,
  SCHOOL_FEES_TOGGLE_STATUS: (id: string | number) => `${API_BASE_URL}/api/school-fees/${id}/toggle-status`,
  SCHOOL_FEES_FOR_STUDENT: (student_id: string | number) => `${API_BASE_URL}/api/school-fees/student/${student_id}`,

  // Tuition Packages
  TUITION_PACKAGES: `${API_BASE_URL}/api/tuition-packages`,
  TUITION_PACKAGES_ACTIVE: `${API_BASE_URL}/api/tuition-packages/active`,
  TUITION_PACKAGE_BY_ID: (id: string | number) => `${API_BASE_URL}/api/tuition-packages/${id}`,

  // Uniform Items
  UNIFORM_ITEMS: `${API_BASE_URL}/api/uniform-items`,
  UNIFORM_ITEM_BY_ID: (id: string | number) => `${API_BASE_URL}/api/uniform-items/${id}`,
  UNIFORM_ITEM_TOGGLE: (id: string | number) => `${API_BASE_URL}/api/uniform-items/${id}/toggle`,
  UNIFORM_ORDERS: `${API_BASE_URL}/api/uniform-orders`,
  
  // School Services (Monthly Service Fee, etc.)
  SCHOOL_SERVICE_FEE_AMOUNT: `${API_BASE_URL}/api/school-services/service-fee-amount`,
  SCHOOL_SERVICE_PAYMENTS: `${API_BASE_URL}/api/school-services/payments`,
  SCHOOL_SERVICE_STUDENTS: `${API_BASE_URL}/api/school-services/students`,
  SCHOOL_SERVICE_MONTHLY_SUMMARY: `${API_BASE_URL}/api/school-services/monthly-summary`,
  SCHOOL_SERVICE_CREATE_PAYMENT: `${API_BASE_URL}/api/school-services/create-payment`,
  
  // Payments
  PAYMENTS: `${API_BASE_URL}/api/payments`,
  PAYMENTS_CHECK_REFERENCE: `${API_BASE_URL}/api/payments/check-reference`,
  PAYMENTS_CHECK_SERVICE_PERIOD: `${API_BASE_URL}/api/payments/check-service-period`,
  PAYMENTS_BY_ENROLLMENT: `${API_BASE_URL}/api/payments/by-enrollment`,
  PAYMENT_MARK_NOTIFICATIONS_READ: (payment_id: string | number) => `${API_BASE_URL}/api/payments/${payment_id}/mark-notifications-read`,
  PAYMENT_BY_ID: (id: string | number) => `${API_BASE_URL}/api/payments/${id}`,
  PAYMENT_DISCOUNTS: (payment_id: string | number) => `${API_BASE_URL}/api/payments/${payment_id}/discounts`,
  PAYMENT_APPLY_DISCOUNT: (payment_id: string | number) => `${API_BASE_URL}/api/payments/${payment_id}/discounts`,
  PAYMENT_REMOVE_DISCOUNT: (payment_id: string | number, discount_id: string | number) => `${API_BASE_URL}/api/payments/${payment_id}/discounts/${discount_id}`,
  
  // Payment Discounts
  PAYMENT_DISCOUNTS_LIST: `${API_BASE_URL}/api/payment-discounts`,
  PAYMENT_DISCOUNTS_BY_STUDENT: (student_id: string | number, period_id: string | number) => `${API_BASE_URL}/api/payment-discounts/student/${student_id}/period/${period_id}`,
  
  // Payment Plans
  PAYMENT_PLANS: `${API_BASE_URL}/api/payment-plans`,
  PAYMENT_PLAN_ALL_INSTALLMENTS: `${API_BASE_URL}/api/payment-plans/installments/all`,
  PAYMENT_PLAN_BY_ID: (id: string | number) => `${API_BASE_URL}/api/payment-plans/${id}`,
  PAYMENT_PLAN_INSTALLMENTS: (plan_id: string | number) => `${API_BASE_URL}/api/payment-plans/${plan_id}/installments`,
  PAYMENT_PLAN_MARK_NOTIFICATIONS_READ: (plan_id: string | number) => `${API_BASE_URL}/api/payment-plans/${plan_id}/mark-notifications-read`,
  RFID_VERIFY_PASSKEY: `${API_BASE_URL}/api/rfid/verify-passkey`,
  RFID_VERIFY_ADMIN_PASSWORD: `${API_BASE_URL}/api/rfid/verify-admin-password`,
  RFID_STATS: `${API_BASE_URL}/api/rfid/stats`,
  RFID_SESSION_TEMPLATES: `${API_BASE_URL}/api/rfid/session-templates`,
  RFID_SESSION_TEMPLATE: (id: string | number) => `${API_BASE_URL}/api/rfid/session-templates/${id}`,
  RFID_SESSION_TEMPLATE_STATUS: (id: string | number) => `${API_BASE_URL}/api/rfid/session-templates/${id}/status`,
  RFID_SESSION_TEMPLATE_START: (id: string | number) => `${API_BASE_URL}/api/rfid/session-templates/${id}/start`,
  
  // Payment Schedule Templates
  PAYMENT_SCHEDULE_TEMPLATES: `${API_BASE_URL}/api/payment-schedule-templates`,
  PAYMENT_SCHEDULE_TEMPLATE_BY_ID: (id: string | number) => `${API_BASE_URL}/api/payment-schedule-templates/${id}`,
  PAYMENT_SCHEDULE_TEMPLATE_TOGGLE_STATUS: (id: string | number) => `${API_BASE_URL}/api/payment-schedule-templates/${id}/toggle-status`,
  
  // Payment Penalties
  PAYMENT_PENALTIES_RECORD: `${API_BASE_URL}/api/payment-penalties/record`,
  PAYMENT_PENALTY_BY_ID: (id: string | number) => `${API_BASE_URL}/api/payment-penalties/${id}`,
  PAYMENT_PENALTY_BY_INSTALLMENT: (installment_id: string | number) => `${API_BASE_URL}/api/payment-penalties/installment/${installment_id}`,
  PAYMENT_PENALTY_BY_STUDENT: (student_id: string | number) => `${API_BASE_URL}/api/payment-penalties/student/${student_id}`,
  // REMOVED: PAYMENT_PENALTY_WAIVE - penalties are ALWAYS charged per school policy, no admin waiving
  // Student late payment explanations (note: "waiver" in endpoint names is misleading - these are mandatory explanations, penalties are still charged)
  STUDENT_REQUEST_PENALTY_WAIVER: `${API_BASE_URL}/api/payment-penalties/request-waiver`,  // Submit explanation
  STUDENT_WAIVER_REQUESTS: `${API_BASE_URL}/api/payment-penalties/waiver-requests`,        // Get all explanations
  STUDENT_WAIVER_REQUEST_BY_ID: (id: string | number) => `${API_BASE_URL}/api/payment-penalties/waiver-requests/${id}`,

  // GCash Upload Sessions (QR proof-of-payment airdrop)
  GCASH_SESSIONS: `${API_BASE_URL}/api/gcash-sessions`,
  GCASH_SESSION_STATUS: (token: string) => `${API_BASE_URL}/api/gcash-sessions/${token}/status`,
  GCASH_SESSION_INFO: (token: string) => `${API_BASE_URL}/api/gcash-sessions/${token}/info`,
  GCASH_SESSION_UPLOAD: (token: string) => `${API_BASE_URL}/api/gcash-sessions/${token}/upload`,
  GCASH_SESSION_VIEWED: (token: string) => `${API_BASE_URL}/api/gcash-sessions/${token}/viewed`,
  
  // Sections
  SECTIONS: `${API_BASE_URL}/api/sections`,

  // Enrollment Management
  ENROLLMENTS: `${API_BASE_URL}/api/enrollments`,
  ENROLLMENT_SUBMIT: `${API_BASE_URL}/api/enrollments/submit`,
  ENROLLMENT_LATEST: `${API_BASE_URL}/api/enrollments/latest`,
  ENROLLMENT_STATUS: (id: string | number) => `${API_BASE_URL}/api/enrollments/${id}/status`,
  ENROLLMENT_DOCUMENTS: (id: string | number) => `${API_BASE_URL}/api/enrollments/${id}/documents`,
  ENROLLMENT_DISCOUNTS: (id: string | number) => `${API_BASE_URL}/api/enrollments/${id}/discounts`,
  ENROLLMENT_PREVIEW_FOR_CONTINUING: (id: string | number) => `${API_BASE_URL}/api/enrollments/${id}/preview-for-continuing`,
  ENROLLMENT_AUTO_CREATE_CONTINUING: `${API_BASE_URL}/api/enrollments/auto-create-continuing`,
  ENROLLMENT_CLASSIFY_STUDENT: `${API_BASE_URL}/api/enrollments/classify-student`,
  MY_ENROLLMENTS: `${API_BASE_URL}/api/my-enrollments`,
  STUDENT_CURRENT_GRADE: `${API_BASE_URL}/api/students/current-grade`,
  ADVISER_ENROLLMENT_PAYMENTS: (id: string | number) => `${API_BASE_URL}/api/adviser/enrollments/${id}/payments`,
  
  // Admin Enrollment Management
  ADMIN_ENROLLMENTS: `${API_BASE_URL}/api/admin/enrollments`,
  ADMIN_ENROLLMENTS_STATS: `${API_BASE_URL}/api/admin/enrollments/stats`,
  ADMIN_ENROLLMENT_DETAIL: (id: string | number) => `${API_BASE_URL}/api/admin/enrollments/${id}`,
  ADMIN_ENROLLMENT_APPROVE: (id: string | number) => `${API_BASE_URL}/api/admin/enrollments/${id}/approve`,
  ADMIN_ENROLLMENT_REJECT: (id: string | number) => `${API_BASE_URL}/api/admin/enrollments/${id}/reject`,
  ADMIN_DOCUMENT_VERIFY: (id: string | number) => `${API_BASE_URL}/api/admin/documents/${id}/verify`,
  ADMIN_DOCUMENT_REJECT: (id: string | number) => `${API_BASE_URL}/api/admin/documents/${id}/reject`,
  ADVISER_ENROLLMENTS: (level: string) => `${API_BASE_URL}/api/adviser/enrollments?level=${encodeURIComponent(level)}`,
  ADVISER_ELIGIBLE_STUDENTS: (level: string) => `${API_BASE_URL}/api/adviser/enrollments/eligible-students?level=${encodeURIComponent(level)}`,
  ADVISER_ENROLLMENT_SUBMIT: `${API_BASE_URL}/api/adviser/enrollments/submit`,
  TEACHER_ADVISER_LEVELS: `${API_BASE_URL}/api/teachers/me/adviser-levels`,

  // Activities (Grade Transparency)
  ACTIVITIES: `${API_BASE_URL}/api/activities`,
  ACTIVITY_BY_ID: (id: string | number) => `${API_BASE_URL}/api/activities/${id}`,
  ACTIVITY_GRADES: (id: string | number) => `${API_BASE_URL}/api/activities/${id}/grades`,
  ACTIVITY_GRADES_BY_PARAMS: `${API_BASE_URL}/api/activity-grades`,
  ACTIVITIES_STUDENT_GRADES: `${API_BASE_URL}/api/activities/student-grades`,
  ACTIVITIES_STUDENT_ALL: `${API_BASE_URL}/api/activities/student-all`,
  STUDENT_SIDEBAR_GRADES: `${API_BASE_URL}/api/activities/student-sidebar-grades`,
  ACTIVITIES_TEACHER_WITH_GRADES: `${API_BASE_URL}/api/teacher/activities/with-grades`,
  ACTIVITIES_COURSE_WITH_STATS: `${API_BASE_URL}/api/activities/course/with-stats`,
  EXPORT_CLASS_RECORD: `${API_BASE_URL}/api/activities/export-class-record`,
  EXPORT_CLASS_RECORD_EXCEL: `${API_BASE_URL}/api/activities/export-class-record-excel`,
  IMPORT_CLASS_RECORD: `${API_BASE_URL}/api/activities/import-class-record`,

  // Hybrid grading inputs (LMS + manual + merged)
  GRADING_INPUTS_SYNC_LMS: `${API_BASE_URL}/api/grading-inputs/sync-lms`,
  GRADING_INPUTS: `${API_BASE_URL}/api/grading-inputs`,
  GRADING_INPUT_BY_ID: (id: string | number) => `${API_BASE_URL}/api/grading-inputs/${id}`,
  GRADING_INPUT_SCORE: (id: string | number) => `${API_BASE_URL}/api/grading-inputs/${id}/score`,
  
  // Academic periods
  ACADEMIC_PERIODS: `${API_BASE_URL}/api/academic-periods`,
  ACADEMIC_PERIODS_STATS: `${API_BASE_URL}/api/academic-periods/stats`,
  ACADEMIC_PERIODS_ACTIVE: `${API_BASE_URL}/api/academic-periods/active`,
  ACADEMIC_PERIODS_GRADING_CONTEXT: `${API_BASE_URL}/api/academic-periods/grading-context`,
  ACADEMIC_PERIODS_CURRENT_SUBJECTS: `${API_BASE_URL}/api/academic-periods/current-subjects`,
  ACADEMIC_PERIOD_BY_ID: (id: string | number) => `${API_BASE_URL}/api/academic-periods/${id}`,
  ACADEMIC_PERIOD_SET_ACTIVE: (id: string | number) => `${API_BASE_URL}/api/academic-periods/${id}/set-active`,
  
  // Enrollment periods
  ENROLLMENT_PERIODS: `${API_BASE_URL}/api/enrollment-periods`,
  ENROLLMENT_PERIODS_ACTIVE: `${API_BASE_URL}/api/enrollment-periods/active`,
  ENROLLMENT_PERIOD_BY_ID: (id: string | number) => `${API_BASE_URL}/api/enrollment-periods/${id}`,
  ENROLLMENT_PERIOD_SET_ACTIVE: (id: string | number) => `${API_BASE_URL}/api/enrollment-periods/${id}/set-active`,
  
  // Document Requirements
  ADMIN_DOCUMENT_REQUIREMENTS: `${API_BASE_URL}/api/admin/document-requirements`,
  ADMIN_DOCUMENT_CATALOG: `${API_BASE_URL}/api/admin/document-catalog`,
  ADMIN_DOCUMENT_CATALOG_BY_ID: (id: string | number) => `${API_BASE_URL}/api/admin/document-catalog/${id}`,
  ADMIN_DOCUMENT_CATALOG_TOGGLE: (id: string | number) => `${API_BASE_URL}/api/admin/document-catalog/${id}/toggle`,
  DOCUMENT_REQUIREMENTS_FOR_ENROLLMENT: (gradeLevel: string, enrollmentType?: string) =>
    `${API_BASE_URL}/api/document-requirements-enrollment/${encodeURIComponent(gradeLevel)}${enrollmentType ? '/' + encodeURIComponent(enrollmentType) : ''}`,
  DOCUMENT_REQUIREMENTS_BY_GRADE: (gradeLevel: string, enrollmentType?: string) => 
    `${API_BASE_URL}/api/document-requirements/${encodeURIComponent(gradeLevel)}${enrollmentType ? '/' + encodeURIComponent(enrollmentType) : ''}`,
  
  // Campuses (location for attendance)
  CAMPUSES: `${API_BASE_URL}/api/campuses`,
  CAMPUS_BY_ID: (id: string | number) => `${API_BASE_URL}/api/campuses/${id}`,
  // Announcements
  ANNOUNCEMENTS: `${API_BASE_URL}/api/announcements`,
  ANNOUNCEMENT_BY_ID: (id: string | number) => `${API_BASE_URL}/api/announcements/${id}`,
  ANNOUNCEMENT_MARK_AS_READ: (id: string | number) => `${API_BASE_URL}/api/announcements/${id}/mark-as-read`,

  // Notifications (Audit Logs + In-App Notifications)
  NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
  NOTIFICATIONS_UNREAD_COUNT: `${API_BASE_URL}/api/notifications/unread-count`,
  NOTIFICATION_MARK_AS_READ: (id: string | number) => `${API_BASE_URL}/api/notifications/${id}/mark-as-read`,
  NOTIFICATIONS_MARK_ALL_READ: `${API_BASE_URL}/api/notifications/mark-all-as-read`,
  AUDIT_LOGS: `${API_BASE_URL}/api/notifications/audit-logs`,
  NOTIFICATIONS_STATS: `${API_BASE_URL}/api/notifications/stats`,

  // Feedback (Sentiment)
  FEEDBACK: `${API_BASE_URL}/api/feedback`,
  FEEDBACK_MY: `${API_BASE_URL}/api/feedback/my`,
  FEEDBACK_SENTIMENT_UPDATE: (id: string | number) => `${API_BASE_URL}/api/feedback/${id}/sentiment`,
  FEEDBACK_RESPONSE_UPDATE: (id: string | number) => `${API_BASE_URL}/api/feedback/${id}/response`,
  CONCERNS: `${API_BASE_URL}/api/concerns`,
  CONCERNS_MY: `${API_BASE_URL}/api/concerns/my`,
  CONCERN_MESSAGES: (id: string | number) => `${API_BASE_URL}/api/concerns/${id}/messages`,
  CONCERN_STATUS: (id: string | number) => `${API_BASE_URL}/api/concerns/${id}/status`,
  SENTIMENT_PREDICT: `${API_BASE_URL}/api/sentiment/predict`,
  // Attendance
  ATTENDANCE: `${API_BASE_URL}/api/attendance`,
  ATTENDANCE_MARK: `${API_BASE_URL}/api/attendance/mark`,
  ATTENDANCE_BULK: `${API_BASE_URL}/api/attendance/bulk`,
  ATTENDANCE_TODAY: `${API_BASE_URL}/api/attendance/today`,
  ATTENDANCE_LOGS: `${API_BASE_URL}/api/attendance/logs`,
  ATTENDANCE_STUDENT: (id: string | number) => `${API_BASE_URL}/api/attendance/student/${id}`,
  ATTENDANCE_COURSE: (id: string | number) => `${API_BASE_URL}/api/attendance/course/${id}`,
  
  // Final Grades
  FINAL_GRADES: `${API_BASE_URL}/api/final-grades`,
  FINAL_GRADES_SUBMIT: `${API_BASE_URL}/api/final-grades/submit`,
  FINAL_GRADES_SUBMISSION_CONTROL: `${API_BASE_URL}/api/final-grades/submission-control`,

  // PDF Reports
  REPORTS_STUDENTS: `${API_BASE_URL}/api/reports/students`,
  REPORTS_STUDENT_PDF: (id: string | number) => `${API_BASE_URL}/api/reports/student/${id}/pdf`,
  REPORTS_BULK_PDF: `${API_BASE_URL}/api/reports/bulk/pdf`,

  // Messages (Student & Teacher)
  MESSAGES: `${API_BASE_URL}/api/messages`,
  MESSAGES_BY_ID: (id: string | number) => `${API_BASE_URL}/api/messages/${id}`,
  MESSAGES_MARK_READ: (id: string | number) => `${API_BASE_URL}/api/messages/${id}/read`,
  MESSAGES_CONVERSATION: (user_id: string | number) => `${API_BASE_URL}/api/messages/conversation/${user_id}`,

  // Broadcasts (Teacher & Admin)
  BROADCASTS: `${API_BASE_URL}/api/broadcasts`,
  BROADCASTS_MY: `${API_BASE_URL}/api/broadcasts/my`,
  BROADCASTS_BY_ID: (id: string | number) => `${API_BASE_URL}/api/broadcasts/${id}`,
  BROADCASTS_BY_SUBJECT: (subject_id: string | number) => `${API_BASE_URL}/api/broadcasts/subject/${subject_id}`,
  BROADCASTS_BY_SECTION: (section_id: string | number) => `${API_BASE_URL}/api/broadcasts/section/${section_id}`,

  // Chatbot Knowledge (Admin)
  CHATBOT_KNOWLEDGE: `${API_BASE_URL}/api/admin/chatbot-knowledge`,
  CHATBOT_KNOWLEDGE_BY_ID: (id: string | number) => `${API_BASE_URL}/api/admin/chatbot-knowledge/${id}`,
  CHATBOT_KNOWLEDGE_TOGGLE: (id: string | number) => `${API_BASE_URL}/api/admin/chatbot-knowledge/${id}/toggle`,
  CHATBOT_MESSAGE: `${API_BASE_URL}/api/chatbot/message`,

  // Learning Materials (File Upload & Storage)
  LEARNING_MATERIALS: `${API_BASE_URL}/api/learning-materials`,
  LEARNING_MATERIALS_BY_ID: (id: string | number) => `${API_BASE_URL}/api/learning-materials/${id}`,
  LEARNING_MATERIALS_BY_SUBJECT: (subject_id: string | number, section_id: string | number, school_year?: string) => {
    const params = new URLSearchParams({ section_id: String(section_id) });
    if (school_year) params.set('school_year', school_year);
    return `${API_BASE_URL}/api/learning-materials/subject/${subject_id}?${params.toString()}`;
  },
  UPLOAD_FILE: `${API_BASE_URL}/api/upload/file`,

  // Quiz Builder (Teacher)
  QUIZ_QUESTIONS: (activityId: string | number) => `${API_BASE_URL}/api/activities/${activityId}/questions`,
  QUIZ_QUESTION: (activityId: string | number, questionId: string | number) => `${API_BASE_URL}/api/activities/${activityId}/questions/${questionId}`,
  QUIZ_SETTINGS: (activityId: string | number) => `${API_BASE_URL}/api/activities/${activityId}/settings`,
  
  // Quiz Taker (Student)
  QUIZ_START: (activityId: string | number) => `${API_BASE_URL}/api/activities/${activityId}/quiz/start`,
  QUIZ_SAVE_ANSWER: (activityId: string | number) => `${API_BASE_URL}/api/activities/${activityId}/quiz/save-answer`,
  QUIZ_SUBMIT: (activityId: string | number) => `${API_BASE_URL}/api/activities/${activityId}/quiz/submit`,
  
  // Configuration & Feature Flags
  CONFIG_FEATURES: `${API_BASE_URL}/api/config/features`,
  CONFIG_ENROLLMENT_TYPES: `${API_BASE_URL}/api/config/enrollment-types`,
};

// API helper functions
export async function apiPost(url: string, data: any) {
  const isFormData = data instanceof FormData;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: isFormData ? {} : {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important for session cookies
    body: isFormData ? data : JSON.stringify(data),
  });

  const text = await response.text();

  if (!response.ok) {
    // Try to parse error body if present, otherwise throw a generic error
    try {
      const parsed = text ? JSON.parse(text) : {};
      throw new Error(parsed.message || 'Request failed');
    } catch (e: any) {
      throw new Error((e && e.message) || 'Request failed');
    }
  }

  // If response body is empty (204, 201 with no JSON, etc.), return a success-ish object
  if (!text) return { success: true };

  try {
    return JSON.parse(text);
  } catch (e) {
    // If parsing fails, return an object so callers don't crash
    return { success: true };
  }
}

export async function apiGet(url: string) {
  const request = async () => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for session cookies
      cache: 'no-store',
    });

    const text = await response.text();
    return { response, text };
  };

  const checkSession = async (): Promise<boolean> => {
    try {
      const response = await fetch(API_ENDPOINTS.CHECK, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) return false;

      const text = await response.text();
      if (!text) return false;

      const parsed = JSON.parse(text);
      return !!parsed?.authenticated;
    } catch {
      return false;
    }
  };

  let { response, text } = await request();

  // Handle occasional transient 401 due to session timing/race on first request.
  if (response.status === 401) {
    await new Promise(resolve => setTimeout(resolve, 250));
    ({ response, text } = await request());
  }

  // If still 401, attempt session revalidation then retry once.
  if (response.status === 401) {
    const sessionOk = await checkSession();
    if (sessionOk) {
      ({ response, text } = await request());
    }
  }

  if (!response.ok) {
    try {
      const parsed = text ? JSON.parse(text) : {};
      throw new Error(parsed.message || 'Request failed');
    } catch (e: any) {
      throw new Error((e && e.message) || 'Request failed');
    }
  }

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

export async function apiPut(url: string, data: any) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important for session cookies
    body: JSON.stringify(data),
  });

  const text = await response.text();

  if (!response.ok) {
    try {
      const parsed = text ? JSON.parse(text) : {};
      throw new Error(parsed.message || 'Request failed');
    } catch (e: any) {
      throw new Error((e && e.message) || 'Request failed');
    }
  }

  if (!text) return { success: true };

  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: true };
  }
}

export async function apiDelete(url: string, data?: any) {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important for session cookies
    body: data ? JSON.stringify(data) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
    try {
      const parsed = text ? JSON.parse(text) : {};
      throw new Error(parsed.message || 'Request failed');
    } catch (e: any) {
      throw new Error((e && e.message) || 'Request failed');
    }
  }

  if (!text) return { success: true };

  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: true };
  }
}

/**
 * Upload file (multipart/form-data)
 * @param url API endpoint
 * @param file File object to upload
 * @param fieldName Form field name (default: 'file')
 * @param additionalData Optional additional form fields
 */
export async function apiUploadFile(url: string, file: File, fieldName: string = 'file', additionalData?: Record<string, string>) {
  const formData = new FormData();
  formData.append(fieldName, file);

  // Add any additional form fields
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include', // Important for session cookies
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary
  });

  const text = await response.text();

  if (!response.ok) {
    try {
      const parsed = text ? JSON.parse(text) : {};
      throw new Error(parsed.message || 'Upload failed');
    } catch (e: any) {
      throw new Error((e && e.message) || 'Upload failed');
    }
  }

  if (!text) return { success: true };

  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: true };
  }
}

// Alias for backward compatibility
export const apiUpload = apiUploadFile;

