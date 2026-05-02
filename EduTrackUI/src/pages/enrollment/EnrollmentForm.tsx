import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS } from "@/lib/api";
import Step1StudentInfo from "./steps/Step1StudentInfo";
import Step2CurrentAddress from "./steps/Step2CurrentAddress";
import Step3PermanentAddress from "./steps/Step3PermanentAddress";
import Step4SpecialInfo from "./steps/Step4SpecialInfo";
import Step5ParentInfo from "./steps/Step5ParentInfo";
import Step6DocumentUpload from "./steps/Step6DocumentUpload";
import Step7ReviewSubmit from "./steps/Step7ReviewSubmit";

export interface EnrollmentFormData {
  // Step 1: Student Information
  learner_first_name: string;
  learner_middle_name: string;
  learner_last_name: string;
  birth_date: string;
  gender: "Male" | "Female" | "";
  guardian_phone: string;
  grade_level: string;

  // Step 2: Current Address
  current_address: string;
  current_barangay: string;
  current_municipality: string;
  current_province: string;
  current_zip_code: string;
  current_phone: string;

  // Step 3: Permanent Address
  permanent_address: string;
  permanent_barangay: string;
  permanent_municipality: string;
  permanent_province: string;
  permanent_zip_code: string;
  same_as_current: boolean;

  // Step 4: Special Information
  enrollment_type: "New Student" | "Continuing Student" | "Returning Student" | "Transferee" | "";
  is_indigenous_ip: boolean;
  is_4ps_beneficiary: boolean;
  has_disability: boolean;
  disability_type: string;
  special_language: string;

  // Step 5: Parent/Guardian Information
  father_name: string;
  father_contact: string;
  father_email: string;
  mother_name: string;
  mother_contact: string;
  mother_email: string;
  guardian_name: string;
  guardian_contact: string;
  guardian_email: string;

  // Step 6: Documents
  documents: File[];
  documentsValid?: boolean;
  physicalDocumentNames?: string[]; // List of document names to be submitted physically

  // Agreement
  agreed_to_terms: boolean;
}

const steps = [
  { number: 1, title: "Student Information", description: "Basic details about the learner" },
  { number: 2, title: "Current Address", description: "Where your child currently lives" },
  { number: 3, title: "Permanent Address", description: "Home address (if different)" },
  { number: 4, title: "Special Information", description: "Additional student information" },
  { number: 5, title: "Parent/Guardian", description: "Contact information for parents" },
  { number: 6, title: "Documents", description: "Required documents upload" },
  { number: 7, title: "Review & Submit", description: "Verify all information" },
];

const initialFormData: EnrollmentFormData = {
  learner_first_name: "",
  learner_middle_name: "",
  learner_last_name: "",
  birth_date: "",
  gender: "",
  guardian_phone: "",
  grade_level: "",
  current_address: "",
  current_barangay: "",
  current_municipality: "",
  current_province: "",
  current_zip_code: "",
  current_phone: "",
  permanent_address: "",
  permanent_barangay: "",
  permanent_municipality: "",
  permanent_province: "",
  permanent_zip_code: "",
  same_as_current: true,
  enrollment_type: "",
  is_indigenous_ip: false,
  is_4ps_beneficiary: false,
  has_disability: false,
  disability_type: "",
  special_language: "",
  father_name: "",
  father_contact: "",
  father_email: "",
  mother_name: "",
  mother_contact: "",
  mother_email: "",
  guardian_name: "",
  guardian_contact: "",
  guardian_email: "",
  documents: [],
  documentsValid: undefined,
  physicalDocumentNames: [],
  agreed_to_terms: false,
};

const stepErrorFields: Record<number, string[]> = {
  1: [
    "learner_first_name",
    "learner_last_name",
    "birth_date",
    "gender",
    "grade_level",
  ],
  2: [
    "current_address",
    "current_municipality",
    "current_province",
    "current_phone",
  ],
  3: ["permanent_address", "permanent_municipality", "permanent_province"],
  4: ["enrollment_type", "disability_type"],
  5: ["parents"],
  6: ["documents"],
  7: ["agreed_to_terms"],
};

const tourSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div className="text-left">
        <h3 className="font-bold text-lg mb-2">Welcome Parents! 👋</h3>
        <p>This automated guide will help you understand how to use our new Enrollment System.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#enrollment-stepper',
    content: 'This bar shows the 7 steps of enrollment. The blue circle shows where you are now.',
  },
  {
    target: '#student-info-form-header',
    content: 'This is the Student Information section where you will enter the learner\'s details.',
  },
  {
    target: '#firstName',
    content: 'Start by entering the First Name of the student.',
  },
  {
    target: '#lastName',
    content: 'Enter the Last Name (Surname).',
  },
  {
    target: '#birthDate',
    content: 'Select the Birth Date from the calendar. The student must be at least 3 years old.',
  },
  {
    target: '#gender-container',
    content: 'Select whether the student is Male or Female.',
  },
  {
    target: '#grade-level-container',
    content: 'Choose the Grade Level the student is enrolling for.',
  },
  {
    target: '#enrollment-navigation',
    content: 'When you are done with a page, click "Next" here. You can also go "Previous" if you need to change something.',
  }
];

const EnrollmentForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<EnrollmentFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enrolleeInfo, setEnrolleeInfo] = useState<any>(null);
  const [isReturningStudent, setIsReturningStudent] = useState(false);
  const [isFirstTimer, setIsFirstTimer] = useState(true);
  const [latestEnrollment, setLatestEnrollment] = useState<any>(null);
  const [currentGrade, setCurrentGrade] = useState<string>("");
  const [nextGrade, setNextGrade] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [hasOpenEnrollmentPeriod, setHasOpenEnrollmentPeriod] = useState<boolean | null>(null);
  const [activeEnrollmentPeriodId, setActiveEnrollmentPeriodId] = useState<number | null>(null);

  // Tour State
  const [runTour, setRunTour] = useState(false);
  const [tourScrollOffset, setTourScrollOffset] = useState(20);

  useEffect(() => {
    // Auto start tour for new users or if not seen before
    const hasSeenTour = localStorage.getItem('hasSeenEnrollmentTour');
    if (!hasSeenTour) {
      setRunTour(true);
    }
  }, []);

  useEffect(() => {
    const updateTourScrollOffset = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;

      if (!isMobile) {
        setTourScrollOffset(20);
        return;
      }

      const mobileHeader = document.querySelector('[data-mobile-header="true"]') as HTMLElement | null;
      const headerHeight = mobileHeader?.getBoundingClientRect().height ?? 56;
      setTourScrollOffset(Math.ceil(headerHeight + 16));
    };

    updateTourScrollOffset();
    window.addEventListener('resize', updateTourScrollOffset);

    return () => {
      window.removeEventListener('resize', updateTourScrollOffset);
    };
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      localStorage.setItem('hasSeenEnrollmentTour', 'true');
    }
  };

  // Get enrollee info from email verification redirect and enrollment type from modal
  useEffect(() => {
    if (location.state) {
      const state = location.state as any;
      if (state.verified && state.email) {
        // User was just verified from enrollment account creation
        setEnrolleeInfo({
          email: state.email,
          firstName: state.firstName,
          lastName: state.lastName,
          userId: state.userId
        });
        console.log('Enrollee coming from email verification:', state);
      }
      
      // Pre-fill enrollment type if passed from modal
      if (state.enrollmentType) {
        setFormData(prev => ({ ...prev, enrollment_type: state.enrollmentType }));
        console.log('Pre-selected enrollment type:', state.enrollmentType);
      }
    }
  }, [location.state]);

  /**
   * Check if there's an open enrollment period
   */
  useEffect(() => {
    const checkEnrollmentPeriod = async () => {
      try {
        const response = await fetch('/api/enrollment-periods/active', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Check if the enrollment period status is "Open"
          if (data.success && data.data) {
            const isOpen = data.data.status === 'Open' || data.data.enrollment_open === true;
            setHasOpenEnrollmentPeriod(isOpen);
            // Store the enrollment period ID
            setActiveEnrollmentPeriodId(data.data.id || null);
          } else if (data.data && data.data.status === 'Open') {
            setHasOpenEnrollmentPeriod(true);
            setActiveEnrollmentPeriodId(data.data.id || null);
          } else {
            setHasOpenEnrollmentPeriod(false);
            setActiveEnrollmentPeriodId(null);
          }
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
    
    checkEnrollmentPeriod();
  }, []);

  // Redirect to login if not authenticated and not from email verification
  // If user comes back to this page after registration, they'll be logged in
  useEffect(() => {
    if (!user && !enrolleeInfo) {
      // Not logged in - redirect to registration with enrollee role param
      navigate("/auth?role=enrollee");
    } else if (user?.role === 'student') {
      // Auto-set enrollment type for existing students
      setIsReturningStudent(true);
      setFormData(prev => ({ ...prev, enrollment_type: 'Continuing Student' }));
      
      // Fetch student's current grade and latest enrollment
      fetchStudentEnrollmentData();
    }
  }, [user, navigate]);

  /**
   * Fetch student's current grade and pre-populate from latest enrollment
   */
  const fetchStudentEnrollmentData = async () => {
    if (!user || user.role !== 'student') return;
    
    setIsLoadingData(true);
    
    try {
      // Fetch current grade
      const gradeResponse = await fetch(API_ENDPOINTS.STUDENT_CURRENT_GRADE, {
        credentials: 'include',
      });
      
      if (gradeResponse.ok) {
        const gradeData = await gradeResponse.json();
        if (gradeData.success) {
          setCurrentGrade(gradeData.current_grade);
          setNextGrade(gradeData.next_grade);
          
          // Set the next grade (non-editable)
          setFormData(prev => ({ ...prev, grade_level: gradeData.next_grade }));
          
          if (!gradeData.can_enroll) {
            toast.error('You have completed all grade levels. Congratulations on your graduation!');
            navigate('/student/dashboard');
            return;
          }
        }
      }
      
      // Fetch latest enrollment data
      const enrollmentResponse = await fetch(API_ENDPOINTS.ENROLLMENT_LATEST, {
        credentials: 'include',
      });
      
      if (enrollmentResponse.ok) {
        const enrollmentData = await enrollmentResponse.json();
        
        if (enrollmentData.success && enrollmentData.has_previous_enrollment) {
          setIsFirstTimer(false);
          setLatestEnrollment(enrollmentData.data);
          
          // Pre-populate form data from latest enrollment
          const latest = enrollmentData.data;
          setFormData(prev => ({
            ...prev,
            // Student info (from previous enrollment)
            learner_first_name: latest.learner_first_name || prev.learner_first_name,
            learner_middle_name: latest.learner_middle_name || prev.learner_middle_name,
            learner_last_name: latest.learner_last_name || prev.learner_last_name,
            birth_date: latest.birth_date || prev.birth_date,
            gender: latest.gender || prev.gender,
            guardian_phone: latest.guardian_phone || prev.guardian_phone,
            
            // Current address
            current_address: latest.current_address || prev.current_address,
            current_barangay: latest.current_barangay || prev.current_barangay,
            current_municipality: latest.current_municipality || prev.current_municipality,
            current_province: latest.current_province || prev.current_province,
            current_zip_code: latest.current_zip_code || prev.current_zip_code,
            current_phone: latest.current_phone || prev.current_phone,
            
            // Permanent address
            permanent_address: latest.permanent_address || prev.permanent_address,
            permanent_barangay: latest.permanent_barangay || prev.permanent_barangay,
            permanent_municipality: latest.permanent_municipality || prev.permanent_municipality,
            permanent_province: latest.permanent_province || prev.permanent_province,
            permanent_zip_code: latest.permanent_zip_code || prev.permanent_zip_code,
            same_as_current: latest.same_as_current || prev.same_as_current,
            
            // Special information
            is_indigenous_ip: latest.is_indigenous_ip || prev.is_indigenous_ip,
            is_4ps_beneficiary: latest.is_4ps_beneficiary || prev.is_4ps_beneficiary,
            has_disability: latest.has_disability || prev.has_disability,
            disability_type: latest.disability_type || prev.disability_type,
            special_language: latest.special_language || prev.special_language,
            
            // Parent/Guardian info
            father_name: latest.father_name || prev.father_name,
            father_contact: latest.father_contact || prev.father_contact,
            father_email: latest.father_email || prev.father_email,
            mother_name: latest.mother_name || prev.mother_name,
            mother_contact: latest.mother_contact || prev.mother_contact,
            mother_email: latest.mother_email || prev.mother_email,
            guardian_name: latest.guardian_name || prev.guardian_name,
            guardian_contact: latest.guardian_contact || prev.guardian_contact,
            guardian_email: latest.guardian_email || prev.guardian_email,
          }));
          
          toast.success('Your previous enrollment data has been loaded for your convenience.');
        } else {
          setIsFirstTimer(true);
        }
      }
    } catch (error) {
      console.error('Error fetching student enrollment data:', error);
      toast.error('Failed to load previous enrollment data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const updateFormData = (updates: Partial<EnrollmentFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear errors when user updates field
    setErrors({});
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.learner_first_name.trim()) newErrors.learner_first_name = "First name is required";
        if (!formData.learner_last_name.trim()) newErrors.learner_last_name = "Last name is required";
        if (!formData.birth_date) {
          newErrors.birth_date = "Birth date is required";
        } else {
          // Validate that child is at least 3 years old
          const birthDate = new Date(formData.birth_date);
          const today = new Date();
          
          // Calculate age in years
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const dayDiff = today.getDate() - birthDate.getDate();
          
          // If birthday hasn't occurred this year, subtract 1
          if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            age--;
          }
          
          if (age < 3) {
            newErrors.birth_date = `Child must be at least 3 years old. Current age: ${age} year${age !== 1 ? 's' : ''}`;
          }
        }
        if (!formData.gender) newErrors.gender = "Gender is required";
        if (!formData.grade_level) newErrors.grade_level = "Grade level is required";
        break;
      case 2:
        if (!formData.current_address.trim()) newErrors.current_address = "Address is required";
        if (!formData.current_municipality.trim()) newErrors.current_municipality = "Municipality is required";
        if (!formData.current_province.trim()) newErrors.current_province = "Province is required";
        if (!formData.current_phone.trim()) newErrors.current_phone = "Contact number is required";
        break;
      case 3:
        if (!formData.same_as_current) {
          if (!formData.permanent_address.trim()) newErrors.permanent_address = "Address is required";
          if (!formData.permanent_municipality.trim()) newErrors.permanent_municipality = "Municipality is required";
          if (!formData.permanent_province.trim()) newErrors.permanent_province = "Province is required";
        }
        break;
      case 4:
        if (!formData.enrollment_type) {
          newErrors.enrollment_type = "Please select enrollment type";
        }
        if (formData.has_disability && !formData.disability_type.trim()) {
          newErrors.disability_type = "Please specify disability type";
        }
        break;
      case 5:
        if (!formData.mother_name.trim() && !formData.father_name.trim() && !formData.guardian_name.trim()) {
          newErrors.parents = "At least one parent/guardian contact is required";
        }
        break;
      case 6:
        // Validate physical document submission for non-continuing students
        if (formData.enrollment_type !== 'Continuing Student' && formData.documentsValid === false) {
          newErrors.documents = "Please confirm you will bring all required documents physically";
        }
        break;
      case 7:
        if (!formData.agreed_to_terms) {
          newErrors.agreed_to_terms = "You must agree to terms and conditions";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToStep = (step: number) => {
    if (!hasOpenEnrollmentPeriod) {
      toast.error('Enrollment period is currently closed. Please try again during the open enrollment period.');
      return;
    }
    if (step < currentStep || validateStep(currentStep)) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goNext = () => {
    if (!hasOpenEnrollmentPeriod) {
      toast.error('Enrollment period is currently closed. Please try again during the open enrollment period.');
      return;
    }
    if (validateStep(currentStep)) {
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const goPrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const currentStepHasErrors = Object.keys(errors).some((key) => stepErrorFields[currentStep]?.includes(key));

  const handleSubmit = async () => {
    if (!hasOpenEnrollmentPeriod) {
      toast.error('Enrollment period is currently closed. You cannot submit enrollments at this time.');
      return;
    }

    if (!validateStep(currentStep)) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare form data with files
      const formDataToSend = new FormData();

      // Add all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "documents") {
          if (typeof value === "boolean") {
            formDataToSend.append(key, value ? "1" : "0");
          } else {
            formDataToSend.append(key, String(value));
          }
        }
      });

      // Add enrollment period ID
      if (activeEnrollmentPeriodId) {
        formDataToSend.append("enrollment_period_id", String(activeEnrollmentPeriodId));
      }

      // Add files
      formData.documents.forEach((file) => {
        formDataToSend.append("documents", file);
      });

      // Submit to API
      const response = await fetch(`${API_ENDPOINTS.ENROLLMENTS || '/api/enrollments'}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: 'include', // Important: Send session cookies with request
        body: formDataToSend,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to submit enrollment");
      }

      const result = await response.json();

      toast.success("Enrollment submitted successfully!");
      localStorage.setItem("lastEnrollmentId", result.enrollment_id);

      // If coming from email verification (enrollee), set user session and go to dashboard
      if (enrolleeInfo && enrolleeInfo.userId) {
        // Set user session directly
        const userData = {
          id: String(enrolleeInfo.userId),
          email: enrolleeInfo.email,
          name: `${enrolleeInfo.firstName || ''} ${enrolleeInfo.lastName || ''}`,
          first_name: enrolleeInfo.firstName,
          last_name: enrolleeInfo.lastName,
          role: 'enrollee' as const
        };
        localStorage.setItem('edutrack_user', JSON.stringify(userData));
        
        // Redirect to enrollee dashboard
        navigate('/enrollee/dashboard', { replace: true });
      } else if (user && user.role === 'enrollee') {
        // Already authenticated enrollee - go to dashboard
        navigate('/enrollee/dashboard', { replace: true });
      } else {
        // Regular enrollment flow - redirect to status page
        navigate(`/enrollment/status/${result.enrollment_id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit enrollment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="enrollment-readable min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div id="enrollment-header" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-8 py-8 sm:py-14 rounded-b-3xl shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold mb-2 sm:mb-3">Enrollment Application</h1>
              <p className="text-blue-100 text-sm sm:text-lg font-medium">Maranatha Christian Academy of Calapan City</p>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm px-4 sm:px-8 py-2 sm:py-4 rounded-xl border border-white border-opacity-30 whitespace-nowrap flex items-center gap-3">
              <p className="text-white text-xs sm:text-sm font-semibold tracking-wide">Step {currentStep} of {steps.length}</p>
              <button 
                onClick={() => setRunTour(true)} 
                className="flex items-center gap-1 text-xs text-blue-100 hover:text-white transition-colors bg-blue-800 bg-opacity-30 px-2 py-1 rounded-lg"
              >
                <HelpCircle size={14} />
                <span className="hidden sm:inline">Help Guide</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-6 py-6 sm:py-10">
          {/* Enrollment Period Alert */}
          {hasOpenEnrollmentPeriod === false && (
            <Alert variant="destructive" className="mb-6 border-red-300 bg-red-50">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="text-red-800 font-medium">
                The enrollment period is currently closed. You cannot create new enrollments at this time. Please contact the admissions office for more information.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading Enrollment Period */}
          {hasOpenEnrollmentPeriod === null && (
            <Alert className="mb-6 border-blue-300 bg-blue-50">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <AlertDescription className="text-blue-800 font-medium">
                Checking enrollment period status...
              </AlertDescription>
            </Alert>
          )}
          {/* Progress Steps */}
          <Card id="enrollment-stepper" className="mb-8 sm:mb-10 border-0 shadow-lg bg-white">
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-center justify-between overflow-x-auto">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center flex-none">
                    <button
                      onClick={() => goToStep(step.number)}
                      className={`flex items-center justify-center w-10 h-10 sm:w-16 sm:h-16 rounded-full font-bold transition-all transform hover:scale-105 flex-shrink-0 ${
                        currentStep === step.number
                          ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg ring-4 ring-blue-200"
                          : currentStep > step.number
                            ? "bg-gradient-to-br from-green-400 to-green-600 text-white shadow-md hover:shadow-lg"
                            : "bg-gray-50 text-gray-400 border-2 border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      {currentStep > step.number ? <CheckCircle2 size={20} className="sm:size-8" /> : <span className="text-xs sm:text-base">{step.number}</span>}
                    </button>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-1 sm:w-3 h-1 mx-1 sm:mx-3 rounded-full transition-all flex-shrink-0 ${
                          currentStep > step.number
                            ? "bg-gradient-to-r from-green-400 to-green-600"
                            : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Form Content */}
          <Card id="enrollment-form-area" className="shadow-xl border-0">
            <CardContent className="p-4 sm:p-8 lg:p-10">
              {/* Step Info */}
              <div id="enrollment-step-info" className="text-center bg-gradient-to-r from-orange-50 to-yellow-50 px-6 py-6 rounded-xl border border-orange-100 mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{steps[currentStep - 1].title}</h2>
                <p className="text-gray-600 text-lg">{steps[currentStep - 1].description}</p>
                {isReturningStudent && !isFirstTimer && (
                  <p className="text-sm text-blue-600 mt-2">
                    ✓ Pre-filled from your previous enrollment. You can update any information that has changed.
                  </p>
                )}
              </div>
              {isLoadingData ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your enrollment data...</p>
                </div>
              ) : (
                <>
                  {currentStep === 1 && <Step1StudentInfo formData={formData} updateFormData={updateFormData} errors={errors} isReturningStudent={isReturningStudent} isFirstTimer={isFirstTimer} currentGrade={currentGrade} nextGrade={nextGrade} />}
                  {currentStep === 2 && <Step2CurrentAddress formData={formData} updateFormData={updateFormData} errors={errors} isReturningStudent={isReturningStudent} isFirstTimer={isFirstTimer} />}
                  {currentStep === 3 && <Step3PermanentAddress formData={formData} updateFormData={updateFormData} errors={errors} isReturningStudent={isReturningStudent} isFirstTimer={isFirstTimer} />}
                  {currentStep === 4 && <Step4SpecialInfo formData={formData} updateFormData={updateFormData} errors={errors} isReturningStudent={isReturningStudent} isFirstTimer={isFirstTimer} />}
                  {currentStep === 5 && <Step5ParentInfo formData={formData} updateFormData={updateFormData} errors={errors} isReturningStudent={isReturningStudent} isFirstTimer={isFirstTimer} />}
                  {currentStep === 6 && <Step6DocumentUpload formData={formData} updateFormData={updateFormData} errors={errors} isReturningStudent={isReturningStudent} isFirstTimer={isFirstTimer} />}
                  {currentStep === 7 && <Step7ReviewSubmit formData={formData} updateFormData={updateFormData} errors={errors} isReturningStudent={isReturningStudent} />}
                </>
              )}
            </CardContent>
          </Card>

          {/* Error Alert */}
          {currentStepHasErrors && (
            <Alert variant="destructive" className="mb-6 border-red-300 bg-red-50 mt-6">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="text-red-800 font-medium">Please correct the highlighted errors above before proceeding.</AlertDescription>
            </Alert>
          )}

          {/* Navigation Buttons */}
          <div id="enrollment-navigation" className="flex flex-col-reverse sm:flex-row justify-between gap-3 sm:gap-4 mt-8 sm:mt-10 mb-6 sm:mb-8">
            <Button
              variant="outline"
              onClick={goPrevious}
              disabled={currentStep === 1 || !hasOpenEnrollmentPeriod}
              className="px-6 sm:px-8 py-2 sm:py-3 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm sm:text-base w-full sm:w-auto disabled:opacity-50"
            >
              <ChevronLeft size={18} className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              {currentStep < steps.length && (
                <Button 
                  onClick={goNext}
                  disabled={!hasOpenEnrollmentPeriod}
                  className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-105 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight size={18} className="ml-1 sm:ml-2" />
                </Button>
              )}

              {currentStep === steps.length && (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !hasOpenEnrollmentPeriod}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Joyride
        steps={tourSteps}
        run={runTour}
        disableScrolling={false}
        spotlightPadding={5}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        scrollOffset={tourScrollOffset}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 1000,
          },
        }}
        locale={{
          last: 'Finish',
          skip: 'Skip',
        }}
      />
    </div>
  );
};

export default EnrollmentForm;
