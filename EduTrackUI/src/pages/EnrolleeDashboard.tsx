import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, ClipboardList, FileText, Calendar, User, ArrowRight, AlertCircle, Mail, CalendarClock, Users, CreditCard } from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useTranslatedTexts, useTranslation } from "@/context/TranslationContext";

interface EnrollmentData {
  id: number;
  status: "pending" | "incomplete" | "under_review" | "verified" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  grade_level?: string;
  school_year?: string;
}

const DASHBOARD_TEXT_STRINGS = [
  "Welcome",
  "Enrollee Account Dashboard",
  "Go to Enrollment",
  "Email Verification Required",
  "Verify your email address",
  "to unlock enrollment and payment features. Click the button below to send a verification link to your email.",
  "Send Verification Email",
  "Sending...",
  "Enrollment Period",
  "Open",
  "Upcoming",
  "Closed",
  "Start Date",
  "End Date",
  "slots filled",
  "Allowed Grade Levels",
  "Start Enrollment Application",
  "Enrollment will open on",
  "This enrollment period has closed",
  "Welcome to Maranatha Christian Academy Foundation Enrollee Dashboard!",
  "Start your enrollment journey by filling out the application form.",
  "Email verified",
  "Enrollment Status",
  "Application Status",
  "No Admission",
  "Pending Review",
  "Incomplete",
  "Under Review",
  "Verified",
  "Approved",
  "Rejected",
  "Enrollment Submitted",
  "Last updated:",
  "Grade Level:",
  "School Year:",
  "No active enrollment found",
  "Account Information",
  "Email",
  "Role",
  "Quick Actions",
  "View Enrollment",
  "Payment Status",
  "Please verify your email first",
  "Enrollment Workflow",
  "Track your progress through the enrollment process",
  "Create Account & Verify Email",
  "Register and verify your email address.",
  "Submit Enrollment Application",
  "Fill out and submit your enrollment form with required documents.",
  "Application Under Review",
  "Our admissions team is reviewing your application. This typically takes 2-3 business days.",
  "Approval & Payment",
  "Once approved, proceed with tuition payment to complete enrollment.",
  "Access Your Classes",
  "Gain full access to your courses and student resources.",
  "Completed",
  "In Progress",
  "Waiting for Submission",
  "Pending",
  "Need Help?",
  "If you have any questions about your enrollment status or need assistance, please don't hesitate to contact our admissions team.",
  "Contact Support",
  "Loading your dashboard",
  "Fetching your enrollment and account information...",
];

const DASHBOARD_TOUR_TEXT_STRINGS = [
  "🏠 Welcome to Your Dashboard",
  "Your gateway to enrollment and account management.",
  "📧 Email Verification Required",
  "You need to verify your email address to access enrollment and payment features.",
  "Click this button to send a verification email to your inbox. Check your spam folder if you don't see it.",
  "Once verified, this button will become active and you can start your enrollment application.",
  "Great! Your email is verified. You can now access all enrollment features.",
  "📅 Active Enrollment Period",
  "Enrollment is currently open! You can start your application right away.",
  "Enrollment period is upcoming. You can prepare your information now.",
  "Check the enrollment period status and deadlines.",
  "Click here to start your enrollment application now that the period is open!",
  "Click here to start or continue your enrollment application.",
  "Quick access to your most important enrollment and payment features.",
  "Check your payment status and outstanding balances here.",
  "Monitor your enrollment status and account information here.",
  "Track your progress through each step of the enrollment process.",
  "🎉 Congratulations! Enrollment Submitted",
  "Your enrollment application has been successfully submitted. The next step is to set up your tuition payment plan.",
  "✅ Enrollment Complete",
  "Great job! Your enrollment application is now under review. While waiting for approval, you can prepare your payment plan.",
  "💳 Next Step: Payment Planning",
  "Click the \"Payment Status\" button below to choose your tuition payment plan. This will help you manage your tuition fees effectively.",
  "📋 Choose Your Payment Plan",
  "Select from flexible payment options including full payment (with discount) or installment plans. Early payment may qualify for additional discounts!",
  "📈 Your Progress",
  "You're on step 2 of 5! Once your enrollment is approved, you'll move to the payment phase. Keep an eye on your email for approval notifications.",
  "📋 Enrollment Records Navigation",
  "Let me show you how to access and manage your enrollment records. This is where you can view all your enrollment applications and their current status.",
  "🔍 Quick Actions Panel",
  "This panel provides quick access to your most important enrollment and payment features. The \"View Enrollment\" button will take you to your enrollment records.",
  "👆 View Enrollment Button",
  "Click this button to navigate to your enrollment records page. There you'll find:",
  "All your enrollment applications",
  "Current status of each application",
  "Application details and timelines",
  "Options to start new enrollments",
  "🚀 Ready to Explore?",
  "Go ahead and click the \"View Enrollment\" button now to see your enrollment records. You'll be guided through the features on that page as well!",
  "🎉 Enrollment Verified!",
  "Congratulations! Your enrollment status has been verified. You are now ready to proceed with your tuition payment to complete your enrollment.",
  "💳 Navigate to Payments",
  "You can easily access the payment section from the Quick Actions card below. Click the \"Payment Status\" button to go to your payment dashboard where you can set up your tuition payment plan.",
  "📋 Payment Status Button",
  "This button will take you directly to the payments section. Here you can:",
  "View your outstanding tuition balance",
  "Choose between full payment or installment plans",
  "Apply any available discounts",
  "Complete your tuition payment",
  "🚀 Complete Your Enrollment",
  "Click the \"Payment Status\" button in the Quick Actions section to proceed to the payments page and settle your tuition fee. This will complete your enrollment!",
  "Finish",
  "Skip",
  "Go to Payments",
] as const;

const EnrolleeDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  // Tour State
  const [runUnverifiedTour, setRunUnverifiedTour] = useState(false);
  const [runVerifiedTour, setRunVerifiedTour] = useState(false);
  const [runEnrollmentSubmittedTour, setRunEnrollmentSubmittedTour] = useState(false);
  const [runVerifiedEnrollmentTour, setRunVerifiedEnrollmentTour] = useState(false);
  const [runEnrollmentRecordsTour, setRunEnrollmentRecordsTour] = useState(false);
  const [tourScrollOffset, setTourScrollOffset] = useState(20);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(56);
  const { currentLanguage } = useTranslation();

  const isEmailVerified = user?.status !== 'pending';

  const translatedTexts = useTranslatedTexts(DASHBOARD_TEXT_STRINGS);
  
  // Create translation object for easy access
  const t = useMemo(() => ({
    welcome: translatedTexts[0],
    enrolleeAccountDashboard: translatedTexts[1],
    goToEnrollment: translatedTexts[2],
    emailVerificationRequired: translatedTexts[3],
    verifyEmailAddress: translatedTexts[4],
    toUnlockEnrollment: translatedTexts[5],
    sendVerificationEmail: translatedTexts[6],
    sending: translatedTexts[7],
    enrollmentPeriod: translatedTexts[8],
    open: translatedTexts[9],
    upcoming: translatedTexts[10],
    closed: translatedTexts[11],
    startDate: translatedTexts[12],
    endDate: translatedTexts[13],
    slotsFilled: translatedTexts[14],
    allowedGradeLevels: translatedTexts[15],
    startEnrollmentApplication: translatedTexts[16],
    enrollmentWillOpenOn: translatedTexts[17],
    enrollmentPeriodClosed: translatedTexts[18],
    welcomeToMaranatha: translatedTexts[19],
    startYourJourney: translatedTexts[20],
    emailVerified: translatedTexts[21],
    enrollmentStatus: translatedTexts[22],
    applicationStatus: translatedTexts[23],
    noAdmission: translatedTexts[24],
    pendingReview: translatedTexts[25],
    incomplete: translatedTexts[26],
    underReview: translatedTexts[27],
    verified: translatedTexts[28],
    approved: translatedTexts[29],
    rejected: translatedTexts[30],
    enrollmentSubmitted: translatedTexts[31],
    lastUpdated: translatedTexts[32],
    gradeLevel: translatedTexts[33],
    schoolYear: translatedTexts[34],
    noActiveEnrollment: translatedTexts[35],
    accountInformation: translatedTexts[36],
    email: translatedTexts[37],
    role: translatedTexts[38],
    quickActions: translatedTexts[39],
    viewEnrollment: translatedTexts[40],
    paymentStatus: translatedTexts[41],
    pleaseVerifyEmail: translatedTexts[42],
    enrollmentWorkflow: translatedTexts[43],
    trackYourProgress: translatedTexts[44],
    createAccountVerifyEmail: translatedTexts[45],
    registerAndVerify: translatedTexts[46],
    submitEnrollmentApplication: translatedTexts[47],
    fillOutAndSubmit: translatedTexts[48],
    applicationUnderReview: translatedTexts[49],
    admissionsReviewing: translatedTexts[50],
    approvalAndPayment: translatedTexts[51],
    onceApprovedProceed: translatedTexts[52],
    accessYourClasses: translatedTexts[53],
    gainFullAccess: translatedTexts[54],
    completed: translatedTexts[55],
    inProgress: translatedTexts[56],
    waitingForSubmission: translatedTexts[57],
    pending: translatedTexts[58],
    needHelp: translatedTexts[59],
    needHelpDescription: translatedTexts[60],
    contactSupport: translatedTexts[61],
    loadingDashboard: translatedTexts[62],
    fetchingInformation: translatedTexts[63],
  }), [translatedTexts]);

  const translatedTourTexts = useTranslatedTexts([...DASHBOARD_TOUR_TEXT_STRINGS]);
  const tt = useMemo(() => ({
    welcomeTitle: translatedTourTexts[0],
    welcomeDescription: translatedTourTexts[1],
    emailVerificationTitle: translatedTourTexts[2],
    emailVerificationDescription: translatedTourTexts[3],
    resendEmailDescription: translatedTourTexts[4],
    startEnrollmentDescription: translatedTourTexts[5],
    verifiedIntroDescription: translatedTourTexts[6],
    activePeriodTitle: translatedTourTexts[7],
    activePeriodOpen: translatedTourTexts[8],
    activePeriodUpcoming: translatedTourTexts[9],
    activePeriodFallback: translatedTourTexts[10],
    startWhenOpenDescription: translatedTourTexts[11],
    startGeneralDescription: translatedTourTexts[12],
    quickAccessDescription: translatedTourTexts[13],
    paymentStatusDescription: translatedTourTexts[14],
    monitorStatusDescription: translatedTourTexts[15],
    workflowTrackDescription: translatedTourTexts[16],
    submittedTitle: translatedTourTexts[17],
    submittedDescription: translatedTourTexts[18],
    completeTitle: translatedTourTexts[19],
    completeDescription: translatedTourTexts[20],
    paymentPlanningTitle: translatedTourTexts[21],
    paymentPlanningDescription: translatedTourTexts[22],
    choosePlanTitle: translatedTourTexts[23],
    choosePlanDescription: translatedTourTexts[24],
    progressTitle: translatedTourTexts[25],
    progressDescription: translatedTourTexts[26],
    recordsTitle: translatedTourTexts[27],
    recordsDescription: translatedTourTexts[28],
    quickPanelTitle: translatedTourTexts[29],
    quickPanelDescription: translatedTourTexts[30],
    viewEnrollmentTitle: translatedTourTexts[31],
    viewEnrollmentDescription: translatedTourTexts[32],
    viewEnrollmentList1: translatedTourTexts[33],
    viewEnrollmentList2: translatedTourTexts[34],
    viewEnrollmentList3: translatedTourTexts[35],
    viewEnrollmentList4: translatedTourTexts[36],
    readyTitle: translatedTourTexts[37],
    readyDescription: translatedTourTexts[38],
    verifiedEnrollmentTitle: translatedTourTexts[39],
    verifiedEnrollmentDescription: translatedTourTexts[40],
    navigatePaymentsTitle: translatedTourTexts[41],
    navigatePaymentsDescription: translatedTourTexts[42],
    paymentButtonTitle: translatedTourTexts[43],
    paymentButtonDescription: translatedTourTexts[44],
    paymentList1: translatedTourTexts[45],
    paymentList2: translatedTourTexts[46],
    paymentList3: translatedTourTexts[47],
    paymentList4: translatedTourTexts[48],
    completeEnrollmentTitle: translatedTourTexts[49],
    completeEnrollmentDescription: translatedTourTexts[50],
    finish: translatedTourTexts[51],
    skip: translatedTourTexts[52],
    goToPayments: translatedTourTexts[53],
  }), [translatedTourTexts]);

  const enrollmentPeriodText = useMemo(() => {
    if (currentLanguage === "tl") {
      return {
        enrollmentPeriod: DASHBOARD_TEXT_STRINGS[8],
        startDate: DASHBOARD_TEXT_STRINGS[12],
        endDate: DASHBOARD_TEXT_STRINGS[13],
        slotsFilled: DASHBOARD_TEXT_STRINGS[14],
        allowedGradeLevels: DASHBOARD_TEXT_STRINGS[15],
        startEnrollmentApplication: DASHBOARD_TEXT_STRINGS[16],
        enrollmentWillOpenOn: DASHBOARD_TEXT_STRINGS[17],
        enrollmentPeriodClosed: DASHBOARD_TEXT_STRINGS[18],
      };
    }

    return {
      enrollmentPeriod: t.enrollmentPeriod,
      startDate: t.startDate,
      endDate: t.endDate,
      slotsFilled: t.slotsFilled,
      allowedGradeLevels: t.allowedGradeLevels,
      startEnrollmentApplication: t.startEnrollmentApplication,
      enrollmentWillOpenOn: t.enrollmentWillOpenOn,
      enrollmentPeriodClosed: t.enrollmentPeriodClosed,
    };
  }, [currentLanguage, t]);

  const unverifiedTourSteps: Step[] = useMemo(() => [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.welcomeTitle}</h3>
          <p>{tt.welcomeDescription}</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.bg-gradient-to-r.from-amber-50',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.emailVerificationTitle}</h3>
          <p>{tt.emailVerificationDescription}</p>
        </div>
      ),
    },
    {
      target: '#resend-verification-button',
      content: tt.resendEmailDescription,
    },
    {
      target: '#dashboard-header-primary-button',
      content: tt.startEnrollmentDescription,
    },
  ], [tt]);

  // Fetch active enrollment period
  const { data: activePeriodData, isLoading: isPeriodLoading } = useQuery({
    queryKey: ['enrollment-period', 'active'],
    queryFn: () => apiGet(API_ENDPOINTS.ENROLLMENT_PERIODS_ACTIVE),
    enabled: !!user?.id,
  });

  const activeEnrollmentPeriod = activePeriodData?.data;

  // Combined loading state - wait for both fetches
  const isInitialLoading = loading || isPeriodLoading;

  const verifiedTourSteps = useMemo((): Step[] => [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.welcomeTitle}</h3>
          <p>{tt.welcomeDescription}</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.bg-gradient-to-r.from-blue-50',
      content: tt.verifiedIntroDescription,
    },
    ...(activeEnrollmentPeriod ? [
      {
        target: '#enrollment-period-card',
        content: (
          <div className="text-left">
            <h3 className="font-bold text-lg mb-2">{tt.activePeriodTitle}</h3>
            <p>
              {activeEnrollmentPeriod.status === 'Open' 
                ? tt.activePeriodOpen
                : activeEnrollmentPeriod.status === 'Upcoming'
                ? tt.activePeriodUpcoming
                : tt.activePeriodFallback
              }
            </p>
          </div>
        ),
      },
    ] : []),
    {
      target: activeEnrollmentPeriod?.status === 'Open' ? '#enrollment-period-start-button' : '#enrollment-period-card',
      content: activeEnrollmentPeriod?.status === 'Open' 
        ? tt.startWhenOpenDescription
        : tt.startGeneralDescription,
    },
    {
      target: '#quick-actions-card',
      content: tt.quickAccessDescription,
      placement: 'top' as const,
    },
    {
      target: '#dashboard-quick-action-payment-button',
      content: tt.paymentStatusDescription,
      placement: 'top' as const,
    },
    {
      target: '.grid.grid-cols-1.md\\:grid-cols-2',
      content: tt.monitorStatusDescription,
      placement: 'top' as const,
    },
    {
      target: '#enrollment-workflow-card',
      content: tt.workflowTrackDescription,
    },
  ], [activeEnrollmentPeriod, tt]);

  const enrollmentSubmittedTourSteps: Step[] = useMemo(() => [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.submittedTitle}</h3>
          <p>{tt.submittedDescription}</p>
        </div>
      ),
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '.bg-gradient-to-r.from-blue-50',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.completeTitle}</h3>
          <p>{tt.completeDescription}</p>
        </div>
      ),
      placement: 'bottom' as const,
    },
    {
      target: '#quick-actions-card',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.paymentPlanningTitle}</h3>
          <p>{tt.paymentPlanningDescription}</p>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#dashboard-quick-action-payment-button',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.choosePlanTitle}</h3>
          <p>{tt.choosePlanDescription}</p>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#enrollment-workflow-card',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.progressTitle}</h3>
          <p>{tt.progressDescription}</p>
        </div>
      ),
      placement: 'top' as const,
    },
  ], [tt]);

  const enrollmentRecordsTourSteps: Step[] = useMemo(() => [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.recordsTitle}</h3>
          <p>{tt.recordsDescription}</p>
        </div>
      ),
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '#quick-actions-card',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.quickPanelTitle}</h3>
          <p>{tt.quickPanelDescription}</p>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#dashboard-quick-action-enrollment-button',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.viewEnrollmentTitle}</h3>
          <p>{tt.viewEnrollmentDescription}</p>
          <ul className="list-disc list-inside mt-2 text-sm">
            <li>{tt.viewEnrollmentList1}</li>
            <li>{tt.viewEnrollmentList2}</li>
            <li>{tt.viewEnrollmentList3}</li>
            <li>{tt.viewEnrollmentList4}</li>
          </ul>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#dashboard-quick-action-enrollment-button',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.readyTitle}</h3>
          <p>{tt.readyDescription}</p>
        </div>
      ),
      placement: 'top' as const,
    },
  ], [tt]);

  const verifiedEnrollmentTourSteps: Step[] = useMemo(() => [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.verifiedEnrollmentTitle}</h3>
          <p>{tt.verifiedEnrollmentDescription}</p>
        </div>
      ),
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '#quick-actions-card',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.navigatePaymentsTitle}</h3>
          <p>{tt.navigatePaymentsDescription}</p>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#dashboard-quick-action-payment-button',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.paymentButtonTitle}</h3>
          <p>{tt.paymentButtonDescription}</p>
          <ul className="list-disc list-inside mt-2 text-sm">
            <li>{tt.paymentList1}</li>
            <li>{tt.paymentList2}</li>
            <li>{tt.paymentList3}</li>
            <li>{tt.paymentList4}</li>
          </ul>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">{tt.completeEnrollmentTitle}</h3>
          <p>{tt.completeEnrollmentDescription}</p>
        </div>
      ),
      placement: 'center' as const,
    },
  ], [tt]);

  useEffect(() => {
    const fetchEnrollmentStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch enrollment data from API
        const response = await apiGet(API_ENDPOINTS.ENROLLMENTS);
        
        console.log('Enrollment API Response:', response);
        
        // Handle different response structures
        let enrollmentArray = [];
        
        if (response.success && response.data) {
          console.log('response.data type:', typeof response.data, 'is array?', Array.isArray(response.data));
          console.log('response.data keys:', response.data ? Object.keys(response.data) : 'null');
          
          // Check if response.data is an array
          if (Array.isArray(response.data)) {
            enrollmentArray = response.data;
            console.log('Using response.data as array:', enrollmentArray);
          }
          // Check if response.data.data exists and is an array (pagination wrapped response)
          else if (response.data.data && Array.isArray(response.data.data)) {
            enrollmentArray = response.data.data;
            console.log('Using response.data.data as array:', enrollmentArray);
          }
          // Check if response.data.data exists and is a single object with id
          else if (response.data.data && response.data.data.id) {
            enrollmentArray = [response.data.data];
            console.log('Using response.data.data as single enrollment:', enrollmentArray);
          }
          // Check if response.data is a single object with id (single enrollment response)
          else if (response.data.id) {
            enrollmentArray = [response.data];
            console.log('Using response.data as single enrollment:', enrollmentArray);
          }
          // Check if response.data has enrollments property
          else if (response.data.enrollments && Array.isArray(response.data.enrollments)) {
            enrollmentArray = response.data.enrollments;
            console.log('Using response.data.enrollments as array:', enrollmentArray);
          }
        }
        
        console.log('Final enrollmentArray:', enrollmentArray, 'length:', enrollmentArray.length);
        
        if (enrollmentArray.length > 0) {
          // Get the latest enrollment (first one)
          const latestEnrollment = enrollmentArray[0];
          // Normalize status to lowercase and replace spaces with underscores for consistent comparison
          if (latestEnrollment.status) {
            latestEnrollment.status = latestEnrollment.status
              .toLowerCase()
              .replace(/\s+/g, '_') as any;
          }
          setEnrollmentData(latestEnrollment);
          console.log('Set enrollment data:', latestEnrollment);
        } else {
          // No enrollment found
          setEnrollmentData(null);
          console.log('No enrollment found');
        }
      } catch (error) {
        console.error('Error fetching enrollment status:', error);
        setError('Failed to load enrollment status');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchEnrollmentStatus();
    }
  }, [user?.id]);

  // Fetch payments to check for tuition payment
  useEffect(() => {
    const fetchPayments = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`/api/payments/student/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setPayments(data.payments || []);
        }
      } catch (err) {
        console.error('Error fetching payments:', err);
      }
    };

    if (isEmailVerified) {
      fetchPayments();
    }
  }, [user?.id, isEmailVerified]);

  useEffect(() => {
    // Clear any other tours to prevent multiple tours running
    setRunUnverifiedTour(false);
    setRunVerifiedTour(false);
    setRunEnrollmentSubmittedTour(false);
    setRunVerifiedEnrollmentTour(false);

    // Wait for all backend fetches to complete before starting tours
    if (isInitialLoading) {
      return; // Don't trigger any tours while loading
    }

    // Priority-based tour logic: Only ONE tour can run
    // 1. If unverified → show unverified tour
    if (!isEmailVerified) {
      const hasSeenUnverifiedTour = localStorage.getItem('unverifiedDashboardTourCompleted');
      if (!hasSeenUnverifiedTour) {
        setRunUnverifiedTour(true);
      }
      return; // Exit - don't check other conditions
    }

    // 2. If verified AND has submitted enrollment AND status is "verified" → show verified enrollment tour (payment prompt)
    // BUT only if they don't have a tuition payment already
    if (isEmailVerified && enrollmentData && enrollmentData.status === "verified") {
      // Check if there's a tuition payment in their records
      const hasTuitionPayment = payments.some((payment) =>
        payment.enrollment_id === enrollmentData.id &&
        (payment.payment_type === 'Tuition Full Payment' || payment.payment_type === 'Tuition Installment')
      );

      // Only show the tour if they haven't made a tuition payment yet
      if (!hasTuitionPayment) {
        setRunVerifiedEnrollmentTour(true);
      }
      return; // Exit - don't check other conditions
    }

    // 3. If verified AND has submitted enrollment AND has active period → show enrollment submitted tour
    if (isEmailVerified && enrollmentData && activeEnrollmentPeriod) {
      const hasSeenEnrollmentSubmittedTour = localStorage.getItem('enrollmentSubmittedDashboardTourCompleted');
      if (!hasSeenEnrollmentSubmittedTour) {
        setRunEnrollmentSubmittedTour(true);
      }
      return; // Exit - don't check other conditions
    }

    // 4. If verified but NO enrollment submitted yet → show verified tour
    if (isEmailVerified && !enrollmentData) {
      const hasSeenVerifiedTour = localStorage.getItem('verifiedDashboardTourCompleted');
      if (!hasSeenVerifiedTour) {
        setRunVerifiedTour(true);
      }
      return; // Exit
    }

  }, [isEmailVerified, enrollmentData, activeEnrollmentPeriod, isInitialLoading, payments]);

  const handleUnverifiedTourCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunUnverifiedTour(false);
      localStorage.setItem('unverifiedDashboardTourCompleted', 'true');
    }
  };

  const handleVerifiedTourCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunVerifiedTour(false);
      localStorage.setItem('verifiedDashboardTourCompleted', 'true');
    }
  };

  const handleEnrollmentSubmittedTourCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunEnrollmentSubmittedTour(false);
      localStorage.setItem('enrollmentSubmittedDashboardTourCompleted', 'true');
    }
  };

  const handleEnrollmentRecordsTourCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunEnrollmentRecordsTour(false);
      localStorage.setItem('enrollmentRecordsDashboardTourCompleted', 'true');
    }
  };

  const handleVerifiedEnrollmentTourCallback = (data: CallBackProps) => {
    const { status } = data;

    // Auto-navigate to payment page when tour completes
    if (status === STATUS.FINISHED) {
      setRunVerifiedEnrollmentTour(false);
      navigate('/enrollee/payment');
    }
    
    // Handle tour skip
    if (status === STATUS.SKIPPED) {
      setRunVerifiedEnrollmentTour(false);
      // Don't auto-navigate on skip, let user continue with dashboard
    }
  };

  useEffect(() => {
    const updateTourScrollOffset = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      setIsSmallScreen(isMobile);

      if (!isMobile) {
        setTourScrollOffset(20);
        return;
      }

      const mobileHeader = document.querySelector('[data-mobile-header="true"]') as HTMLElement | null;
      const headerHeight = mobileHeader?.getBoundingClientRect().height ?? 56;

      setMobileHeaderHeight(Math.ceil(headerHeight));
      setTourScrollOffset(Math.ceil(headerHeight + 16));
    };

    updateTourScrollOffset();
    window.addEventListener('resize', updateTourScrollOffset);

    return () => {
      window.removeEventListener('resize', updateTourScrollOffset);
    };
  }, []);

  useEffect(() => {
    const handleStartTourEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tourId?: string }>;
      const tourId = customEvent.detail?.tourId;
      if (!tourId) {
        return;
      }

      setRunUnverifiedTour(false);
      setRunVerifiedTour(false);
      setRunEnrollmentSubmittedTour(false);
      setRunEnrollmentRecordsTour(false);
      setRunVerifiedEnrollmentTour(false);

      if (tourId === "verified") {
        setRunVerifiedTour(true);
      } else if (tourId === "enrollment-submitted") {
        setRunEnrollmentSubmittedTour(true);
      } else if (tourId === "enrollment-records") {
        setRunEnrollmentRecordsTour(true);
      }
    };

    window.addEventListener("campuscompanion:start-tour", handleStartTourEvent as EventListener);
    return () => {
      window.removeEventListener("campuscompanion:start-tour", handleStartTourEvent as EventListener);
    };
  }, []);

  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      // Call resend verification email endpoint
      const response = await apiPost(API_ENDPOINTS.RESEND_VERIFICATION, {
        email: user?.email
      });
      
      if (response.success) {
        toast.success("Verification email sent! Please check your inbox.");
      } else {
        toast.error(response.message || "Failed to resend verification email");
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      toast.error("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  // Define workflow steps based on enrollment status
  const getWorkflowSteps = () => {
    const baseSteps = [
      {
        id: 1,
        title: t.createAccountVerifyEmail,
        description: t.registerAndVerify,
        status: "completed",
        icon: "✓",
        locked: false
      },
      {
        id: 2,
        title: t.submitEnrollmentApplication,
        description: t.fillOutAndSubmit,
        status: enrollmentData ? "completed" : "waiting",
        icon: enrollmentData ? "✓" : "2",
        locked: false
      },
      {
        id: 3,
        title: t.applicationUnderReview,
        description: t.admissionsReviewing,
        status: enrollmentData?.status === "under_review" ? "in-progress" : (enrollmentData?.status === "verified" || enrollmentData?.status === "approved" ? "completed" : (enrollmentData ? "pending" : "pending")),
        icon: enrollmentData?.status === "under_review" ? "⏳" : (enrollmentData?.status === "verified" || enrollmentData?.status === "approved" ? "✓" : "3"),
        locked: !enrollmentData
      },
      {
        id: 4,
        title: t.approvalAndPayment,
        description: t.onceApprovedProceed,
        status: enrollmentData?.status === "verified" || enrollmentData?.status === "approved" ? "in-progress" : (enrollmentData?.status === "rejected" ? "rejected" : "pending"),
        icon: enrollmentData?.status === "verified" || enrollmentData?.status === "approved" ? "💳" : "4",
        locked: !enrollmentData || (enrollmentData?.status !== "verified" && enrollmentData?.status !== "approved")
      },
      {
        id: 5,
        title: t.accessYourClasses,
        description: t.gainFullAccess,
        status: enrollmentData?.status === "approved" ? "pending" : "pending",
        icon: "5",
        locked: !enrollmentData || enrollmentData?.status !== "approved"
      }
    ];

    return baseSteps;
  };

  const steps = getWorkflowSteps();
  const statusColors: Record<string, { badge: string; text: string }> = {
    pending: { badge: "bg-yellow-100 text-yellow-800", text: t.pendingReview },
    incomplete: { badge: "bg-red-100 text-red-800", text: t.incomplete },
    under_review: { badge: "bg-blue-100 text-blue-800", text: t.underReview },
    verified: { badge: "bg-blue-100 text-blue-800", text: t.verified },
    approved: { badge: "bg-green-100 text-green-800", text: t.approved },
    rejected: { badge: "bg-red-100 text-red-800", text: t.rejected },
    "no-admission": { badge: "bg-gray-100 text-gray-800", text: t.noAdmission }
  };

  // Determine current status for the card
  const currentStatus = !enrollmentData ? "no-admission" : (enrollmentData?.status || "pending");
  const hasEnrollmentRecord = Boolean(enrollmentData);
  const isAnyTourRunning = runUnverifiedTour || runVerifiedTour || runEnrollmentSubmittedTour || runVerifiedEnrollmentTour || runEnrollmentRecordsTour;
  const mobileTourContentTopSpaceClass = isSmallScreen && isAnyTourRunning
    ? (mobileHeaderHeight >= 72 ? 'pt-24' : mobileHeaderHeight >= 64 ? 'pt-20' : 'pt-16')
    : '';

  return (
    <DashboardLayout>
      {/* Loading Screen - Show while fetching all data */}
      {isInitialLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{t.loadingDashboard}</h2>
              <p className="text-sm text-muted-foreground">{t.fetchingInformation}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className={`p-4 sm:p-8 ${mobileTourContentTopSpaceClass}`}>
        {/* Back Button & Header */}
        <div className="mt-4 sm:mt-0 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-4 sm:mb-6">
            <div className="w-full">
              <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-1 sm:mb-2">
                {t.welcome}, {user?.first_name || user?.name}!
              </h1>
              <p className="text-xs sm:text-base text-muted-foreground">{t.enrolleeAccountDashboard}</p>
            </div>
            <Button
              id="dashboard-header-primary-button"
              onClick={() => navigate(isEmailVerified ? (hasEnrollmentRecord ? "/enrollee/payment" : "/enrollee/enrollment") : "#")}
              disabled={!isEmailVerified}
              className={`text-white w-full sm:w-auto text-sm sm:text-base h-9 sm:h-10 ${
                hasEnrollmentRecord
                  ? "bg-gradient-to-r from-green-600 to-emerald-600"
                  : "bg-gradient-to-r from-blue-600 to-blue-700"
              }`}
            >
              {hasEnrollmentRecord ? (
                <CreditCard className="h-4 sm:h-5 w-4 sm:w-5 mr-1 sm:mr-2" />
              ) : (
                <FileText className="h-4 sm:h-5 w-4 sm:w-5 mr-1 sm:mr-2" />
              )}
              {hasEnrollmentRecord ? tt.goToPayments : t.goToEnrollment}
            </Button>
          </div>
        </div>

        {/* Email Verification Card - Show if not verified */}
        {!isEmailVerified && (
          <Card className="mb-4 sm:mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-lg border-0">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-amber-900">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                {t.emailVerificationRequired}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-amber-900 break-words">
                  {t.verifyEmailAddress} <span className="font-semibold break-all">{user?.email}</span> {t.toUnlockEnrollment}
                </p>
                <Button
                  id="resend-verification-button"
                  onClick={handleResendVerification}
                  disabled={isResending}
                  variant="outline"
                  className="gap-2 w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                >
                  <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                  {isResending ? t.sending : t.sendVerificationEmail}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enrollment Period Card */}
        {isEmailVerified && activeEnrollmentPeriod && !enrollmentData && (
          <Card id="enrollment-period-card" className={`mb-4 sm:mb-8 border-0 shadow-lg ${
            activeEnrollmentPeriod.status === 'Open' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50' 
              : activeEnrollmentPeriod.status === 'Upcoming'
              ? 'bg-gradient-to-r from-blue-50 to-sky-50'
              : 'bg-gradient-to-r from-gray-50 to-slate-50'
          }`}>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 flex-wrap">
                <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5" />
                {enrollmentPeriodText.enrollmentPeriod}
                <Badge 
                  variant={
                    activeEnrollmentPeriod.status === 'Open' ? 'default' :
                    activeEnrollmentPeriod.status === 'Upcoming' ? 'secondary' :
                    'outline'
                  }
                  className={
                    activeEnrollmentPeriod.status === 'Open' ? 'bg-green-600' :
                    activeEnrollmentPeriod.status === 'Upcoming' ? 'bg-blue-600' :
                    'bg-gray-600'
                  }
                >
                  {activeEnrollmentPeriod.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div>
                <h3 className="font-semibold text-base sm:text-lg break-words">{activeEnrollmentPeriod.enrollment_name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {activeEnrollmentPeriod.school_year} - {activeEnrollmentPeriod.quarter}
                </p>
                {activeEnrollmentPeriod.enrollment_type && (
                  <Badge variant="outline" className="mt-1 text-xs">{activeEnrollmentPeriod.enrollment_type}</Badge>
                )}
              </div>
              
              {activeEnrollmentPeriod.description && (
                <p className="text-xs sm:text-sm break-words">{activeEnrollmentPeriod.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                <div>
                  <p className="text-xs text-muted-foreground">{enrollmentPeriodText.startDate}</p>
                  <p className="font-medium text-xs sm:text-sm">{new Date(activeEnrollmentPeriod.start_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{enrollmentPeriodText.endDate}</p>
                  <p className="font-medium text-xs sm:text-sm">{new Date(activeEnrollmentPeriod.end_date).toLocaleDateString()}</p>
                </div>
              </div>

              {activeEnrollmentPeriod.max_slots && (
                <div className="flex items-center gap-2 pt-2">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs sm:text-sm">
                    <span className="font-semibold">{activeEnrollmentPeriod.current_enrollees || 0}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="font-semibold">{activeEnrollmentPeriod.max_slots}</span>
                    <span className="text-muted-foreground"> {enrollmentPeriodText.slotsFilled}</span>
                  </span>
                </div>
              )}

              {activeEnrollmentPeriod.allowed_grade_levels && activeEnrollmentPeriod.allowed_grade_levels.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">{enrollmentPeriodText.allowedGradeLevels}</p>
                  <div className="flex flex-wrap gap-1">
                    {(typeof activeEnrollmentPeriod.allowed_grade_levels === 'string' 
                      ? JSON.parse(activeEnrollmentPeriod.allowed_grade_levels) 
                      : activeEnrollmentPeriod.allowed_grade_levels
                    ).map((level: string) => (
                      <Badge key={level} variant="outline" className="text-xs">
                        {level}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {activeEnrollmentPeriod.status === 'Open' && (
                <Button
                  id="enrollment-period-start-button"
                  onClick={() => navigate("/enrollee/enrollment")}
                  className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs sm:text-sm h-9 sm:h-10"
                >
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  {enrollmentPeriodText.startEnrollmentApplication}
                </Button>
              )}

              {activeEnrollmentPeriod.status === 'Upcoming' && (
                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <p className="text-xs sm:text-sm text-blue-900 text-center">
                    {enrollmentPeriodText.enrollmentWillOpenOn} {new Date(activeEnrollmentPeriod.start_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {activeEnrollmentPeriod.status === 'Closed' && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-900 text-center">
                    {enrollmentPeriodText.enrollmentPeriodClosed}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Welcome Card - Only show if email verified AND no enrollment submitted yet */}
        {isEmailVerified && !enrollmentData && (
        <Card className="mb-4 sm:mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-lg border-0">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-2xl text-blue-900">
              {t.welcomeToMaranatha}
            </CardTitle>
            <CardDescription className="text-blue-700 text-xs sm:text-sm">
              {t.startYourJourney}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                <span className="text-xs sm:text-sm font-medium">{t.emailVerified}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-8">
          {/* Enrollment Status */}
          <Card className="shadow-lg border-0">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileText className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                {t.enrollmentStatus}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">{t.applicationStatus}</p>
                  <Badge className={`${statusColors[currentStatus].badge} text-xs sm:text-sm px-2 sm:px-3 py-1`}>
                    {!enrollmentData ? t.noAdmission : statusColors[currentStatus].text}
                  </Badge>
                </div>
                {enrollmentData && (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-foreground">{t.enrollmentSubmitted}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.lastUpdated} {new Date(enrollmentData.updated_at).toLocaleDateString()}</p>
                    </div>
                    {enrollmentData.grade_level && (
                      <p className="text-xs text-muted-foreground">{t.gradeLevel} {enrollmentData.grade_level}</p>
                    )}
                    {enrollmentData.school_year && (
                      <p className="text-xs text-muted-foreground">{t.schoolYear} {enrollmentData.school_year}</p>
                    )}
                  </div>
                )}
                {!enrollmentData && (
                  <p className="text-xs text-muted-foreground">{t.noActiveEnrollment}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card className="shadow-lg border-0">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                {t.accountInformation}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t.email}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                    <p className="font-medium text-xs sm:text-sm break-all text-foreground">{user?.email}</p>
                    <Badge variant={isEmailVerified ? "default" : "secondary"} className="flex-shrink-0 w-fit text-xs">
                      {isEmailVerified ? `✓ ${t.verified}` : "⚠ Unverified"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t.role}</p>
                  <p className="font-medium text-xs sm:text-sm text-foreground capitalize mt-1">{user?.role}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card id="quick-actions-card" className="shadow-lg border-0">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">{t.quickActions}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                <Button 
                  id="dashboard-quick-action-enrollment-button"
                  onClick={() => navigate(isEmailVerified ? "/enrollee/enrollment" : "#")}
                  disabled={!isEmailVerified}
                  variant="outline"
                  className="w-full justify-between text-xs sm:text-sm h-8 sm:h-9"
                  title={!isEmailVerified ? t.pleaseVerifyEmail : ""}
                >
                  <span>{t.viewEnrollment}</span>
                  <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4" />
                </Button>
                <Button 
                  id="dashboard-quick-action-payment-button"
                  onClick={() => navigate(isEmailVerified ? "/enrollee/payment" : "#")}
                  disabled={!isEmailVerified}
                  variant="outline"
                  className="w-full justify-between text-xs sm:text-sm h-8 sm:h-9"
                  title={!isEmailVerified ? t.pleaseVerifyEmail : ""}
                >
                  <span>{t.paymentStatus}</span>
                  <CreditCard className="h-3 sm:h-4 w-3 sm:w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrollment Workflow Steps */}
        <Card id="enrollment-workflow-card" className="shadow-lg border-0">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              {t.enrollmentWorkflow}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t.trackYourProgress}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {steps.map((step, index) => {
                const statusColor = {
                  completed: "bg-green-100 text-green-800",
                  "in-progress": "bg-blue-100 text-blue-800",
                  pending: "bg-gray-100 text-gray-800",
                  waiting: "bg-gray-100 text-gray-800",
                  rejected: "bg-red-100 text-red-800"
                }[step.status] || "bg-gray-100 text-gray-800";

                const statusBorderColor = {
                  completed: "border-l-green-500",
                  "in-progress": "border-l-blue-500",
                  pending: "border-l-gray-300",
                  waiting: "border-l-gray-300",
                  rejected: "border-l-red-500"
                }[step.status] || "border-l-gray-300";

                return (
                  <div key={step.id} className={`flex gap-3 pb-3 sm:pb-4 border-l-4 pl-3 sm:pl-4 ${statusBorderColor} ${step.locked ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="flex-shrink-0">
                      <div className={`flex items-center justify-center h-8 sm:h-10 w-8 sm:w-10 rounded-full font-semibold text-xs sm:text-base ${step.locked ? "bg-gray-200 text-gray-500" : statusColor}`}>
                        {step.locked ? "🔒" : step.icon}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold text-xs sm:text-base ${step.locked ? "text-gray-500" : "text-foreground"}`}>{step.title}</h4>
                      <p className={`text-xs sm:text-sm mt-1 break-words ${step.locked ? "text-gray-400" : "text-muted-foreground"}`}>{step.description}</p>
                      <Badge className="mt-2 text-xs" variant={step.status === "completed" ? "default" : step.status === "in-progress" ? "secondary" : "outline"}>
                        {step.status === "completed" ? t.completed : step.status === "in-progress" ? t.inProgress : step.status === "rejected" ? t.rejected : step.status === "waiting" ? t.waitingForSubmission : t.pending}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="mt-4 sm:mt-8 shadow-lg border-0">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t.needHelp}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              {t.needHelpDescription}
            </p>
            <Button variant="outline" className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
              {t.contactSupport}
            </Button>
          </CardContent>
        </Card>
      </div>
        </>
      )}

      <Joyride
        steps={unverifiedTourSteps}
        run={runUnverifiedTour}
        scrollOffset={tourScrollOffset}
        continuous
        showProgress
        showSkipButton
        callback={handleUnverifiedTourCallback}
        disableScrolling={false}
        spotlightPadding={5}
        styles={{
          options: {
            primaryColor: '#f59e0b',
            zIndex: 1000,
          },
          tooltip: {
            borderRadius: 8,
            padding: '12px 16px',
          },
          tooltipContent: {
            padding: '8px 0',
          },
        }}
        floaterProps={{
          disableAnimation: true,
          styles: {
            floater: {
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
            },
          },
        }}
        locale={{
          last: tt.finish,
          skip: tt.skip,
        }}
      />

      <Joyride
        steps={verifiedTourSteps}
        run={runVerifiedTour}
        scrollOffset={tourScrollOffset}
        continuous
        showProgress
        showSkipButton
        callback={handleVerifiedTourCallback}
        disableScrolling={false}
        spotlightPadding={5}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 1000,
          },
          tooltip: {
            borderRadius: 8,
            padding: '12px 16px',
          },
          tooltipContent: {
            padding: '8px 0',
          },
        }}
        floaterProps={{
          disableAnimation: true,
          styles: {
            floater: {
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
            },
          },
        }}
        locale={{
          last: tt.finish,
          skip: tt.skip,
        }}
      />

      <Joyride
        steps={enrollmentSubmittedTourSteps}
        run={runEnrollmentSubmittedTour}
        scrollOffset={tourScrollOffset}
        continuous
        showProgress
        showSkipButton
        callback={handleEnrollmentSubmittedTourCallback}
        disableScrolling={false}
        spotlightPadding={5}
        styles={{
          options: {
            primaryColor: '#8b5cf6',
            zIndex: 1000,
          },
          tooltip: {
            borderRadius: 8,
            padding: '12px 16px',
          },
          tooltipContent: {
            padding: '8px 0',
          },
        }}
        floaterProps={{
          disableAnimation: true,
          styles: {
            floater: {
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
            },
          },
        }}
        locale={{
          last: tt.finish,
          skip: tt.skip,
        }}
      />

      <Joyride
        steps={enrollmentRecordsTourSteps}
        run={runEnrollmentRecordsTour}
        scrollOffset={tourScrollOffset}
        continuous
        showProgress
        showSkipButton
        callback={handleEnrollmentRecordsTourCallback}
        disableScrolling={false}
        spotlightPadding={5}
        styles={{
          options: {
            primaryColor: '#10b981',
            zIndex: 1000,
          },
          tooltip: {
            borderRadius: 8,
            padding: '12px 16px',
          },
          tooltipContent: {
            padding: '8px 0',
          },
        }}
        floaterProps={{
          disableAnimation: true,
          styles: {
            floater: {
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
            },
          },
        }}
        locale={{
          last: tt.finish,
          skip: tt.skip,
        }}
      />

      <Joyride
        steps={verifiedEnrollmentTourSteps}
        run={runVerifiedEnrollmentTour}
        scrollOffset={tourScrollOffset}
        continuous
        showProgress
        showSkipButton
        callback={handleVerifiedEnrollmentTourCallback}
        disableScrolling={false}
        spotlightPadding={5}
        styles={{
          options: {
            primaryColor: '#10b981',
            zIndex: 1000,
          },
          tooltip: {
            borderRadius: 8,
            padding: '12px 16px',
          },
          tooltipContent: {
            padding: '8px 0',
          },
        }}
        floaterProps={{
          disableAnimation: true,
          styles: {
            floater: {
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
            },
          },
        }}
        locale={{
          last: tt.goToPayments,
          skip: tt.skip,
        }}
      />
    </DashboardLayout>
  );
};

export default EnrolleeDashboard;
