import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { usePaymentPageLock } from "./hooks/usePaymentPageLock";
import { FEATURES } from "@/config/features";
import { isProductionDeployment } from "@/config/deployEnv";
import StudentMessaging from "./pages/student/Messaging";
import TeacherMessaging from "./pages/teacher/Messaging";
import { AuthProvider } from "./hooks/useAuth";
import { useAuth } from "./hooks/useAuth";
import { ConfirmProvider } from "@/components/Confirm";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotificationProvider } from "@/context/NotificationContext";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { TranslationProvider } from "@/context/TranslationContext";
import { WalkthroughProvider } from "@/context/WalkthroughContext";
import { NotificationContainer } from "@/components/NotificationContainer";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import ChatbotWidget from "@/components/ChatbotWidget";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import StudentLogin from "./pages/StudentLogin";
import EmailVerification from "./pages/EmailVerification";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ForgotPin from "./pages/ForgotPin";
import ResetPin from "./pages/ResetPin";
import StudentDashboard from "./pages/StudentDashboard";
import EnrolleeDashboard from "./pages/EnrolleeDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import SetPassword from "./pages/SetPassword";
import UserManagement from "./pages/admin/UserManagement";
import GradingSystem from "./pages/admin/GradingSystem";
import SubjectAssignment from "./pages/admin/SubjectAssignment";
import Announcements from "./pages/admin/Announcements";
import PDFGeneration from "./pages/admin/PDFGeneration";
import StudentNotifications from "./pages/student/Notifications";
import TeacherNotifications from "./pages/teacher/Notifications";
import AdminSettings from "./pages/admin/AdminSettings";
import AcademicPeriods from "./pages/admin/AcademicPeriods";
import EnrollmentSettings from "./pages/admin/EnrollmentSettings";
import ManagementPage from "./pages/admin/ManagementPage";
import Teachers from "./pages/admin/users/Teachers";
import TeacherCourseAssignment from "./pages/admin/users/TeacherCourseAssignment";
import Students from "./pages/admin/users/Students";
import Subjects from "./pages/admin/users/Subjects";
import Sections from "./pages/admin/users/Sections";
import SectionDetail from "./pages/admin/users/SectionDetail";
import StudentGradeLevelManagement from "./pages/admin/users/StudentGradeLevelManagement";
import Payments from "./pages/admin/Payments";
import PaymentPlans from "./pages/admin/PaymentPlans";
import InstallmentScheduleManagement from "./pages/admin/InstallmentScheduleManagement";
import StudentInstallmentDetails from "./pages/admin/StudentInstallmentDetails";
import GcashSessionPage from "./pages/admin/GcashSessionPage";
import TuitionPackages from "./pages/admin/TuitionPackages";
import UniformManagement from "./pages/admin/UniformManagement";
import UniformOrders from "./pages/admin/UniformOrders";
import SchoolServiceManagement from "./pages/admin/SchoolServiceManagement";
import RFIDAttendance from "./pages/admin/RFIDAttendance";
import RFIDManagement from "./pages/admin/RFIDManagement";
import AdviserManualEnrollment from "./pages/teacher/AdviserManualEnrollment";
import AdminSentimentAnalytics from "./pages/admin/SentimentAnalytics";
import AdminChatbotKnowledge from "./pages/admin/AdminChatbotKnowledge";
import PredictiveAnalytics from "./pages/admin/PredictiveAnalytics";

// Enrollment pages
import EnrollmentForm from "./pages/enrollment/EnrollmentForm";
import EnrollmentStatus from "./pages/enrollment/EnrollmentStatus";
import MyEnrollments from "./pages/enrollment/MyEnrollments";
import Payment from "./pages/enrollment/Payment";
import PaymentProcess from "./pages/enrollment/PaymentProcess";
import InstallmentPlans from "./pages/enrollment/InstallmentPlans";
import WaiverRequests from "./pages/enrollment/WaiverRequests";
import SetupPin from "./pages/enrollment/SetupPin";
import VerifyPin from "./pages/enrollment/VerifyPin";
import EnrollmentDetail from "./pages/admin/EnrollmentDetail";
import AdminEnrollmentCreate from "./pages/admin/AdminEnrollmentCreate";

// Teacher pages
import Courses from "./pages/teacher/Courses";
import CourseManagement from "./pages/teacher/CourseManagement";
import ActivityDetail from "./pages/teacher/ActivityDetail";
import ActivityOutputs from "./pages/teacher/ActivityOutputs";
import QuizBuilder from "./pages/teacher/QuizBuilder";
import QuizReview from "./pages/teacher/QuizReview";
import StudentQuizReview from "./pages/teacher/StudentQuizReview";
import Activities from "./pages/teacher/Activities";
// import StudentManagement from "./pages/teacher/StudentManagement";
// import StudentDetail from "./pages/teacher/StudentDetail";
import GradeInput from "./pages/teacher/GradeInput";
import GradeInputEdit from "./pages/teacher/GradeInputEdit";
import TeacherSettings from "./pages/teacher/TeacherSettings";
import AttendanceDashboard from "./pages/teacher/AttendanceDashboard";
import AttendanceSession from "./pages/teacher/AttendanceSession";
import AttendanceHistory from "./pages/teacher/AttendanceHistory";

// Student pages
import MyCourses from "./pages/student/MyCourses";
import CourseDetails from "./pages/student/CourseDetails";
import StudentCourseManagement from "./pages/student/CourseManagement";
import QuizTaker from "./pages/student/QuizTaker";
import ActivitySubmit from "./pages/student/ActivitySubmit";
import MyActivities from "./pages/student/MyActivities";
import MyGrades from "./pages/student/MyGrades";
import MyProgress from "./pages/student/MyProgress";
import CourseGradeDetail from "./pages/student/CourseGradeDetail";
import StudentSettings from "./pages/student/StudentSettings";
import StudentFeedbackSentiment from "./pages/student/FeedbackSentiment";
import StudentForum from "./pages/student/Forum";
// StudentAttendanceQR removed - Attendance QR not used
// Dev / Example components
import { PaymentFormExample } from "./components/PaymentFormExample";
// Public: GCash proof-of-payment upload page (scanned by student via QR)
import PaymentProofUpload from "./pages/PaymentProofUpload";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user } = useAuth();
  // Monitor payment section lock/unlock across all pages
  usePaymentPageLock();
  const isProd = isProductionDeployment;
  const showFloatingChatbot = true;  // Chatbot enabled for all users in production
  
  // Lazy-load Campuses only at runtime inside the component to avoid top-level evaluation issues
  let LazyCampuses: any = null;
  if (FEATURES.attendance) {
    LazyCampuses = lazy(() => import('./pages/admin/Campuses'));
  }


  return (
    <>
      <NotificationContainer />
      {showFloatingChatbot && <ChatbotWidget />}
      <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/register" element={<Register />} />
            <Route path="/student-login" element={<StudentLogin />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset" element={<ResetPassword />} />
            <Route path="/auth/forgot-pin" element={<ForgotPin />} />
            <Route path="/auth/reset-pin" element={<ResetPin />} />
            <Route path="/verify-email" element={<EmailVerification />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Student Routes */}
            <Route path="/student/dashboard" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
            {FEATURES.courses && (
              <>
                <Route path="/student/courses" element={<ProtectedRoute requiredRole="student"><MyCourses /></ProtectedRoute>} />
                <Route path="/student/courses/:courseId" element={<ProtectedRoute requiredRole="student"><StudentCourseManagement /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.activities && (
              <>
                <Route path="/student/activities" element={<ProtectedRoute requiredRole="student"><MyActivities /></ProtectedRoute>} />
                <Route path="/student/courses/:courseId/activities/:activityId/quiz" element={<ProtectedRoute requiredRole="student"><QuizTaker /></ProtectedRoute>} />
                <Route path="/student/courses/:courseId/activities/:activityId/submit" element={<ProtectedRoute requiredRole="student"><ActivitySubmit /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.grading && (
              <>
                <Route path="/student/grades" element={<ProtectedRoute requiredRole="student"><MyGrades /></ProtectedRoute>} />
                <Route path="/student/progress" element={<ProtectedRoute requiredRole="student"><MyProgress /></ProtectedRoute>} />
                <Route path="/student/course-grade-detail/:courseId" element={<ProtectedRoute requiredRole="student"><CourseGradeDetail /></ProtectedRoute>} />
              </>
            )}
            <Route path="/student/settings" element={<ProtectedRoute requiredRole="student"><StudentSettings /></ProtectedRoute>} />
            {FEATURES.messages && (
              <Route path="/student/messages" element={<ProtectedRoute requiredRole="student"><StudentMessaging /></ProtectedRoute>} />
            )}
            {!isProd && (
              <Route path="/student/forum" element={<ProtectedRoute requiredRole="student"><StudentForum /></ProtectedRoute>} />
            )}
            <Route path="/student/feedback" element={<ProtectedRoute requiredRole="student"><StudentFeedbackSentiment /></ProtectedRoute>} />
            
            {/* Enrollee Routes */}
            <Route path="/enrollee/dashboard" element={<ProtectedRoute requiredRole="enrollee"><EnrolleeDashboard /></ProtectedRoute>} />
            {FEATURES.enrollment && (
              <>
                <Route path="/enrollee/enrollment" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><MyEnrollments /></ProtectedRoute>} />
                <Route path="/enrollee/enrollment-form" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><EnrollmentForm /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.payment && (
              <Route path="/enrollee/payment" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><Payment /></ProtectedRoute>} />
            )}
            
            {/* Teacher Routes */}
            <Route path="/teacher/dashboard" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
            {FEATURES.courses && (
              <>
                <Route path="/teacher/courses" element={<ProtectedRoute requiredRole="teacher"><Courses /></ProtectedRoute>} />
                {FEATURES.courseManagement && (
                  <Route path="/teacher/courses/:courseId" element={<ProtectedRoute requiredRole="teacher"><CourseManagement /></ProtectedRoute>} />
                )}
              </>
            )}
            {FEATURES.activities && (
              <>
                <Route path="/teacher/courses/:courseId/activities/:activityId" element={<ProtectedRoute requiredRole="teacher"><ActivityDetail /></ProtectedRoute>} />
                <Route path="/teacher/courses/:courseId/activities/:activityId/outputs" element={<ProtectedRoute requiredRole="teacher"><ActivityOutputs /></ProtectedRoute>} />
                <Route path="/teacher/courses/:courseId/activities/:activityId/quiz-builder" element={<ProtectedRoute requiredRole="teacher"><QuizBuilder /></ProtectedRoute>} />
                <Route path="/teacher/courses/:courseId/activities/:activityId/review" element={<ProtectedRoute requiredRole="teacher"><QuizReview /></ProtectedRoute>} />
                <Route path="/teacher/courses/:courseId/activities/:activityId/review/:studentId" element={<ProtectedRoute requiredRole="teacher"><StudentQuizReview /></ProtectedRoute>} />
                <Route path="/teacher/activities" element={<ProtectedRoute requiredRole="teacher"><Activities /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.grading && (
              <>
                <Route path="/teacher/grades" element={<ProtectedRoute requiredRole={["teacher", "admin"]}><GradeInput /></ProtectedRoute>} />
                <Route path="/teacher/grade-input-edit" element={<ProtectedRoute requiredRole={["teacher", "admin"]}><GradeInputEdit /></ProtectedRoute>} />
              </>
            )}
            <Route path="/teacher/settings" element={<ProtectedRoute requiredRole="teacher"><TeacherSettings /></ProtectedRoute>} />
            {FEATURES.attendance && (
              <>
                <Route path="/teacher/attendance" element={<ProtectedRoute requiredRole="teacher"><AttendanceDashboard /></ProtectedRoute>} />
                <Route path="/teacher/attendance-session" element={<ProtectedRoute requiredRole="teacher"><AttendanceSession /></ProtectedRoute>} />
                <Route path="/teacher/attendance-history" element={<ProtectedRoute requiredRole="teacher"><AttendanceHistory /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.messages && (
              <Route path="/teacher/messages" element={<ProtectedRoute requiredRole="teacher"><TeacherMessaging /></ProtectedRoute>} />
            )}
            {FEATURES.announcements && (
              <Route path="/teacher/announcements" element={<ProtectedRoute requiredRole="teacher"><Announcements /></ProtectedRoute>} />
            )}
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            {!isProd && (
              <Route path="/admin/chatbot-knowledge" element={<ProtectedRoute requiredRole="admin"><AdminChatbotKnowledge /></ProtectedRoute>} />
            )}
            {FEATURES.enrollment && (
              <>
                <Route path="/admin/enrollments" element={<ProtectedRoute requiredRole={["admin", "teacher"]}><ManagementPage /></ProtectedRoute>} />
                <Route path="/admin/enrollments/new" element={<ProtectedRoute requiredRole="admin"><AdminEnrollmentCreate /></ProtectedRoute>} />
                <Route path="/admin/enrollments/:enrollmentId" element={<ProtectedRoute requiredRole={["admin", "teacher"]}><EnrollmentDetail /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.enrollment && FEATURES.adviserEnrollment && (
              <Route path="/adviser/enrollments/new" element={<ProtectedRoute requiredRole="teacher"><AdviserManualEnrollment /></ProtectedRoute>} />
            )}
            {FEATURES.payment && (
              <>
                <Route path="/admin/payments" element={<ProtectedRoute requiredRole="admin"><Payments /></ProtectedRoute>} />
                <Route path="/admin/payment-plans" element={<ProtectedRoute requiredRole="admin"><PaymentPlans /></ProtectedRoute>} />
                <Route path="/admin/payment-plans/:planId" element={<ProtectedRoute requiredRole="admin"><StudentInstallmentDetails /></ProtectedRoute>} />
                <Route path="/admin/gcash-session/:token" element={<ProtectedRoute requiredRole="admin"><GcashSessionPage /></ProtectedRoute>} />
                <Route path="/admin/installment-schedules" element={<ProtectedRoute requiredRole="admin"><InstallmentScheduleManagement /></ProtectedRoute>} />
                <Route path="/admin/tuition-packages" element={<ProtectedRoute requiredRole="admin"><TuitionPackages /></ProtectedRoute>} />
                <Route path="/admin/uniform-management" element={<ProtectedRoute requiredRole="admin"><UniformManagement /></ProtectedRoute>} />
                <Route path="/admin/uniform-orders" element={<ProtectedRoute requiredRole="admin"><UniformOrders /></ProtectedRoute>} />
                <Route path="/admin/school-services" element={<ProtectedRoute requiredRole="admin"><SchoolServiceManagement /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.attendance && (
              <Route path="/admin/rfid-attendance" element={<ProtectedRoute requiredRole="admin"><RFIDAttendance /></ProtectedRoute>} />
            )}
            {FEATURES.attendance && (
              <Route path="/admin/rfid-management" element={<ProtectedRoute requiredRole="admin"><RFIDManagement /></ProtectedRoute>} />
            )}
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute>} />
            {FEATURES.teacherManagement && (
              <Route path="/admin/users/teachers" element={<ProtectedRoute requiredRole="admin"><Teachers /></ProtectedRoute>} />
            )}
            <Route path="/admin/users/students" element={<ProtectedRoute requiredRole="admin"><Students /></ProtectedRoute>} />
            {FEATURES.teacherManagement && (
              <>
                <Route path="/admin/teachers/:teacherId/courses" element={<ProtectedRoute requiredRole="admin"><TeacherCourseAssignment /></ProtectedRoute>} />
                <Route path="/admin/users/teachers/:teacherId/courses" element={<ProtectedRoute requiredRole="admin"><TeacherCourseAssignment /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.courses && (
              <>
                <Route path="/admin/users/students/graduation" element={<ProtectedRoute requiredRole="admin"><StudentGradeLevelManagement /></ProtectedRoute>} />
                <Route path="/admin/users/students/grades" element={<ProtectedRoute requiredRole="admin"><StudentGradeLevelManagement /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.subjects && (
              <>
                <Route path="/admin/users/subjects" element={<ProtectedRoute requiredRole="admin"><Subjects /></ProtectedRoute>} />
                <Route path="/admin/assignments" element={<ProtectedRoute requiredRole="admin"><SubjectAssignment /></ProtectedRoute>} />
              </>
            )}
            <Route path="/admin/users/sections" element={<ProtectedRoute requiredRole="admin"><Sections /></ProtectedRoute>} />
            <Route path="/admin/users/sections/:sectionId" element={<ProtectedRoute requiredRole="admin"><SectionDetail /></ProtectedRoute>} />
            {FEATURES.grading && (
              <Route path="/admin/grading" element={<ProtectedRoute requiredRole="admin"><GradingSystem /></ProtectedRoute>} />
            )}
            {FEATURES.announcements && (
              <Route path="/admin/announcements" element={<ProtectedRoute requiredRole="admin"><Announcements /></ProtectedRoute>} />
            )}
            {FEATURES.reports && (
              <>
                <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><PDFGeneration /></ProtectedRoute>} />
                <Route path="/admin/pdf" element={<ProtectedRoute requiredRole="admin"><PDFGeneration /></ProtectedRoute>} />
              </>
            )}
            <Route path="/student/notifications" element={<ProtectedRoute requiredRole="student"><StudentNotifications /></ProtectedRoute>} />
            <Route path="/teacher/notifications" element={<ProtectedRoute requiredRole="teacher"><TeacherNotifications /></ProtectedRoute>} />
            <Route path="/admin/academic-periods" element={<ProtectedRoute requiredRole="admin"><AcademicPeriods /></ProtectedRoute>} />
            <Route path="/admin/enrollment-settings" element={<ProtectedRoute requiredRole="admin"><EnrollmentSettings /></ProtectedRoute>} />
            {FEATURES.attendance && LazyCampuses && (
              <Route path="/admin/campuses" element={<ProtectedRoute requiredRole="admin"><Suspense fallback={null}><LazyCampuses /></Suspense></ProtectedRoute>} />
            )}
            <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/sentiment" element={<ProtectedRoute requiredRole="admin"><AdminSentimentAnalytics /></ProtectedRoute>} />
            {FEATURES.analytics && (
              <Route path="/admin/predictive-analytics" element={<ProtectedRoute requiredRole="admin"><PredictiveAnalytics /></ProtectedRoute>} />
            )}
            
            {/* Enrollment Routes - Open to both enrollees and students */}
            {FEATURES.enrollment && (
              <>
                <Route path="/enrollment/new" element={<ProtectedRoute requiredRole={["enrollee", "student", "admin"]}><EnrollmentForm /></ProtectedRoute>} />
                <Route path="/enrollment/status/:enrollmentId" element={<ProtectedRoute requiredRole={["enrollee", "student", "admin"]}><EnrollmentStatus /></ProtectedRoute>} />
                <Route path="/enrollment/my-enrollments" element={<ProtectedRoute requiredRole={["enrollee", "student", "admin"]}><MyEnrollments /></ProtectedRoute>} />
                <Route path="/enrollment/setup-pin" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><SetupPin /></ProtectedRoute>} />
                <Route path="/enrollment/verify-pin" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><VerifyPin /></ProtectedRoute>} />
                {/* Duplicate routes under /enrollee prefix to support older links and hooks that navigate with the enrollee prefix */}
                <Route path="/enrollee/new" element={<ProtectedRoute requiredRole={["enrollee", "student", "admin"]}><EnrollmentForm /></ProtectedRoute>} />
                <Route path="/enrollee/status/:enrollmentId" element={<ProtectedRoute requiredRole={["enrollee", "student", "admin"]}><EnrollmentStatus /></ProtectedRoute>} />
                <Route path="/enrollee/my-enrollments" element={<ProtectedRoute requiredRole={["enrollee", "student", "admin"]}><MyEnrollments /></ProtectedRoute>} />
                <Route path="/enrollee/setup-pin" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><SetupPin /></ProtectedRoute>} />
                <Route path="/enrollee/verify-pin" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><VerifyPin /></ProtectedRoute>} />
              </>
            )}
            {FEATURES.payment && (
              <>
                <Route path="/enrollment/payment" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><Payment /></ProtectedRoute>} />
                <Route path="/enrollment/payment-process" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><PaymentProcess /></ProtectedRoute>} />
                <Route path="/enrollment/installment-plans" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><InstallmentPlans /></ProtectedRoute>} />
                <Route path="/enrollment/waiver-requests" element={<ProtectedRoute requiredRole={["enrollee", "student"]}><WaiverRequests /></ProtectedRoute>} />
              </>
            )}
            
            {/* Public: GCash proof upload (no auth — token is the credential) */}
            <Route path="/payment-proof/:token" element={<PaymentProofUpload />} />

            {/* Dev: Payment example route (remove or guard in production) */}
            <Route
              path="/dev/payment-example"
              element={
                <PaymentFormExample
                  installment={{
                    installment_id: 1,
                    installment_number: 1,
                    due_date: '2026-01-15',
                    balance: 5000,
                    amount: 5000,
                    status: 'Pending'
                  }}
                />
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
    </>
  );
};

// Determine router basename from Vite base (import.meta.env.BASE_URL)
const routerBase = (() => {
  try {
    const b = String(import.meta.env.BASE_URL || '/');
    // remove trailing slash except for root
    const normalized = b === '/' ? '/' : b.replace(/\/$/, '');

    // If app is served from domain root via rewrite (clean URL mode),
    // forcing basename to '/' avoids blank render when BASE_URL is '/ui/'.
    if (normalized !== '/' && typeof window !== 'undefined' && !window.location.pathname.startsWith(normalized + '/')) {
      return '/';
    }

    return normalized;
  } catch (e) {
    return '/';
  }
})();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TranslationProvider>
        <WalkthroughProvider>
          <FeaturesProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PWAInstallPrompt />
              <NotificationProvider>
                <BrowserRouter basename={routerBase}>
                  <AuthProvider>
                    <ConfirmProvider>
                      <AppContent />
                    </ConfirmProvider>
                  </AuthProvider>
                </BrowserRouter>
              </NotificationProvider>
            </TooltipProvider>
          </FeaturesProvider>
        </WalkthroughProvider>
      </TranslationProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
