import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Plus, CheckCircle2, Clock, XCircle, Eye, ArrowRight, ClipboardList, Calendar, Search, LayoutGrid, List, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useFeatures } from "@/context/FeaturesContext";
import { apiGet, API_ENDPOINTS } from "@/lib/api";
import AccessLockedCard from "@/components/AccessLockedCard";
import Joyride, { CallBackProps, STATUS, EVENTS } from "react-joyride";
import { useTranslatedTexts } from "@/context/TranslationContext";

interface EnrollmentItem {
  id: number;
  confirmation_number?: string;
  status: "Pending" | "Incomplete" | "Under Review" | "Approved" | "Rejected";
  submitted_date: string;
  student_name?: string;
  grade_level?: string;
  school_year?: string;
  enrollment_period_id?: number;
}

const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  "Pending": {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: <Clock className="w-4 h-4" />,
  },
  "Incomplete": {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: <AlertCircle className="w-4 h-4" />,
  },
  "Under Review": {
    bg: "bg-purple-100",
    text: "text-purple-800",
    icon: <Clock className="w-4 h-4" />,
  },
  "Approved": {
    bg: "bg-green-100",
    text: "text-green-800",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  "Rejected": {
    bg: "bg-red-100",
    text: "text-red-800",
    icon: <XCircle className="w-4 h-4" />,
  },
};

const MY_ENROLLMENTS_TEXT_STRINGS = [
  "Loading your enrollments...",
  "Enrollment Access Locked",
  "You need to verify your email address before you can access the enrollment system.",
  "Secure your account and prevent unauthorized access",
  "Receive important enrollment updates and notifications",
  "Start your enrollment application and submission process",
  "Previous",
  "Close",
  "Finish",
  "Next",
  "Open the dialog",
  "Skip tour",
  "My Enrollments",
  "Track and manage your enrollment applications",
  "You already have an active enrollment in the current period",
  "Enrollment period is closed",
  "New Enrollment",
  "You have an active enrollment. Complete it before creating a new one.",
  "Enrollment period is closed. Check back later.",
  "No Enrollments Yet",
  "You haven't submitted any enrollment applications yet. Start your enrollment process now to get access to courses and classes.",
  "Start Your First Enrollment",
  "Total Applications",
  "Under Review",
  "Approved",
  "Latest Update",
  "N/A",
  "Search",
  "Search...",
  "Status",
  "All Status",
  "Pending",
  "Incomplete",
  "Rejected",
  "View Mode",
  "List",
  "Grid",
  "Application ID",
  "School Year",
  "Grade Level",
  "Submitted Date",
  "Actions",
  "View",
  "SY:",
  "Grade:",
  "Submitted:",
  "View Details",
  "Enrollment Information",
  "Click on any enrollment to view detailed status and timeline",
  "You will be notified via email when your application is reviewed",
  "Document uploads may be requested at any time",
  "Contact us at mca.calapan@gmail.com for support",
  "Choose Re-Enrollment Type",
  "Choose Student Type",
  "Choose the option that matches your status.",
  "Choose the option that matches this student.",
  "Continuing Student (Old Student)",
  "Currently enrolled here and moving to the next grade.",
  "Returning Student",
  "Previously enrolled here, then stopped, and now returning.",
  "New Student",
  "First time enrolling at Maranatha Christian Academy.",
  "Previously enrolled at Maranatha and continuing this school year.",
  "Transferee",
  "Coming from another school.",
  "Cancel",
  "Continue",
  "Enrollment Confirmation",
  "You are now enrolling for",
  "Student Information",
  "Name:",
  "Current Grade:",
  "Enrolled Grade:",
  "Gender:",
  "Parent/Guardian",
  "Residential Address",
  "Current Address",
  "ℹ️ Important Information",
  "• All information is from your previous enrollment",
  "• Your enrollment will be automatically submitted",
  "• You will be notified once admin approves your enrollment",
  "• Typical approval takes 2-3 business days",
  "Submitting...",
  "Submit Enrollment",
  "Please verify your email before creating an enrollment",
  "Enrollment period is currently closed. Please wait for the next enrollment period to open.",
  "You already have an active enrollment in the current period. Complete or cancel the existing enrollment before creating a new one.",
  "Please select an enrollment type",
  "User information not available",
  "Missing required data for auto-enrollment",
  "Please verify your email before viewing enrollments",
  "School Year",
  "Failed to load enrollments",
] as const;

const MyEnrollments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEnrollmentTypeEnabled } = useFeatures();
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showEnrollmentTypeModal, setShowEnrollmentTypeModal] = useState(false);
  const [selectedEnrollmentType, setSelectedEnrollmentType] = useState<"New Student" | "Returning Student" | "Transferee" | "Continuing Student" | "">("");
  const [hasOpenEnrollmentPeriod, setHasOpenEnrollmentPeriod] = useState<boolean | null>(null);
  const [activeEnrollmentPeriodId, setActiveEnrollmentPeriodId] = useState<number | null>(null);
  
  // States for continuing student auto-enrollment
  const [showContinuingPreview, setShowContinuingPreview] = useState(false);
  const [continuingPreviewData, setContinuingPreviewData] = useState<any>(null);
  const [pastEnrollmentId, setPastEnrollmentId] = useState<number | null>(null);
  const [isAutoCreating, setIsAutoCreating] = useState(false);

  // Tour states
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourScrollOffset, setTourScrollOffset] = useState(20);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(56);

  const isEmailVerified = user?.status !== 'pending';

  const translatedTexts = useTranslatedTexts([...MY_ENROLLMENTS_TEXT_STRINGS]);
  const t = useMemo(() => ({
    loadingEnrollments: translatedTexts[0],
    enrollmentAccessLocked: translatedTexts[1],
    verifyEmailLockDescription: translatedTexts[2],
    lockBenefitSecurity: translatedTexts[3],
    lockBenefitUpdates: translatedTexts[4],
    lockBenefitStart: translatedTexts[5],
    joyrideBack: translatedTexts[6],
    joyrideClose: translatedTexts[7],
    joyrideFinish: translatedTexts[8],
    joyrideNext: translatedTexts[9],
    joyrideOpen: translatedTexts[10],
    joyrideSkip: translatedTexts[11],
    pageTitle: translatedTexts[12],
    pageSubtitle: translatedTexts[13],
    activeEnrollmentTitle: translatedTexts[14],
    enrollmentPeriodClosedTitle: translatedTexts[15],
    newEnrollment: translatedTexts[16],
    activeEnrollmentWarning: translatedTexts[17],
    periodClosedWarning: translatedTexts[18],
    noEnrollmentsYet: translatedTexts[19],
    noEnrollmentsDescription: translatedTexts[20],
    startFirstEnrollment: translatedTexts[21],
    totalApplications: translatedTexts[22],
    underReview: translatedTexts[23],
    approved: translatedTexts[24],
    latestUpdate: translatedTexts[25],
    na: translatedTexts[26],
    search: translatedTexts[27],
    searchPlaceholder: translatedTexts[28],
    status: translatedTexts[29],
    allStatus: translatedTexts[30],
    pending: translatedTexts[31],
    incomplete: translatedTexts[32],
    rejected: translatedTexts[33],
    viewMode: translatedTexts[34],
    list: translatedTexts[35],
    grid: translatedTexts[36],
    applicationId: translatedTexts[37],
    schoolYear: translatedTexts[38],
    gradeLevel: translatedTexts[39],
    submittedDate: translatedTexts[40],
    actions: translatedTexts[41],
    view: translatedTexts[42],
    sy: translatedTexts[43],
    grade: translatedTexts[44],
    submitted: translatedTexts[45],
    viewDetails: translatedTexts[46],
    enrollmentInformation: translatedTexts[47],
    infoLine1: translatedTexts[48],
    infoLine2: translatedTexts[49],
    infoLine3: translatedTexts[50],
    infoLine4: translatedTexts[51],
    selectReEnrollmentType: translatedTexts[52],
    selectEnrollmentType: translatedTexts[53],
    reEnrollmentDescription: translatedTexts[54],
    enrollmentTypeDescription: translatedTexts[55],
    continuingOldStudent: translatedTexts[56],
    continuingDescription: translatedTexts[57],
    returningStudent: translatedTexts[58],
    returningDescription: translatedTexts[59],
    newStudent: translatedTexts[60],
    newStudentDescription: translatedTexts[61],
    continuingAtMaranathaDescription: translatedTexts[62],
    transferee: translatedTexts[63],
    transfereeDescription: translatedTexts[64],
    cancel: translatedTexts[65],
    continue: translatedTexts[66],
    enrollmentConfirmation: translatedTexts[67],
    nowEnrollingFor: translatedTexts[68],
    studentInformation: translatedTexts[69],
    name: translatedTexts[70],
    currentGrade: translatedTexts[71],
    enrolledGrade: translatedTexts[72],
    gender: translatedTexts[73],
    parentGuardian: translatedTexts[74],
    residentialAddress: translatedTexts[75],
    currentAddress: translatedTexts[76],
    importantInfo: translatedTexts[77],
    importantLine1: translatedTexts[78],
    importantLine2: translatedTexts[79],
    importantLine3: translatedTexts[80],
    importantLine4: translatedTexts[81],
    submitting: translatedTexts[82],
    submitEnrollment: translatedTexts[83],
    errVerifyBeforeCreate: translatedTexts[84],
    errPeriodClosed: translatedTexts[85],
    errActiveEnrollment: translatedTexts[86],
    errSelectType: translatedTexts[87],
    errNoUserInfo: translatedTexts[88],
    errMissingAutoData: translatedTexts[89],
    errVerifyBeforeView: translatedTexts[90],
    schoolYearPrefix: translatedTexts[91],
    failedLoadEnrollments: translatedTexts[92],
  }), [translatedTexts]);

  const getLocalizedStatus = useCallback((status: EnrollmentItem["status"]) => {
    const statusMap: Record<EnrollmentItem["status"], string> = {
      Pending: t.pending,
      Incomplete: t.incomplete,
      "Under Review": t.underReview,
      Approved: t.approved,
      Rejected: t.rejected,
    };

    return statusMap[status] ?? status;
  }, [t.approved, t.incomplete, t.pending, t.rejected, t.underReview]);

  const continuingOldStudentLabel = useMemo(() => {
    return t.continuingOldStudent
      .replace(/Matandang\s+Mag-?aaral/gi, "Dati pang Mag-aaral")
      .replace(/Matandang\s+Mag-aaral/gi, "Dati pang Mag-aaral");
  }, [t.continuingOldStudent]);

  // Tour steps - conditional based on whether user has enrollments
  const tourSteps = useMemo(() => {
    const baseSteps = [
      {
        target: '#my-enrollments-header',
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">Welcome to My Enrollments!</h3>
            <p className="text-sm">This is your central hub for managing all your enrollment applications. Here you can view your current enrollments, start new applications, and track their progress.</p>
          </div>
        ),
        placement: 'bottom' as const,
        disableBeacon: true,
      },
      {
        target: '#new-enrollment-button',
        content: (
          <div>
            <h3 className="text-lg font-semibold mb-2">Start New Enrollment</h3>
            <p className="text-sm">Click here to begin a new enrollment application. You'll be guided through selecting the appropriate enrollment type for your situation.</p>
          </div>
        ),
        placement: 'bottom' as const,
      },
    ];

    // If user has enrollments, add additional steps
    if (enrollments.length > 0) {
      return [
        ...baseSteps,
        {
          target: '#summary-stats-section',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Enrollment Summary</h3>
              <p className="text-sm">Get a quick overview of your enrollment status with these summary cards showing total applications, items under review, approvals, and your latest activity.</p>
            </div>
          ),
          placement: 'top' as const,
        },
        {
          target: '#filters-section',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Search & Filter</h3>
              <p className="text-sm">Use these tools to find specific enrollments. Search by application ID or grade level, filter by status, and switch between list and grid views.</p>
            </div>
          ),
          placement: 'top' as const,
        },
        {
          target: '#enrollments-list-section',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Your Enrollments</h3>
              <p className="text-sm">This section displays all your enrollment applications. Each entry shows the application ID, school year, grade level, status, and submission date.</p>
            </div>
          ),
          placement: 'top' as const,
        },
        {
          target: '#view-enrollment-button',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">View Details</h3>
              <p className="text-sm">Click the "View" button on any enrollment to see detailed information, status timeline, and any required actions or document uploads.</p>
            </div>
          ),
          placement: 'left' as const,
        },
        {
          target: '#enrollment-info-section',
          content: (
            <div>
              <h3 className="text-lg font-semibold mb-2">Important Information</h3>
              <p className="text-sm">Review these key points about the enrollment process. You'll receive email notifications for updates, and additional documents may be requested.</p>
            </div>
          ),
          placement: 'top' as const,
        },
      ];
    }

    // Return only base steps for users with no enrollments
    return baseSteps;
  }, [enrollments.length]);

  const normalizedTourSteps = useMemo(() => {
    if (!isSmallScreen) return tourSteps;

    return (tourSteps || []).map((step: any) => {
      if (!step?.placement) return step;
      if (step.placement === 'left' || step.placement === 'right') {
        return { ...step, placement: 'top' as const };
      }
      return step;
    });
  }, [tourSteps, isSmallScreen]);

  const mobileTourContentTopSpaceClass = isSmallScreen && runTour
    ? (mobileHeaderHeight >= 72 ? 'pt-24' : mobileHeaderHeight >= 64 ? 'pt-20' : 'pt-16')
    : '';

  // Tour callback
  const handleTourCallback = (data: CallBackProps) => {
    const { status, type, index } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setTourStepIndex(index + 1);
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      setTourStepIndex(0);
      localStorage.setItem('myEnrollmentsTourCompleted', 'true');
    }
  };

  useEffect(() => {
    const handleStartTourEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tourId?: string }>;
      const tourId = customEvent.detail?.tourId;
      if (tourId !== "my-enrollments") {
        return;
      }

      setTourStepIndex(0);
      setRunTour(true);
    };

    window.addEventListener("campuscompanion:start-tour", handleStartTourEvent as EventListener);
    return () => {
      window.removeEventListener("campuscompanion:start-tour", handleStartTourEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    const updateTourViewportSettings = () => {
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      setIsSmallScreen(mobile);

      if (!mobile) {
        setTourScrollOffset(20);
        return;
      }

      const mobileHeader = document.querySelector('[data-mobile-header="true"]') as HTMLElement | null;
      const headerHeight = mobileHeader?.getBoundingClientRect().height ?? 56;
      setMobileHeaderHeight(Math.ceil(headerHeight));
      setTourScrollOffset(Math.ceil(headerHeight + 16));
    };

    updateTourViewportSettings();
    window.addEventListener('resize', updateTourViewportSettings);

    return () => {
      window.removeEventListener('resize', updateTourViewportSettings);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    /**
     * Check if enrollment period is open
     */
    if (!user) {
      navigate("/auth");
      return;
    }

    /**
     * Check if enrollment period is open
     */
    const checkEnrollmentPeriod = async () => {
      try {
        const response = await apiGet('/api/enrollment-periods/active');
        
        if (response.success && response.data) {
          const isOpen = response.data.status === 'Open' || response.data.enrollment_open === true;
          setHasOpenEnrollmentPeriod(isOpen);
          setActiveEnrollmentPeriodId(response.data.id); // Store the active period ID
        } else if (response.data && response.data.status === 'Open') {
          setHasOpenEnrollmentPeriod(true);
          setActiveEnrollmentPeriodId(response.data.id);
        } else {
          setHasOpenEnrollmentPeriod(false);
          setActiveEnrollmentPeriodId(null);
        }
      } catch (error) {
        console.error('Error checking enrollment period:', error);
        setHasOpenEnrollmentPeriod(false);
        setActiveEnrollmentPeriodId(null);
      }
    };

    const fetchEnrollments = async () => {
      try {
        setLoading(true);
        const response = await apiGet(API_ENDPOINTS.ENROLLMENTS);
        
        console.log('Enrollments API Response:', response);
        console.log('response.data type:', typeof response.data, 'is array?', Array.isArray(response.data));
        console.log('response.data keys:', response.data ? Object.keys(response.data) : 'null');
        
        // Handle different response structures
        let enrollmentsArray: EnrollmentItem[] = [];
        
        if (response.success && response.data) {
          // Check if response.data is an array (direct array response)
          if (Array.isArray(response.data)) {
            enrollmentsArray = response.data;
            console.log('Using response.data as array');
          }
          // Check if response.data.data exists and is an array (nested array from pagination)
          else if (response.data.data && Array.isArray(response.data.data)) {
            enrollmentsArray = response.data.data;
            console.log('Using response.data.data as array');
          }
          // Check if response.data.data exists and is a single object with id
          else if (response.data.data && response.data.data.id) {
            enrollmentsArray = [response.data.data];
            console.log('Using response.data.data as single enrollment');
          }
          // Check if response.data is a single object with id (single enrollment response)
          else if (response.data.id) {
            enrollmentsArray = [response.data];
            console.log('Using response.data as single enrollment');
          }
          // Check if response.data has enrollments property
          else if (response.data.enrollments && Array.isArray(response.data.enrollments)) {
            enrollmentsArray = response.data.enrollments;
            console.log('Using response.data.enrollments as array');
          }
        }
        
        // Normalize status for all enrollments (convert "Pending" → "Pending", "Under Review" → "Under Review", etc.)
        enrollmentsArray = enrollmentsArray.map(enrollment => ({
          ...enrollment,
          status: (enrollment.status || "Pending") as any
        }));
        
        console.log('Parsed enrollments:', enrollmentsArray, 'total:', enrollmentsArray.length);
        setEnrollments(enrollmentsArray);
      } catch (error) {
        console.error("Error fetching enrollments:", error);
        toast.error(error instanceof Error ? error.message : t.failedLoadEnrollments);
      } finally {
        setLoading(false);
      }
    };

    checkEnrollmentPeriod();
    
    if (isEmailVerified) {
      fetchEnrollments();
    } else {
      setLoading(false);
    }

    // Auto-start tour for new users
    const tourCompleted = localStorage.getItem('myEnrollmentsTourCompleted');
    if (!tourCompleted && isEmailVerified && !loading) {
      // Delay tour start to ensure DOM is ready
      setTimeout(() => {
        setRunTour(true);
      }, 1000);
    }
  }, [user, navigate, isEmailVerified, t.failedLoadEnrollments]);

  const handleStartNewEnrollment = () => {
    if (!isEmailVerified) {
      toast.error(t.errVerifyBeforeCreate);
      return;
    }

    if (!hasOpenEnrollmentPeriod) {
      toast.error(t.errPeriodClosed);
      return;
    }

    // Check if there's an active enrollment in the CURRENT enrollment period only
    // Compare enrollment_period_id with the active enrollment period ID
    const hasActiveEnrollmentInCurrentPeriod = enrollments.some(e => 
      e.enrollment_period_id === activeEnrollmentPeriodId && e.status !== "Rejected"
    );
    
    if (hasActiveEnrollmentInCurrentPeriod) {
      toast.error(t.errActiveEnrollment);
      return;
    }
    
    // Show modal for both students and enrollees to select type
    setSelectedEnrollmentType("");
    setShowEnrollmentTypeModal(true);
  };

  const handleEnrollmentTypeConfirm = async () => {
    if (!selectedEnrollmentType) {
      toast.error(t.errSelectType);
      return;
    }

    if (!user?.id) {
      toast.error(t.errNoUserInfo);
      return;
    }

    try {
      setShowEnrollmentTypeModal(false);
      setIsAutoCreating(true);

      // Call the classification API to determine student type and action
      const classificationResponse = await fetch(API_ENDPOINTS.ENROLLMENT_CLASSIFY_STUDENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          enrollment_type: selectedEnrollmentType,
          student_id: user.id
        })
      });

      if (!classificationResponse.ok) {
        const errorText = await classificationResponse.text();
        console.error('Classification API Error:', classificationResponse.status, errorText);
        throw new Error(`Failed to classify student (${classificationResponse.status})`);
      }

      let classificationData;
      try {
        classificationData = await classificationResponse.json();
      } catch (parseError) {
        const responseText = await classificationResponse.text();
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error('Invalid response from server - not JSON');
      }

      console.log("Classification response:", classificationData);

      if (!classificationData.success) {
        throw new Error(classificationData.message || 'Classification failed');
      }

      // Check the action from classification
      if (classificationData.action === 'auto_generate') {
        // Continuing student with approved enrollment - show preview modal
        if (classificationData.preview_data) {
          setContinuingPreviewData(classificationData.preview_data);
          setPastEnrollmentId(classificationData.latest_enrollment?.id || null);
          setShowContinuingPreview(true);
          setIsAutoCreating(false);
          return;
        } else {
          throw new Error('No preview data available for auto-enrollment');
        }
      } else if (classificationData.action === 'go_to_form') {
        // All other students - go to enrollment form
        setIsAutoCreating(false);
        navigate("/enrollment/new", { state: { enrollmentType: selectedEnrollmentType } });
      } else {
        throw new Error('Unknown action from classification');
      }
    } catch (error) {
      console.error("Error in enrollment type confirmation:", error);
      setIsAutoCreating(false);
      
      // Fallback: if classification API fails, use direct enrollment form routing
      // This ensures users aren't stuck if the API is unavailable
      if (selectedEnrollmentType) {
        navigate("/enrollment/new", { state: { enrollmentType: selectedEnrollmentType } });
      } else {
        toast.error(error instanceof Error ? error.message : "Error processing enrollment. Please try again.");
        setSelectedEnrollmentType("");
        setShowEnrollmentTypeModal(true);
      }
    }
  };

  const handleAutoCreateContinuingEnrollment = async () => {
    if (!pastEnrollmentId || !continuingPreviewData || !activeEnrollmentPeriodId) {
      toast.error(t.errMissingAutoData);
      return;
    }

    try {
      setIsAutoCreating(true);

      const response = await fetch(API_ENDPOINTS.ENROLLMENT_AUTO_CREATE_CONTINUING, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          past_enrollment_id: pastEnrollmentId,
          enrollment_period_id: activeEnrollmentPeriodId,
          new_grade_level: continuingPreviewData.next_grade
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create enrollment');
      }

      const data = await response.json();

      if (data.success) {
        setShowContinuingPreview(false);
        setContinuingPreviewData(null);
        setPastEnrollmentId(null);
        
        // Refresh enrollments
        const enrollResponse = await apiGet(API_ENDPOINTS.ENROLLMENTS);
        let enrollmentsList: EnrollmentItem[] = [];
        if (enrollResponse.success && enrollResponse.data) {
          if (Array.isArray(enrollResponse.data)) {
            enrollmentsList = enrollResponse.data;
          } else if (enrollResponse.data.data && Array.isArray(enrollResponse.data.data)) {
            enrollmentsList = enrollResponse.data.data;
          }
        }
        setEnrollments(enrollmentsList);

        // Show success message
        toast.success(`Enrollment submitted successfully! Grade: ${continuingPreviewData.next_grade}. Please wait for approval.`);
      } else {
        throw new Error(data.message || 'Failed to create enrollment');
      }
    } catch (error) {
      console.error("Error creating continuing enrollment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create enrollment");
    } finally {
      setIsAutoCreating(false);
    }
  };

  const handleCancelContinuingPreview = () => {
    setShowContinuingPreview(false);
    setContinuingPreviewData(null);
    setPastEnrollmentId(null);
    // Show type modal again so they can select different type
    setSelectedEnrollmentType("");
    setShowEnrollmentTypeModal(true);
  };

  const handleViewEnrollment = (enrollmentId: number) => {
    if (!isEmailVerified) {
      toast.error(t.errVerifyBeforeView);
      return;
    }
    navigate(`/enrollment/status/${enrollmentId}`);
  };

  // Filter enrollments based on search and status
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const startYear = enrollment.school_year ? enrollment.school_year.replace(/\D/g, '').substring(0, 4) : '0000';
    const formattedId = `APP-${startYear}${String(enrollment.id).padStart(3, '0')}`;
    const matchesSearch = 
      enrollment.id.toString().includes(searchQuery) ||
      formattedId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enrollment.grade_level?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || enrollment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Check if student has an active enrollment in the CURRENT period (prevents duplicate creation)
  // Only allow new enrollment if there's no active enrollment in this specific period
  const hasActiveEnrollmentInCurrentPeriod = enrollments.some(e => 
    e.enrollment_period_id === activeEnrollmentPeriodId && e.status !== "Rejected"
  );
  const canCreateNewEnrollment = !hasActiveEnrollmentInCurrentPeriod;

  if (loading) {
    return (
      <DashboardLayout fullBleed>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">{t.loadingEnrollments}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show email verification lock screen if not verified
  if (!isEmailVerified) {
    return (
      <DashboardLayout fullBleed>
        <AccessLockedCard 
          title={t.enrollmentAccessLocked}
          description={t.verifyEmailLockDescription}
          benefits={[
            t.lockBenefitSecurity,
            t.lockBenefitUpdates,
            t.lockBenefitStart,
          ]}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fullBleed>
      <div className="enrollment-readable overflow-x-hidden">
      {/* Tour Component */}
      <Joyride
        steps={normalizedTourSteps}
        run={runTour}
        stepIndex={tourStepIndex}
        scrollOffset={tourScrollOffset}
        callback={handleTourCallback}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        styles={{
          options: {
            primaryColor: '#2563eb',
            textColor: '#1f2937',
            backgroundColor: '#ffffff',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            spotlightShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
          },
          tooltip: {
            borderRadius: 8,
            fontSize: 14,
          },
          buttonNext: {
            backgroundColor: '#2563eb',
            fontSize: 14,
            borderRadius: 6,
            padding: '8px 16px',
          },
          buttonBack: {
            color: '#6b7280',
            fontSize: 14,
            marginRight: 8,
          },
          buttonSkip: {
            color: '#6b7280',
            fontSize: 14,
          },
        }}
        locale={{
          back: t.joyrideBack,
          close: t.joyrideClose,
          last: t.joyrideFinish,
          next: t.joyrideNext,
          open: t.joyrideOpen,
          skip: t.joyrideSkip,
        }}
      />

      <div className={`px-3 pb-3 pt-3 sm:px-8 sm:pb-8 sm:pt-0 overflow-x-hidden ${mobileTourContentTopSpaceClass}`}>
        <div className="w-full space-y-3 sm:space-y-6">
        {/* Header */}
        <div id="my-enrollments-header" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-5xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{t.pageTitle}</h1>
            <p className="text-[13px] sm:text-sm md:text-base text-muted-foreground/90">{t.pageSubtitle}</p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <Button 
              id="new-enrollment-button"
              onClick={handleStartNewEnrollment}
              disabled={!canCreateNewEnrollment || !hasOpenEnrollmentPeriod}
              className={`text-white shadow-md hover:shadow-lg transition-all w-full sm:w-auto text-xs sm:text-base h-9 sm:h-10 px-4 sm:px-5 rounded-xl ${
                canCreateNewEnrollment && hasOpenEnrollmentPeriod
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  : "bg-gray-400 cursor-not-allowed opacity-60"
              }`}
              title={hasActiveEnrollmentInCurrentPeriod ? t.activeEnrollmentTitle : !hasOpenEnrollmentPeriod ? t.enrollmentPeriodClosedTitle : ""}
            >
              <Plus className="h-4 sm:h-5 w-4 sm:w-5 mr-1 sm:mr-2" />
              {t.newEnrollment}
            </Button>
            {!hasOpenEnrollmentPeriod && (
              <p className="text-xs sm:text-sm text-red-600 font-medium">
                {t.periodClosedWarning}
              </p>
            )}
          </div>
        </div>

        {enrollments.length === 0 ? (
          // Empty State
          <Card className="border-0 shadow-md">
            <CardContent className="p-6 sm:p-12 text-center">
              <div className="mb-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t.noEnrollmentsYet}</h2>
              <p className="text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8 max-w-md mx-auto">
                {t.noEnrollmentsDescription}
              </p>
              <Button
                onClick={handleStartNewEnrollment}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white w-full sm:w-auto text-sm sm:text-base h-9 sm:h-10"
              >
                {t.startFirstEnrollment}
                <ArrowRight className="w-3 sm:w-4 h-3 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-6">
            {/* Summary Stats */}
            <div id="summary-stats-section" className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <Card className="border border-slate-200/70 bg-slate-50 shadow-sm rounded-xl sm:rounded-2xl">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] sm:text-sm font-medium text-slate-600">{t.totalApplications}</p>
                      <p className="text-lg sm:text-3xl font-bold text-slate-900 mt-1">{enrollments.length}</p>
                    </div>
                    <div className="w-8 h-8 sm:w-11 sm:h-11 bg-blue-100 rounded-xl sm:rounded-2xl flex items-center justify-center">
                      <ClipboardList className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-amber-200/70 bg-amber-50 shadow-sm rounded-xl sm:rounded-2xl">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] sm:text-sm font-medium text-amber-700">{t.underReview}</p>
                      <p className="text-lg sm:text-3xl font-bold text-amber-700 mt-1">
                        {enrollments.filter(e => e.status === "Under Review").length}
                      </p>
                    </div>
                    <div className="w-8 h-8 sm:w-11 sm:h-11 bg-amber-100 rounded-xl sm:rounded-2xl flex items-center justify-center">
                      <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-emerald-200/70 bg-emerald-50 shadow-sm rounded-xl sm:rounded-2xl">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] sm:text-sm font-medium text-emerald-700">{t.approved}</p>
                      <p className="text-lg sm:text-3xl font-bold text-emerald-700 mt-1">
                        {enrollments.filter(e => e.status === "Approved").length}
                      </p>
                    </div>
                    <div className="w-8 h-8 sm:w-11 sm:h-11 bg-emerald-100 rounded-xl sm:rounded-2xl flex items-center justify-center">
                      <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/70 bg-slate-50 shadow-sm rounded-xl sm:rounded-2xl">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] sm:text-sm font-medium text-slate-600">{t.latestUpdate}</p>
                      <p className="text-lg sm:text-3xl font-bold text-slate-900 mt-1 leading-tight">
                        {enrollments.length > 0 
                          ? new Date(enrollments[0].submitted_date).toLocaleDateString()
                          : t.na
                        }
                      </p>
                    </div>
                    <div className="w-8 h-8 sm:w-11 sm:h-11 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center">
                      <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-slate-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters and View Mode */}
            <Card id="filters-section" className="hidden sm:block bg-white border border-slate-200/70 shadow-sm rounded-xl sm:rounded-2xl">
              <CardContent className="p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end">
                  {/* Search */}
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="search" className="hidden sm:block text-sm font-medium mb-2 text-slate-700">{t.search}</Label>
                    <div className="relative">
                      <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder={t.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 sm:pl-10 h-9 sm:h-10 text-sm rounded-xl border-slate-300"
                      />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="w-full sm:w-48">
                    <Label htmlFor="status-filter" className="hidden sm:block text-sm font-medium mb-2 text-slate-700">{t.status}</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter" className="h-9 sm:h-10 text-sm rounded-xl border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t.allStatus}</SelectItem>
                        <SelectItem value="Pending">{t.pending}</SelectItem>
                        <SelectItem value="Incomplete">{t.incomplete}</SelectItem>
                        <SelectItem value="Under Review">{t.underReview}</SelectItem>
                        <SelectItem value="Approved">{t.approved}</SelectItem>
                        <SelectItem value="Rejected">{t.rejected}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* View Mode */}
                  <div className="flex items-end gap-1 sm:gap-2 w-full sm:w-auto">
                    <Label className="hidden sm:block text-sm font-medium mb-2 w-full text-slate-700">{t.viewMode}</Label>
                    <div className="flex gap-1 sm:gap-2 w-full sm:w-auto bg-slate-100 p-0.5 sm:p-1 rounded-lg sm:rounded-xl">
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="h-7 sm:h-9 px-2 sm:px-4 flex-1 sm:flex-none rounded-md sm:rounded-lg"
                      >
                        <List className="h-4 w-4" />
                        <span className="hidden sm:inline sm:ml-2">{t.list}</span>
                      </Button>
                      <Button
                        variant={viewMode === "grid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="h-7 sm:h-9 px-2 sm:px-4 flex-1 sm:flex-none rounded-md sm:rounded-lg"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        <span className="hidden sm:inline sm:ml-2">{t.grid}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enrollments List/Grid */}
            {viewMode === "list" ? (
              // Table View
              <Card id="enrollments-list-section" className="bg-white border border-slate-200/70 shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
                <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-900">
                    Enrollment Records ({filteredEnrollments.length})
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full text-[11px] sm:text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/80">
                        <th className="px-2 sm:px-6 py-2.5 sm:py-3 text-left text-[11px] sm:text-sm font-semibold text-gray-900">{t.applicationId}</th>
                        <th className="px-2 sm:px-6 py-2.5 sm:py-3 text-left text-[11px] sm:text-sm font-semibold text-gray-900 hidden sm:table-cell">{t.schoolYear}</th>
                        <th className="px-2 sm:px-6 py-2.5 sm:py-3 text-left text-[11px] sm:text-sm font-semibold text-gray-900 hidden sm:table-cell">{t.gradeLevel}</th>
                        <th className="px-2 sm:px-6 py-2.5 sm:py-3 text-left text-[11px] sm:text-sm font-semibold text-gray-900">{t.status}</th>
                        <th className="px-2 sm:px-6 py-2.5 sm:py-3 text-left text-[11px] sm:text-sm font-semibold text-gray-900 hidden md:table-cell">{t.submittedDate}</th>
                        <th className="px-2 sm:px-6 py-2.5 sm:py-3 text-left text-[11px] sm:text-sm font-semibold text-gray-900">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEnrollments.map((enrollment) => {
                        const config = statusConfig[enrollment.status] || statusConfig.Pending;
                        return (
                          <tr key={enrollment.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition">
                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                              <span className="font-semibold text-gray-900 text-[11px] sm:text-sm">
                                APP-{enrollment.school_year ? enrollment.school_year.replace(/\D/g, '').substring(0, 4) : '0000'}{String(enrollment.id).padStart(3, '0')}
                              </span>
                            </td>
                            <td className="px-2 sm:px-6 py-3 sm:py-4 text-gray-600 hidden sm:table-cell text-[11px] sm:text-sm">{enrollment.school_year || t.na}</td>
                            <td className="px-2 sm:px-6 py-3 sm:py-4 text-gray-600 hidden sm:table-cell text-[11px] sm:text-sm">{enrollment.grade_level || t.na}</td>
                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                              <Badge className={`${config.bg} text-[11px] sm:text-sm`}>
                                <span className={config.text}>{getLocalizedStatus(enrollment.status)}</span>
                              </Badge>
                            </td>
                            <td className="px-2 sm:px-6 py-3 sm:py-4 text-gray-600 hidden md:table-cell text-[11px] sm:text-sm">
                              {new Date(enrollment.submitted_date).toLocaleDateString()}
                            </td>
                            <td className="px-2 sm:px-6 py-3 sm:py-4">
                              <Button
                                id={enrollment.id === filteredEnrollments[0]?.id ? "view-enrollment-button" : undefined}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewEnrollment(enrollment.id)}
                                className="text-primary hover:bg-primary/10 text-[11px] sm:text-sm h-7 sm:h-auto px-2 sm:px-3 rounded-lg"
                              >
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">{t.view}</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              // Grid View
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEnrollments.map((enrollment) => {
                  const config = statusConfig[enrollment.status] || statusConfig.Pending;
                  return (
                    <Card
                      key={enrollment.id}
                      className="bg-white border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-2xl"
                      onClick={() => handleViewEnrollment(enrollment.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 ${config.bg} rounded-lg flex items-center justify-center`}>
                            {config.icon}
                          </div>
                          <Badge className={config.bg}>
                            <span className={config.text}>{getLocalizedStatus(enrollment.status)}</span>
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          APP-{enrollment.school_year ? enrollment.school_year.replace(/\D/g, '').substring(0, 4) : '0000'}{String(enrollment.id).padStart(3, '0')}
                        </h3>
                        <p className="text-sm text-gray-600 mb-1">{t.sy} {enrollment.school_year || t.na}</p>
                        <p className="text-sm text-gray-600 mb-3">{t.grade} {enrollment.grade_level || t.na}</p>
                        <p className="text-sm text-gray-600 mb-4">
                          {t.submitted} {new Date(enrollment.submitted_date).toLocaleDateString()}
                        </p>
                        <Button
                          id={enrollment.id === filteredEnrollments[0]?.id ? "view-enrollment-button" : undefined}
                          variant="ghost"
                          size="sm"
                          className="w-full text-primary hover:bg-primary/10"
                          onClick={() => handleViewEnrollment(enrollment.id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {t.viewDetails}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Info Section */}
            <Card id="enrollment-info-section" className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-200 rounded-xl sm:rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 text-lg sm:text-xl">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  {t.enrollmentInformation}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-blue-800">
                  <li className="flex items-start gap-3">
                    <span className="font-bold">•</span>
                    <span>{t.infoLine1}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold">•</span>
                    <span>{t.infoLine2}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold">•</span>
                    <span>{t.infoLine3}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold">•</span>
                    <span>{t.infoLine4}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </div>

      {/* Enrollment Type Selection Modal */}
      <Dialog open={showEnrollmentTypeModal} onOpenChange={setShowEnrollmentTypeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {user?.role === 'student' ? t.selectReEnrollmentType : t.selectEnrollmentType}
            </DialogTitle>
            <DialogDescription>
              {user?.role === 'student' 
                ? t.reEnrollmentDescription
                : t.enrollmentTypeDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {user?.role === 'student' ? (
              // Student enrollment type options
              <RadioGroup
                value={selectedEnrollmentType}
                onValueChange={(value) => setSelectedEnrollmentType(value as "New Student" | "Continuing Student" | "Returning Student" | "Transferee")}
                className="space-y-3"
              >
                {/* Show Continuing Student option for all students (including legacy/first-timers) */}
                {isEnrollmentTypeEnabled('continuing_student') && (
                  <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg border-2 border-green-200 hover:border-green-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType("Continuing Student")}>
                    <RadioGroupItem value="Continuing Student" id="continuing-student" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="continuing-student" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        {continuingOldStudentLabel}
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">{t.continuingDescription}</p>
                    </div>
                  </div>
                )}

                {isEnrollmentTypeEnabled('returning_student') && (
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType("Returning Student")}>
                    <RadioGroupItem value="Returning Student" id="returning-student" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="returning-student" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        {t.returningStudent}
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">{t.returningDescription}</p>
                    </div>
                  </div>
                )}
              </RadioGroup>
            ) : (
              // Enrollee enrollment type options
              <RadioGroup
                value={selectedEnrollmentType}
                onValueChange={(value) => setSelectedEnrollmentType(value as "New Student" | "Continuing Student" | "Returning Student" | "Transferee")}
                className="space-y-3"
              >
                {isEnrollmentTypeEnabled('new_student') && (
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType("New Student")}>
                    <RadioGroupItem value="New Student" id="new-student" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="new-student" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-blue-600" />
                        {t.newStudent}
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">{t.newStudentDescription}</p>
                    </div>
                  </div>
                )}

                {isEnrollmentTypeEnabled('continuing_student') && (
                  <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg border-2 border-green-200 hover:border-green-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType("Continuing Student")}>
                    <RadioGroupItem value="Continuing Student" id="continuing-student-enrollee" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="continuing-student-enrollee" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        {continuingOldStudentLabel}
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">{t.continuingAtMaranathaDescription}</p>
                    </div>
                  </div>
                )}

                {isEnrollmentTypeEnabled('transferee') && (
                  <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType("Transferee")}>
                    <RadioGroupItem value="Transferee" id="transferee" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="transferee" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        {t.transferee}
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">{t.transfereeDescription}</p>
                    </div>
                  </div>
                )}

                {isEnrollmentTypeEnabled('returning_student') && (
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType("Returning Student")}>
                    <RadioGroupItem value="Returning Student" id="returning-student" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="returning-student" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        {t.returningStudent}
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">{t.returningDescription}</p>
                    </div>
                  </div>
                )}
              </RadioGroup>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowEnrollmentTypeModal(false)}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleEnrollmentTypeConfirm}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              disabled={!selectedEnrollmentType}
            >
              {t.continue}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Continuing Student Auto-Enrollment Preview Dialog */}
      <Dialog open={showContinuingPreview} onOpenChange={setShowContinuingPreview}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center py-2">
              {t.enrollmentConfirmation}
            </DialogTitle>
          </DialogHeader>

          {continuingPreviewData && (
            <div className="space-y-6 py-4">
              {/* Main Confirmation Message */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-600 mb-2">{t.nowEnrollingFor}</p>
                <p className="text-3xl font-bold text-green-600 mb-1">{continuingPreviewData.next_grade}</p>
                <p className="text-lg font-semibold text-gray-800">
                  {t.schoolYearPrefix} {continuingPreviewData.enrolling_school_year || '2026-2027'}
                </p>
              </div>

              {/* Student Info */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-3">{t.studentInformation}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.name}</span>
                    <span className="font-medium">
                      {continuingPreviewData.learner?.first_name} {continuingPreviewData.learner?.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.currentGrade}</span>
                    <span className="font-medium text-blue-600">{continuingPreviewData.current_grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.enrolledGrade}</span>
                    <span className="font-medium text-green-600">{continuingPreviewData.next_grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.gender}</span>
                    <span className="font-medium">{continuingPreviewData.learner?.gender}</span>
                  </div>
                </div>
              </div>

              {/* Parent/Guardian Contact */}
              {continuingPreviewData.contacts && continuingPreviewData.contacts.length > 0 && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">{t.parentGuardian}</h3>
                  <div className="space-y-2 text-sm">
                    {continuingPreviewData.contacts.slice(0, 2).map((contact: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border border-gray-200">
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        <p className="text-xs text-gray-600">{contact.contact_type || contact.type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Address Info */}
              {continuingPreviewData.addresses && continuingPreviewData.addresses.length > 0 && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">{t.residentialAddress}</h3>
                  <div className="text-sm">
                    {continuingPreviewData.addresses.find((a: any) => a.address_type === 'Current') && (
                      <div className="p-2 bg-white rounded border border-gray-200">
                        <p className="font-medium text-gray-900">{t.currentAddress}</p>
                        <p className="text-gray-600 text-xs">
                          {continuingPreviewData.addresses.find((a: any) => a.address_type === 'Current')?.address},
                          {' '}{continuingPreviewData.addresses.find((a: any) => a.address_type === 'Current')?.municipality}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Confirmation Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">{t.importantInfo}</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>{t.importantLine1}</li>
                  <li>{t.importantLine2}</li>
                  <li>{t.importantLine3}</li>
                  <li>{t.importantLine4}</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancelContinuingPreview}
              disabled={isAutoCreating}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleAutoCreateContinuingEnrollment}
              disabled={isAutoCreating}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
            >
              {isAutoCreating ? t.submitting : t.submitEnrollment}
              <CheckCircle2 className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default MyEnrollments;
