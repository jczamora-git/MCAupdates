import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentPageLock } from "@/hooks/usePaymentPageLock";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, CheckCircle2, Clock, AlertCircle, Download, Search, PhilippinePeso, ArrowLeft, Calendar, Receipt, DollarSign, Lock, ChevronDown, ChevronUp, Coins } from "lucide-react";
import { toast } from "sonner";
import AccessLockedCard from "@/components/AccessLockedCard";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { calculateInstallmentPenalty } from "@/utils/penaltyCalculator";
import { WaiverRequestModal } from "@/components/WaiverRequestModal";
import Joyride, { CallBackProps, STATUS, EVENTS } from "react-joyride";
import { PaymentMobileView, FeeTypeModal } from "@/components/PaymentMobileView";

interface PaymentItem {
  id: number;
  student_id: number;
  enrollment_id?: number;
  academic_period_id: number;
  receipt_number: string;
  payment_type: 'Tuition Full Payment' | 'Tuition Installment' | 'Miscellaneous' | 'Contribution' | 'Event Fee' | 'Book' | 'Uniform' | 'Service Fee' | 'Other';
  payment_for: string;
  amount: number;
  total_discount: number;
  net_amount: number;
  payment_method: 'Cash' | 'Check' | 'Bank Transfer' | 'GCash' | 'PayMaya' | 'Others';
  payment_date: string;
  reference_number?: string;
  installment_id?: number;
  proof_of_payment_url?: string;
  status: 'Pending' | 'Verified' | 'Approved' | 'Rejected';
  is_refund: boolean;
  refund_reason?: string;
  original_payment_id?: number;
  remarks?: string;
  received_by?: number;
  verified_by?: number;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

interface SchoolFee {
  id: number;
  year_level: string | null;
  fee_type: 'Tuition' | 'Miscellaneous' | 'Contribution' | 'Event Fee' | 'Book' | 'Uniform' | 'Service Fee' | 'Other';
  fee_name: string;
  amount: number;
  is_required: boolean;
  due_date: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface DiscountTemplate {
  id: number;
  name: string;
  type: string;
  value: number;
  value_type: 'Percentage' | 'Fixed Amount';
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaymentPlan {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  enrollment_id?: string;
  academic_period_id: string;
  academic_period: string;
  total_tuition: number;
  total_paid: number;
  balance: number;
  schedule_type: "Monthly" | "Quarterly" | "Semestral" | "Tri Semestral";
  number_of_installments: number;
  status: "Active" | "Completed" | "Overdue" | "Cancelled";
  start_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Installment {
  id: string;
  payment_plan_id: string;
  installment_number: number;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  paid_date?: string;
  status: "Pending" | "Paid" | "Partial" | "Overdue";
  late_fee: number;
  days_overdue: number;
}

interface Enrollment {
  id: number;
  student_id: number;
  academic_period_id: number;
  school_year: string;
  quarter: string;
  grade_level: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: "gcash",
    name: "GCash",
    icon: "📱",
    description: "Quick and easy mobile payment",
  },
  {
    id: "bank_transfer",
    name: "Bank Transfer",
    icon: "🏦",
    description: "Direct bank transfer",
  },
  {
    id: "credit_card",
    name: "Credit/Debit Card",
    icon: "💳",
    description: "Visa, Mastercard accepted",
  },
  {
    id: "check",
    name: "Check Payment",
    icon: "✓",
    description: "Pay by check",
  },
];

const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: <Clock className="w-4 h-4" />,
  },
  Verified: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    icon: <AlertCircle className="w-4 h-4" />,
  },
  Approved: {
    bg: "bg-green-100",
    text: "text-green-800",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  Rejected: {
    bg: "bg-red-100",
    text: "text-red-800",
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

const Payment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPaymentSectionUnlocked, hasSubmittedEnrollment } = usePaymentPageLock();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const isEmailVerified = user?.status !== 'pending';

  // Log initial state
  console.log('📄 [Payment] Component rendered', {
    isPaymentSectionUnlocked,
    isEmailVerified,
    userExists: !!user,
    userId: user?.id,
    userPaymentPinSet: user?.payment_pin_set,
    userStatus: user?.status,
  });
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [allSchoolFees, setAllSchoolFees] = useState<SchoolFee[]>([]);
  const [availableSchoolFees, setAvailableSchoolFees] = useState<SchoolFee[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFees, setLoadingFees] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentPlanModal, setShowPaymentPlanModal] = useState(false);
  const [tuitionFee, setTuitionFee] = useState<SchoolFee | null>(null);
  const [discountTemplates, setDiscountTemplates] = useState<DiscountTemplate[]>([]);
  const [showSchoolFeeModal, setShowSchoolFeeModal] = useState(false);
  const [selectedSchoolFee, setSelectedSchoolFee] = useState<SchoolFee | null>(null);
  const [hasTuitionPayment, setHasTuitionPayment] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Payment plans and installments state
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [installments, setInstallments] = useState<{ [planId: string]: Installment[] }>({});
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Installment modal state
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);

  // Waiver request modal state
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [pendingPaymentNavigation, setPendingPaymentNavigation] = useState<any>(null);

  // Installment schedule collapse state
  const [isInstallmentScheduleExpanded, setIsInstallmentScheduleExpanded] = useState(true);

  // Tour states
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [isAutoTourRunning, setIsAutoTourRunning] = useState(false);

  // Mobile view state
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [selectedFeeTypeMobile, setSelectedFeeTypeMobile] = useState<string | null>(null);

  // Student without enrollment modal state
  const [showNoEnrollmentModal, setShowNoEnrollmentModal] = useState(false);

  // Combined loading state - wait for all fetches to complete
  useEffect(() => {
    if (!isEmailVerified) {
      setIsInitialLoading(false);
      return;
    }

    // If any fetch is in progress, show loading screen
    if (loading || loadingFees || loadingPlans) {
      setIsInitialLoading(true);
    } else {
      // All fetches completed
      setIsInitialLoading(false);
    }
  }, [loading, loadingFees, loadingPlans, isEmailVerified]);

  // Fetch enrollment data using the same logic as MyEnrollments page
  useEffect(() => {
    const fetchEnrollment = async () => {
      if (!user?.id) return;

      try {
        const response = await apiGet(API_ENDPOINTS.ENROLLMENTS);

        console.log('Enrollments API Response:', response);
        console.log('response.data type:', typeof response.data, 'is array?', Array.isArray(response.data));
        console.log('response.data keys:', response.data ? Object.keys(response.data) : 'null');

        // Handle different response structures (same as MyEnrollments.tsx)
        let enrollmentsArray: Enrollment[] = [];

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
        // Also ensure student_id is present (map from created_student_id if needed)
        enrollmentsArray = enrollmentsArray.map((enrollment: any) => ({
          ...enrollment,
          student_id: enrollment.student_id || enrollment.created_student_id || user?.id,
          status: (enrollment.status || "Pending") as any
        }));

        console.log('Parsed enrollments:', enrollmentsArray, 'total:', enrollmentsArray.length);

        // Get the most recent active enrollment (Enrolled status)
        const activeEnrollment = enrollmentsArray.find((e: Enrollment) => e.status === 'Enrolled') || enrollmentsArray[0];
        setEnrollment(activeEnrollment || null);
      } catch (err) {
        console.error('Error fetching enrollment:', err);
      }
    };

    if (isEmailVerified) {
      fetchEnrollment();
    }
  }, [user?.id, isEmailVerified]);

  // Fetch payments data
  useEffect(() => {
    const fetchPayments = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch payments for the current user
        const response = await fetch(`/api/payments/student/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch payment data');
        }

        const data = await response.json();
        setPayments(data.payments || []);
      } catch (err) {
        console.error('Error fetching payments:', err);
        setError('Failed to load payment data. Please try again.');
        toast.error('Failed to load payment data');
      } finally {
        setLoading(false);
      }
    };

    if (isEmailVerified) {
      fetchPayments();
    }
  }, [user?.id, isEmailVerified]);

  // Auto-start tour for new users
  useEffect(() => {
    if (isEmailVerified && !loading) {
      const tourCompleted = localStorage.getItem('payment-tour-completed');
      if (!tourCompleted) {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
          setIsAutoTourRunning(true);
          setShowPaymentPlanModal(false); // Hide modal before starting tour
          setRunTour(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isEmailVerified, loading]);

  const handleDownloadInvoice = (paymentId: number) => {
    // UI-only: open the invoice endpoint in a new tab. Backend should provide the PDF.
    const url = `${window.location.origin}/api/payments/${paymentId}/invoice`;
    window.open(url, '_blank');
  };

  const handleViewInstallments = (plan: PaymentPlan) => {
    setSelectedPlan(plan);
    setShowInstallmentModal(true);
  };

  const handleMobilePayInstallment = (installment: any, plan: any) => {
    if (!enrollment) {
      toast.error('Enrollment information not available');
      return;
    }

    const relatedPayment = payments.find(p => p.installment_id === installment.id);
    const penaltyInfo = installment.installment_number === 1
      ? { hasPenalty: false, penaltyAmount: 0, totalDue: installment.balance || installment.amount_due, daysOverdue: 0, penaltyPercentage: 0 }
      : calculateInstallmentPenalty({
          due_date: installment.due_date,
          balance: installment.balance || installment.amount_due,
          status: installment.status,
          amount_paid: installment.amount_paid
        });

    const totalAmountDue = penaltyInfo?.hasPenalty
      ? Number(penaltyInfo.totalDue)
      : Number(installment.balance || installment.amount_due);

    const navigationState = {
      enrollment,
      tuitionFee: {
        id: Number(plan?.id || 0),
        amount: installment.amount_due,
        fee_name: `Installment #${installment.installment_number} - ${plan?.academic_period || enrollment.school_year}`
      },
      paymentType: 'Installment Payment',
      amountPerInstallment: totalAmountDue,
      paymentPlanId: Number(plan?.id || 0),
      installmentNumber: installment.installment_number,
      periodLabel: `Installment ${installment.installment_number}`,
      installment: {
        ...installment,
        penaltyInfo
      },
      paymentPlan: plan,
      previousPayment: relatedPayment,
      penaltyAmount: penaltyInfo?.hasPenalty ? Number(penaltyInfo.penaltyAmount) : 0,
      daysOverdue: penaltyInfo?.daysOverdue || 0,
      waiverSubmitted: false
    };

    if (penaltyInfo?.hasPenalty && installment.installment_number !== 1) {
      setPendingPaymentNavigation(navigationState);
      setShowWaiverModal(true);
    } else {
      localStorage.setItem('pending_installment_payment', JSON.stringify(navigationState));
      navigate('/enrollment/payment-process', {
        state: navigationState
      });
    }
  };

  const handleSchoolFeeClick = (fee: SchoolFee) => {
    setSelectedSchoolFee(fee);
    
    // If this is a tuition fee, show the tuition payment plan modal
    if (fee.fee_type === 'Tuition') {
      setShowPaymentPlanModal(true);
    } else {
      // Otherwise, show the school fee payment modal
      setShowSchoolFeeModal(true);
    }
  };

  const handleSchoolFeePayment = () => {
    if (!selectedSchoolFee || !enrollment || !user) return;

    // Close modal
    setShowSchoolFeeModal(false);

    // Navigate to payment process page with school fee details formatted for PaymentProcess
    navigate('/enrollment/payment-process', {
      state: {
        enrollment,
        tuitionFee: {
          id: selectedSchoolFee.id,
          amount: selectedSchoolFee.amount,
          fee_name: selectedSchoolFee.fee_name
        },
        paymentType: 'Full Payment',
        schoolFee: selectedSchoolFee, // Keep original school fee data for reference
        feeType: selectedSchoolFee.fee_type,
        feeName: selectedSchoolFee.fee_name
      }
    });
  };

  // Fetch school fees
  useEffect(() => {
    const fetchSchoolFees = async () => {
      try {
        setLoadingFees(true);

        // Use API_ENDPOINTS for school fees
        const data = await apiGet(API_ENDPOINTS.SCHOOL_FEES);

        if (data.success) {
          // Transform the data to match our interface
          const transformedFees = (data.data || []).map((fee: any) => ({
            ...fee,
            amount: Number(fee.amount),
            is_required: Boolean(fee.is_required),
          }));
          
          // Set all school fees (tuition will be selected based on enrollment grade level)
          setAllSchoolFees(transformedFees);
        }
      } catch (err) {
        console.error('Error fetching school fees:', err);
      } finally {
        setLoadingFees(false);
      }
    };

    if (isEmailVerified) {
      fetchSchoolFees();
    }
  }, [isEmailVerified]);

  // Select tuition fee that matches the enrollment grade level (or global tuition if year_level is null)
  useEffect(() => {
    if (!enrollment || allSchoolFees.length === 0) return;

    const matchedTuition = allSchoolFees.find((fee: SchoolFee) =>
      fee.fee_type === 'Tuition' &&
      fee.is_active &&
      (!fee.year_level || fee.year_level === enrollment.grade_level)
    );

    setTuitionFee(matchedTuition || null);
  }, [allSchoolFees, enrollment]);

  // Filter school fees based on existing payments
  useEffect(() => {
    // If no enrollment exists, don't show any fees
    if (!enrollment) {
      setAvailableSchoolFees([]);
      return;
    }
    
    if (allSchoolFees.length === 0) {
      setAvailableSchoolFees([]);
      return;
    }
    // Determine if there's an existing payment plan for this enrollment
    const hasPlanForEnrollment = paymentPlans.some((p) => String(p.enrollment_id) === String(enrollment.id));

    // Filter out fees that already have payment records (regardless of status)
    const filteredFees = allSchoolFees.filter((fee) => {
      // Filter ALL fees by grade level (not just tuition)
      // year_level can be null (applies to all grades) or must match the enrollment grade level
      const gradeMatches = !fee.year_level || fee.year_level === enrollment.grade_level;
      if (!gradeMatches) {
        return false; // Skip fees that don't match the student's grade level
      }

      // If there's already a payment plan for this enrollment, hide tuition fees
      if (hasPlanForEnrollment && fee.fee_type === 'Tuition') {
        return false;
      }

      // If user is enrollee, hide all non-tuition fees
      if (user?.role === 'enrollee' && fee.fee_type !== 'Tuition') {
        return false;
      }

      // Check if there's any payment for this specific fee
      const hasPayment = payments.some((payment) => {
        // Check enrollment match - use both enrollment_id and student_id for flexibility
        const enrollmentMatch = 
          (payment.enrollment_id && payment.enrollment_id === enrollment.id) ||
          (payment.student_id === user?.id);
        
        // Check if this payment is for the current fee (regardless of status)
        const feeMatch = 
          // Match by fee name in payment_for field
          payment.payment_for.toLowerCase().includes(fee.fee_name.toLowerCase()) ||
          // Or match by fee type for tuition fees
          (fee.fee_type === 'Tuition' && (payment.payment_type.includes('Tuition') || payment.payment_type === 'Tuition Full Payment' || payment.payment_type === 'Tuition Installment'));
        
        return enrollmentMatch && feeMatch;
      });
      
      // Keep the fee only if no payment exists for it
      return !hasPayment;
    });

    setAvailableSchoolFees(filteredFees);
  }, [enrollment, payments, allSchoolFees, user?.id, user?.role, paymentPlans]);

  // Fetch discount templates
  useEffect(() => {
    const fetchDiscountTemplates = async () => {
      try {
        const data = await apiGet(API_ENDPOINTS.DISCOUNT_TEMPLATES);
        if (data.success) {
          setDiscountTemplates(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching discount templates:', err);
      }
    };

    if (isEmailVerified) {
      fetchDiscountTemplates();
    }
  }, [isEmailVerified]);

  // Fetch payment plans and installments
  useEffect(() => {
    const fetchPaymentPlans = async () => {
      if (!user?.id) return;

      try {
        setLoadingPlans(true);

        // Fetch payment plans for the current user
        const plansResponse = await apiGet(`${API_ENDPOINTS.PAYMENT_PLANS}?student_id=${user.id}`);

        if (plansResponse.success) {
          const plans = plansResponse.data || [];
          setPaymentPlans(plans);

          // Fetch installments for each plan
          const installmentsData: { [planId: string]: Installment[] } = {};
          for (const plan of plans) {
            try {
              const installmentsResponse = await apiGet(API_ENDPOINTS.PAYMENT_PLAN_INSTALLMENTS(plan.id));
              if (installmentsResponse.success) {
                installmentsData[plan.id] = installmentsResponse.data || [];
              }
            } catch (err) {
              console.error(`Error fetching installments for plan ${plan.id}:`, err);
            }
          }
          setInstallments(installmentsData);
        }
      } catch (err) {
        console.error('Error fetching payment plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    };

    if (isEmailVerified) {
      fetchPaymentPlans();
    }
  }, [user?.id, isEmailVerified]);

  // Prevent modal from showing while auto-tour is running or during initial loading
  // Also prevent if tour should auto-start (not completed yet)
  useEffect(() => {
    const tourCompleted = localStorage.getItem('payment-tour-completed');
    const shouldAutoStartTour = isEmailVerified && !loading && !tourCompleted;
    
    if (isAutoTourRunning || isInitialLoading || shouldAutoStartTour) {
      setShowPaymentPlanModal(false);
    }
  }, [isAutoTourRunning, isInitialLoading, isEmailVerified, loading]);
  useEffect(() => {
    if (!enrollment || !tuitionFee || payments.length === 0 && loading) return;

    // Check if user has any tuition payment (Full Payment or Installment) for current enrollment
    const tuitionPaid = payments.some(
      (payment) =>
        payment.enrollment_id === enrollment.id &&
        (payment.payment_type === 'Tuition Full Payment' || payment.payment_type === 'Tuition Installment')
    );

    // Check if user has any active payment plans
    const hasPaymentPlan = paymentPlans.length > 0;

    setHasTuitionPayment(tuitionPaid || hasPaymentPlan);

    // If no tuition payment AND no payment plan found, show payment plan selection modal
    // But don't show if the auto-tour is currently running, during initial loading, or if tour should auto-start
    const tourCompleted = localStorage.getItem('payment-tour-completed');
    const shouldAutoStartTour = isEmailVerified && !loading && !tourCompleted;
    
    if (!tuitionPaid && !hasPaymentPlan && !loading && !loadingPlans && !isAutoTourRunning && !isInitialLoading && !shouldAutoStartTour) {
      setShowPaymentPlanModal(true);
    }
  }, [enrollment, tuitionFee, payments, paymentPlans, loading, loadingPlans, isAutoTourRunning, isInitialLoading, isEmailVerified]);

  // Show no enrollment modal for students without enrollment record
  useEffect(() => {
    // Only for students (not enrollees) who have no enrollment
    if (!enrollment && user?.role === 'student' && !loading && isEmailVerified) {
      const hasSeenModal = sessionStorage.getItem('no-enrollment-modal-shown');
      if (!hasSeenModal) {
        setShowNoEnrollmentModal(true);
        sessionStorage.setItem('no-enrollment-modal-shown', 'true');
      }
    }
  }, [enrollment, user?.role, loading, isEmailVerified]);

  const totalAmount = payments
    .filter((p) => p.status === "Pending" || p.status === "Verified")
    .reduce((sum, p) => sum + Number(p.net_amount), 0);

  const isApprovedPayment = (payment: any) =>
    String(payment?.status || '').trim().toLowerCase() === 'approved';

  const paidAmount = payments
    .filter((p) => isApprovedPayment(p))
    .reduce((sum, p) => sum + Number(p.net_amount), 0);

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.payment_for.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.id.toString().includes(searchQuery);
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Tour steps
  const tourSteps = useMemo(() => [
    {
      target: '#payment-header',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Welcome to Payment Management!</h3>
          <p className="text-sm">This is your comprehensive payment dashboard where you can view payment history, manage outstanding fees, and process new payments for tuition and school fees.</p>
        </div>
      ),
      placement: 'bottom' as const,
      disableBeacon: true,
    },
    {
      target: '#summary-stats-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Payment Summary</h3>
          <p className="text-sm">Get a quick overview of your financial status with these key metrics: amount due, amount paid, student information, and total transactions.</p>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#payment-details-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Payment History</h3>
          <p className="text-sm">View all your payment transactions here. Each entry shows the payment details, status, amount, and includes options to download invoices.</p>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#search-filter-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Search & Filter</h3>
          <p className="text-sm">Use these tools to find specific payments. Search by payment description, receipt number, or ID. Filter by payment status to focus on what matters most.</p>
        </div>
      ),
      placement: 'bottom' as const,
    },
    {
      target: '#school-fees-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">School Fees</h3>
          <p className="text-sm">This section shows all available school fees. Tuition fees will open the payment plan selector, while other fees (books, uniforms, etc.) require tuition payment first.</p>
        </div>
      ),
      placement: 'left' as const,
    },
    {
      target: '#payment-summary-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Payment Summary</h3>
          <p className="text-sm">Review your complete payment breakdown including total transactions, amounts paid, discounts applied, and outstanding balance.</p>
        </div>
      ),
      placement: 'top' as const,
    },
    {
      target: '#important-notice-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Important Information</h3>
          <p className="text-sm">Review these key payment policies including due dates, confirmation processes, and refund policies. Stay informed to avoid any issues.</p>
        </div>
      ),
      placement: 'top' as const,
    },
  ], []);

  // Tour callback
  const handleTourCallback = (data: CallBackProps) => {
    const { status, type, index } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setTourStepIndex(index + 1);
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      setTourStepIndex(0);
      setIsAutoTourRunning(false);
      localStorage.setItem('payment-tour-completed', 'true');
    }
  };

  useEffect(() => {
    const handleStartTourEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tourId?: string }>;
      if (customEvent.detail?.tourId !== 'payment-management') {
        return;
      }

      setTourStepIndex(0);
      setRunTour(true);
    };

    window.addEventListener('campuscompanion:start-tour', handleStartTourEvent as EventListener);
    return () => {
      window.removeEventListener('campuscompanion:start-tour', handleStartTourEvent as EventListener);
    };
  }, []);

  return (
    <DashboardLayout fullBleed>
      <div className="enrollment-readable">
      {isPaymentSectionUnlocked === null && (
        <div className="flex items-center justify-center min-h-screen">
          {console.log('📄 [Payment] Rendering: isPaymentSectionUnlocked === null (Loading)')}
          <p className="text-gray-500">Loading...</p>
        </div>
      )}
      {isPaymentSectionUnlocked === false && (
        <div className="flex items-center justify-center min-h-screen">
          {console.log('📄 [Payment] Rendering: isPaymentSectionUnlocked === false (Verifying PIN...)')}
          <p className="text-gray-500">Verifying PIN...</p>
        </div>
      )}
      {!isEmailVerified && isPaymentSectionUnlocked !== null && (
        <>
          {console.log('📄 [Payment] Rendering: Email not verified')}
          <AccessLockedCard 
            title="Payment Access Locked"
            description="You need to verify your email address before you can access the payment system."
            benefits={[
              "Secure your account and prevent unauthorized access",
              "Receive important payment notifications and updates",
              "Complete your enrollment process and pay tuition fees"
            ]}
          />
        </>
      )}

      {/* Check if enrollee has submitted enrollment - use hook's value */}
      {isEmailVerified && isPaymentSectionUnlocked === true && !isInitialLoading && user?.role === 'enrollee' && hasSubmittedEnrollment === false && (
        <>
          {console.log('📄 [Payment] Rendering: Enrollee without submitted enrollment')}
          <AccessLockedCard 
            title="Enrollment Required"
            description="You need to submit your enrollment application before you can access the payment system."
            benefitsTitle="What you need to do:"
            benefits={[
              "Complete your enrollment application first",
              "Wait for enrollment approval from the administration",
              "Once approved, you can proceed to payment"
            ]}
            actionButton={{
              label: "Go to My Enrollments",
              onClick: () => navigate('/enrollment/my-enrollments')
            }}
          />
        </>
      )}
      
      {isEmailVerified && isInitialLoading && isPaymentSectionUnlocked === true && (user?.role !== 'enrollee' || hasSubmittedEnrollment === true) && (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
          {console.log('📄 [Payment] Rendering: Payment dashboard loading')}
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">Loading Payment Dashboard</h2>
              <p className="text-sm text-muted-foreground">Fetching your payment data and school fees...</p>
            </div>
          </div>
        </div>
      )}
      
      {isEmailVerified && !isInitialLoading && isPaymentSectionUnlocked === true && (user?.role !== 'enrollee' || hasSubmittedEnrollment === true) && isMobile && (
        <>
          {console.log('📄 [Payment] Rendering: Mobile payment view')}
          <PaymentMobileView
            user={user}
            enrollment={enrollment}
            payments={payments}
            allSchoolFees={allSchoolFees}
            availableSchoolFees={availableSchoolFees}
            loading={loading}
            error={error}
            handleSchoolFeeClick={handleSchoolFeeClick}
            totalAmount={totalAmount}
            paidAmount={paidAmount}
            navigate={navigate}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            filteredPayments={filteredPayments}
            handleDownloadInvoice={handleDownloadInvoice}
            selectedFeeTypeMobile={selectedFeeTypeMobile}
            setSelectedFeeTypeMobile={setSelectedFeeTypeMobile}
            hasTuitionPayment={hasTuitionPayment}
            paymentPlans={paymentPlans}
            installments={installments}
            handleViewInstallments={handleViewInstallments}
            onPayInstallment={handleMobilePayInstallment}
            // Desktop modals for mobile use
            showSchoolFeeModal={showSchoolFeeModal}
            setShowSchoolFeeModal={setShowSchoolFeeModal}
            selectedSchoolFee={selectedSchoolFee}
            showPaymentPlanModal={showPaymentPlanModal}
            setShowPaymentPlanModal={setShowPaymentPlanModal}
            runTour={runTour}
            setRunTour={setRunTour}
            setTourStepIndex={setTourStepIndex}
            tourSteps={tourSteps}
            tourStepIndex={tourStepIndex}
            handleTourCallback={handleTourCallback}
          />
          <FeeTypeModal
            isOpen={selectedFeeTypeMobile !== null}
            onClose={() => setSelectedFeeTypeMobile(null)}
            feeType={selectedFeeTypeMobile}
            fees={selectedFeeTypeMobile ? availableSchoolFees.filter(f => f.fee_type === selectedFeeTypeMobile) : []}
            onFeeSelect={handleSchoolFeeClick}
          />
        </>
      )}

      {isEmailVerified && !isInitialLoading && isPaymentSectionUnlocked === true && (user?.role !== 'enrollee' || hasSubmittedEnrollment === true) && !isMobile && (
      <div className="px-4 pb-4 pt-4 sm:px-8 sm:pb-8 sm:pt-0">
        {/* Back Button */}
        <div className="mb-6 sm:mb-8">
          

          {/* Header with Icon and Title */}
          <div id="payment-header" className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
                <CreditCard className="h-6 sm:h-8 w-6 sm:w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-1 sm:mb-2">
                  Payment Management
                </h1>
                <p className="text-muted-foreground text-xs sm:text-base">Manage your tuition and school fees</p>
              </div>
            </div>
          </div>
        </div>

        {/* No Enrollment Warning Banner for Students */}
        {!enrollment && user?.role === 'student' && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <Lock className="h-5 w-5 text-orange-600" />
            <AlertTitle className="text-orange-900 font-semibold">Viewing Mode - Limited Access</AlertTitle>
            <AlertDescription className="text-orange-800">
              <p className="mb-2">
                You are currently in <strong>viewing mode</strong>. To access school fees and payment options, you need to submit an enrollment application first.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-600 text-orange-600 hover:bg-orange-100 mt-2"
                onClick={() => navigate('/enrollment/my-enrollments')}
              >
                <Receipt className="w-4 h-4 mr-2" />
                Submit Enrollment Now
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats Cards */}
        <div id="summary-stats-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground">Amount Due</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-primary">₱{totalAmount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1 sm:mt-2">{payments.filter(p => p.status === "Pending" || p.status === "Verified").length} charge(s) pending</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground">Amount Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">₱{paidAmount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1 sm:mt-2">{payments.filter(p => isApprovedPayment(p)).length} charge(s) paid</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground">Student Name</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {user?.first_name && user?.last_name 
                  ? `${user.first_name} ${user.last_name}` 
                  : user?.name || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-accent">{payments.length}</p>
              <p className="text-xs text-muted-foreground mt-2">All payment records</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Payment Details and Methods */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming & Overdue Installments Section */}
            {(() => {
              console.log('🔍 [Installment Schedule] Debug:', {
                installmentsKeys: Object.keys(installments),
                paymentPlansIds: paymentPlans.map(p => p.id),
                paymentPlansCount: paymentPlans.length
              });

              const allInstallments = Object.entries(installments).flatMap(([planId, planInstallments]) => 
                planInstallments.map(inst => {
                  const plan = paymentPlans.find(p => String(p.id) === String(planId));
                  if (!plan) {
                    console.warn(`⚠️ Plan not found for ID: ${planId}`, {
                      availablePlanIds: paymentPlans.map(p => p.id),
                      lookingFor: planId
                    });
                  }
                  return {
                    ...inst,
                    planId,
                    plan,
                    payment: payments.find(p => p.installment_id === inst.id),
                    penaltyInfo: inst.installment_number === 1
                      ? { hasPenalty: false, penaltyAmount: 0, totalDue: inst.balance || inst.amount_due, daysOverdue: 0, penaltyPercentage: 0 }
                      : calculateInstallmentPenalty({
                          due_date: inst.due_date,
                          balance: inst.balance || inst.amount_due,
                          status: inst.status,
                          amount_paid: inst.amount_paid
                        })
                  };
                })
              );

              const pendingInstallments = allInstallments
                .filter(inst => inst.status !== 'Paid' && inst.plan) // Only show installments with valid plan
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

              console.log('📋 [Installment Schedule] Pending installments:', {
                totalInstallments: allInstallments.length,
                pendingCount: pendingInstallments.length,
                withoutPlan: allInstallments.filter(i => !i.plan).length
              });

              if (pendingInstallments.length === 0) return null;

              return (
                <Card className="shadow-lg border-0">
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsInstallmentScheduleExpanded(!isInstallmentScheduleExpanded)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        <CardTitle className="text-xl">Installment Schedule</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm">
                        {isInstallmentScheduleExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </Button>
                    </div>
                    <CardDescription>Upcoming and overdue installment payments</CardDescription>
                  </CardHeader>
                  {isInstallmentScheduleExpanded && (
                    <CardContent>
                      <div className="space-y-3">
                        {pendingInstallments.slice(0, 2).map(inst => {
                          const isFirstInstallment = inst.installment_number === 1;
                          // Treat the first installment as "required" instead of marking it overdue
                          const isOverdue = !isFirstInstallment && new Date(inst.due_date) < new Date();
                          const daysUntilDue = Math.ceil((new Date(inst.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          
                          // Check if this installment is locked (must pay previous installments first)
                          const planInstallments = installments[inst.planId] || [];
                          const sortedPlanInstallments = [...planInstallments].sort((a, b) => a.installment_number - b.installment_number);
                          
                          // Find the next unpaid installment in this plan
                          const nextUnpaidIndex = sortedPlanInstallments.findIndex(i => {
                            const payment = payments.find(p => p.installment_id === i.id);
                            return !payment || (payment.status !== 'Approved' && payment.status !== 'Verified');
                          });
                          
                          const currentIndex = sortedPlanInstallments.findIndex(i => i.id === inst.id);
                          const isPaid = inst.payment && (inst.payment.status === 'Approved' || inst.payment.status === 'Verified');
                          const isNextUnpaid = currentIndex === nextUnpaidIndex;
                          const isLocked = !isPaid && !isNextUnpaid;
                          
                          return (
                            <div 
                              key={inst.id}
                              className={`p-4 border rounded-lg ${
                                isLocked
                                  ? 'border-gray-300 bg-gray-50 opacity-60'
                                  : isOverdue 
                                  ? 'border-red-200 bg-red-50/50' 
                                  : 'border-gray-200 bg-white'
                              }`}
                              title={isLocked ? 'Locked - Pay previous installments first' : ''}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className={`w-10 h-10 rounded-lg ${isLocked ? 'bg-gray-200' : 'bg-blue-100'} flex items-center justify-center flex-shrink-0`}>
                                    <span className={`text-sm font-bold ${isLocked ? 'text-gray-500' : 'text-blue-600'}`}>{inst.installment_number}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-foreground">Installment #{inst.installment_number}</span>
                                      {isLocked && (
                                        <Lock className="w-3 h-3 text-gray-400" />
                                      )}
                                      {!isLocked && isOverdue && (
                                        <Badge className="bg-red-100 text-red-800 text-xs border-0">
                                          OVERDUE
                                        </Badge>
                                      )}
                                      {!isLocked && !isOverdue && isFirstInstallment && !isPaid && (
                                        <Badge className="bg-blue-50 text-blue-800 text-xs border-0">
                                          REQUIRED
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        Due: {new Date(inst.due_date).toLocaleDateString()}
                                      </p>
                                      {isLocked && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                          <Lock className="w-3 h-3" />
                                          Pay previous installments first
                                        </p>
                                      )}
                                      {!isLocked && isOverdue && inst.penaltyInfo?.hasPenalty && (
                                        <div className="flex items-start gap-1 text-xs">
                                          <AlertCircle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />
                                          <span className="text-red-600">
                                            {inst.penaltyInfo.daysOverdue} days overdue
                                          </span>
                                        </div>
                                      )}
                                      {!isLocked && isOverdue && inst.penaltyInfo?.hasPenalty && (
                                        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                                          <span className="text-orange-800">
                                            Late fee (5%): <strong>₱{inst.penaltyInfo.penaltyAmount.toLocaleString()}</strong>
                                          </span>
                                          <div className="mt-1 pt-1 border-t border-orange-200">
                                            <span className="text-orange-900 font-semibold">
                                              Total due with penalty: ₱{inst.penaltyInfo.totalDue.toLocaleString()}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2 flex-shrink-0">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Balance</p>
                                    <p className="text-lg font-bold text-foreground">₱{Number(inst.balance || inst.amount_due).toLocaleString()}</p>
                                  </div>
                                  {!isLocked && isOverdue && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                      Overdue
                                    </Badge>
                                  )}
                                  {!isLocked && !isOverdue && isFirstInstallment && !isPaid && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      Required
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    disabled={isLocked}
                                    onClick={() => {
                                      if (isLocked) return;
                                      
                                      if (!inst.plan) {
                                        console.error('Payment plan not found for installment:', inst);
                                        toast.error('Payment plan information is missing. Please refresh the page.');
                                        return;
                                      }
                                      
                                      const penaltyInfo = calculateInstallmentPenalty({
                                        due_date: inst.due_date,
                                        balance: inst.balance || inst.amount_due,
                                        status: inst.status,
                                        amount_paid: inst.amount_paid
                                      });

                                      // Exclude first installment from overdue/waiver flow
                                      const effectiveHasPenalty = inst.installment_number === 1 ? false : penaltyInfo.hasPenalty;

                                      const enrollmentData = enrollment || {
                                        id: parseInt(inst.plan.enrollment_id || '0'),
                                        student_id: parseInt(inst.plan.student_id),
                                        academic_period_id: parseInt(inst.plan.academic_period_id),
                                        school_year: inst.plan.academic_period.split(' ')[0] || '',
                                        quarter: inst.plan.academic_period.split(' ').slice(1).join(' ') || '',
                                        grade_level: ''
                                      };

                                      const tuitionFeeData = {
                                        id: 0,
                                        amount: inst.plan.total_tuition,
                                        fee_name: 'Tuition Fee'
                                      };

                                      if (effectiveHasPenalty) {
                                        setPendingPaymentNavigation({
                                          enrollment: enrollmentData,
                                          tuitionFee: tuitionFeeData,
                                          installment: inst,
                                          paymentType: 'Installment Payment',
                                          amountPerInstallment: Number(inst.balance || inst.amount_due),
                                          paymentPlanId: inst.planId,
                                          penaltyAmount: penaltyInfo.penaltyAmount,
                                          daysOverdue: penaltyInfo.daysOverdue,
                                          installmentNumber: inst.installment_number,
                                          waiverSubmitted: false
                                        });
                                        setShowWaiverModal(true);
                                      } else {
                                        navigate('/enrollment/payment-process', {
                                          state: {
                                            enrollment: enrollmentData,
                                            tuitionFee: tuitionFeeData,
                                            installment: inst,
                                            paymentType: 'Installment Payment',
                                            amountPerInstallment: Number(inst.balance || inst.amount_due),
                                            paymentPlanId: inst.planId,
                                            penaltyAmount: 0,
                                            daysOverdue: 0,
                                            installmentNumber: inst.installment_number,
                                            waiverSubmitted: false
                                          }
                                        });
                                      }
                                    }}
                                    className={
                                      isLocked 
                                        ? "cursor-not-allowed" 
                                        : isOverdue 
                                        ? "bg-red-600 hover:bg-red-700" 
                                        : "bg-blue-600 hover:bg-blue-700"
                                    }
                                  >
                                    <Coins className="w-4 h-4 mr-1" />
                                    Pay Now
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {pendingInstallments.length > 2 && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => {
                              const firstPlan = paymentPlans[0];
                              if (firstPlan) {
                                setSelectedPlan(firstPlan);
                                setShowInstallmentModal(true);
                              }
                            }}
                          >
                            View All {pendingInstallments.length} Installments
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })()}

            {/* Payment Items Card */}
            <Card id="payment-details-section" className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl">Payment Details</CardTitle>
                <CardDescription>
                  Charges and Payment Status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filter */}
                <div id="search-filter-section" className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      placeholder="Search by description or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-muted/50 border-muted"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="sm:w-48 bg-muted/50 border-muted">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Verified">Verified</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Items List */}
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading payment data...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-8 text-red-600">
                      <AlertCircle className="w-8 h-8 mx-auto mb-4" />
                      <p>{error}</p>
                      <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        className="mt-4"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => {
                      const config = statusConfig[payment.status];
                      return (
                        <div
                          key={payment.id}
                          className="p-4 border border-border rounded-lg hover:bg-muted/50 transition flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-foreground truncate">
                                {payment.payment_for}
                              </h4>
                              <Badge className={`${config.bg} flex-shrink-0`}>
                                <span className={config.text}>{payment.status}</span>
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Receipt: {payment.receipt_number}
                              {payment.payment_date && (
                                <span className="ml-4">
                                  Date: {new Date(payment.payment_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                  })}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Type: {payment.payment_type} • Method: {payment.payment_method}
                              {Number(payment.total_discount) > 0 && (
                                <span className="ml-4 text-green-600">
                                  Discount: ₱{Number(payment.total_discount).toLocaleString()}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="font-bold text-foreground">
                              ₱{Number(payment.net_amount).toLocaleString()}
                            </p>
                            {Number(payment.total_discount) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                ₱{Number(payment.amount).toLocaleString()} original
                              </p>
                            )}


                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No payments found matching your filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* School Fees Card */}
            <Card id="school-fees-section" className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-lg">School Fees</CardTitle>
                <CardDescription>Available fees for payment</CardDescription>
              </CardHeader>
              <CardContent>
                {!hasTuitionPayment && availableSchoolFees.some(fee => fee.fee_type !== 'Tuition') && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-medium mb-1">Tuition Payment Required First</p>
                        <p>You must pay your tuition fee before you can pay other school fees (books, uniforms, etc.).</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {loadingFees ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-xs text-muted-foreground">Loading fees...</p>
                  </div>
                ) : availableSchoolFees.length > 0 ? (
                  <div className="space-y-2">
                    {availableSchoolFees.map((fee) => {
                      const isDisabled = !hasTuitionPayment && fee.fee_type !== 'Tuition';
                      
                      return (
                        <button
                          key={fee.id}
                          onClick={() => !isDisabled && handleSchoolFeeClick(fee)}
                          disabled={isDisabled}
                          className={`w-full p-3 border rounded-lg transition-all text-left group ${
                            isDisabled
                              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                              : 'border-border hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className={`text-sm font-semibold truncate transition-colors ${
                                  isDisabled ? 'text-gray-400' : 'text-foreground group-hover:text-blue-700'
                                }`}>
                                  {fee.fee_name}
                                </h4>
                                {fee.is_required && (
                                  <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0">
                                    Required
                                  </Badge>
                                )}
                                {isDisabled && (
                                  <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
                                    Tuition First
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-xs ${
                                isDisabled ? 'text-gray-400' : 'text-muted-foreground'
                              }`}>
                                Type: {fee.fee_type}
                                {fee.year_level && ` • ${fee.year_level}`}
                              </p>
                              {fee.due_date && (
                                <p className={`text-xs ${
                                  isDisabled ? 'text-gray-400' : 'text-muted-foreground'
                                }`}>
                                  Due: {new Date(fee.due_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                  })}
                                </p>
                              )}
                              {fee.description && (
                                <p className={`text-xs mt-1 ${
                                  isDisabled ? 'text-gray-400' : 'text-muted-foreground'
                                }`}>
                                  {fee.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-bold transition-colors ${
                                isDisabled ? 'text-gray-400' : 'text-foreground group-hover:text-blue-700'
                              }`}>
                                ₱{Number(fee.amount).toLocaleString()}
                              </p>
                              <p className={`text-xs transition-opacity ${
                                isDisabled 
                                  ? 'text-gray-400 opacity-100' 
                                  : 'text-blue-600 opacity-0 group-hover:opacity-100'
                              }`}>
                                {isDisabled ? 'Pay tuition first' : 'Click to pay'}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    {!enrollment && user?.role === 'student' ? (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                            <Lock className="w-6 h-6 text-orange-600" />
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-orange-900">No Enrollment Record Found</p>
                        <p className="text-xs text-muted-foreground px-4">
                          Submit your enrollment application to unlock school fees and payment options.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 border-orange-600 text-orange-600 hover:bg-orange-50"
                          onClick={() => navigate('/enrollment/my-enrollments')}
                        >
                          <Receipt className="w-4 h-4 mr-2" />
                          Submit Enrollment
                        </Button>
                      </div>
                    ) : user?.role === 'enrollee' && availableSchoolFees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Fees coming soon — fees will be unlocked once you become a student.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {allSchoolFees.length === 0 ? 'No school fees available' : 'All fees have been paid'}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Summary Card */}
            <Card id="payment-summary-section" className="shadow-lg border-0 sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Transactions</span>
                  <span className="font-semibold text-foreground">
                    ₱{payments.reduce((sum, p) => sum + Number(p.net_amount), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Paid</span>
                  <span className="font-semibold text-green-600">
                    -₱{paidAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Discounts</span>
                  <span className="font-semibold text-green-600">
                    -₱{payments.reduce((sum, p) => sum + Number(p.total_discount), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 bg-muted/30 p-3 rounded-lg">
                  <span className="font-bold text-foreground">Outstanding Balance</span>
                  <span className="font-bold text-lg text-primary">
                    ₱{totalAmount.toLocaleString()}
                  </span>
                </div>

                {totalAmount === 0 && payments.length > 0 && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-green-800">
                        All payments are up to date
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Important Notice */}
            <Card id="important-notice-section" className="shadow-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <AlertCircle className="w-4 h-4" />
                  Important Notice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
                  <li className="flex items-start gap-2">
                    <span className="font-bold flex-shrink-0">•</span>
                    <span>Payment must be made by the due date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold flex-shrink-0">•</span>
                    <span>Confirmation sent via email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold flex-shrink-0">•</span>
                    <span>All payments are non-refundable</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Payment Plan Selection Modal */}
        {/* Moved outside desktop section to render on both mobile & desktop */}
      </div>
      )}

      {/* Payment Plan Selection Modal - Available on Mobile & Desktop */}
      <Dialog open={showPaymentPlanModal} onOpenChange={setShowPaymentPlanModal}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[380px] max-h-[85vh] overflow-y-auto p-4 sm:max-w-md sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Select Tuition Payment Plan
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Choose how you would like to pay your tuition fee for this enrollment period.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 py-2 sm:py-3">
              {/* Enrollment Info */}
              {enrollment && (
                <div className="bg-muted/50 p-3 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{enrollment.school_year}</span>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Grade Level: <span className="font-medium text-foreground">{enrollment.grade_level}</span>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Student Name: <span className="font-medium text-foreground">{user?.first_name} {user?.last_name}</span>
                  </div>
                  {tuitionFee && (
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      Tuition Fee: <span className="font-bold text-base sm:text-lg text-blue-600">₱{Number(tuitionFee.amount).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Options */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">Select Payment Option:</h4>
                
                {/* Full Payment Option */}
                <button
                  onClick={() => {
                    if (!tuitionFee || !enrollment || !user) return;

                    const fullPaymentDiscount = discountTemplates.find(dt => dt.name === 'Full Payment Discount' && dt.is_active);
                    
                    // Navigate to payment process page with full payment details
                    navigate('/enrollment/payment-process', {
                      state: {
                        enrollment,
                        tuitionFee,
                        paymentType: 'Full Payment',
                        discount: fullPaymentDiscount ? {
                          id: fullPaymentDiscount.id,
                          name: fullPaymentDiscount.name,
                          value: fullPaymentDiscount.value,
                          value_type: fullPaymentDiscount.value_type
                        } : undefined
                      }
                    });
                  }}
                  className="w-full p-3 sm:p-4 border-2 border-border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center transition-colors flex-shrink-0">
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-sm sm:text-base text-foreground mb-1">Full Payment</h5>
                      <p className="text-xs text-muted-foreground">Pay the entire tuition fee in one transaction</p>
                      {tuitionFee && (
                        <div className="mt-2 space-y-1">
                          <p className="text-base sm:text-sm font-bold text-blue-600">₱{Number(tuitionFee.amount).toLocaleString()}</p>
                          {(() => {
                            const fullPaymentDiscount = discountTemplates.find(dt => dt.name === 'Full Payment Discount' && dt.is_active);
                            if (fullPaymentDiscount) {
                              const discountAmount = fullPaymentDiscount.value_type === 'Fixed Amount' 
                                ? fullPaymentDiscount.value 
                                : (tuitionFee.amount * fullPaymentDiscount.value / 100);
                              const discountedAmount = tuitionFee.amount - discountAmount;
                              return (
                                <div className="text-xs">
                                  <p className="text-green-600 font-medium">
                                    -₱{discountAmount.toLocaleString()} {fullPaymentDiscount.name}
                                  </p>
                                  <p className="text-base sm:text-sm font-bold text-green-700">
                                    Pay only: ₱{discountedAmount.toLocaleString()}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {/* Installment Option */}
                <button
                  onClick={() => {
                    if (!tuitionFee || !enrollment || !user) return;
                    
                    // Navigate to installment plans page
                    navigate('/enrollment/installment-plans', {
                      state: {
                        enrollment,
                        tuitionFee
                      }
                    });
                  }}
                  className="w-full p-3 sm:p-4 border-2 border-border rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-100 group-hover:bg-green-500 flex items-center justify-center transition-colors flex-shrink-0">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-sm sm:text-base text-foreground mb-1">Installment Plan</h5>
                      <p className="text-xs text-muted-foreground">Pay in multiple installments over time</p>
                      {tuitionFee && (
                        <p className="text-xs text-muted-foreground mt-2">Starting from ₱{(Number(tuitionFee.amount) / 4).toLocaleString()} per quarter</p>
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {/* Info Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    You must select a payment plan before you can proceed with other payments. This selection is required for your enrollment to be processed.
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* School Fee Payment Modal - Available on Mobile & Desktop */}
        <Dialog open={showSchoolFeeModal} onOpenChange={setShowSchoolFeeModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                Pay School Fee
              </DialogTitle>
              <DialogDescription className="text-sm">
                Confirm payment details for this school fee.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
             

              {/* School Fee Details */}
              {selectedSchoolFee && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-900">{selectedSchoolFee.fee_name}</span>
                  </div>
                  
                  <div className="text-sm text-blue-700">
                    Fee Type: <span className="font-medium text-blue-900">{selectedSchoolFee.fee_type}</span>
                  </div>
                  
                  <div className="text-sm text-blue-700">
                    Amount: <span className="font-bold text-lg text-blue-600">₱{Number(selectedSchoolFee.amount).toLocaleString()}</span>
                  </div>

                  {selectedSchoolFee.is_required && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-red-100 text-red-800 text-xs">
                        Required Fee
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSchoolFeeModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSchoolFeePayment}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Proceed to Payment
                </Button>
              </div>

              {/* Info Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    You will be redirected to the payment processing page where you can select your payment method and complete the transaction.
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Installment Plans Modal */}
      <Dialog open={showInstallmentModal} onOpenChange={setShowInstallmentModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Installment Plan Details
            </DialogTitle>
            <DialogDescription>
              View your payment schedule and progress
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-6 py-4">
              {/* Plan Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Academic Period</p>
                  <p className="font-semibold">{selectedPlan.academic_period}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Type</p>
                  <Badge variant="outline">{selectedPlan.schedule_type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-bold">₱{Number(selectedPlan.total_tuition).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={`${
                    selectedPlan.status === 'Active' ? 'bg-blue-100 text-blue-800' :
                    selectedPlan.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    selectedPlan.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedPlan.status}
                  </Badge>
                </div>
              </div>

              {/* Payment Progress Summary */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm mb-3 text-blue-900">Payment Progress</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Paid</span>
                    <span className="font-bold text-green-600">
                      ₱{Number(selectedPlan.total_paid).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Balance</span>
                    <span className="font-bold text-orange-600">
                      ₱{Number(selectedPlan.balance).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (Number(selectedPlan.total_paid) / Number(selectedPlan.total_tuition)) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{((Number(selectedPlan.total_paid) / Number(selectedPlan.total_tuition)) * 100).toFixed(1)}% Complete</span>
                    <span>{installments[selectedPlan.id]?.filter(i => i.status === 'Paid').length || 0} of {selectedPlan.number_of_installments} installments paid</span>
                  </div>
                </div>
              </div>

              {/* Installments Schedule */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Installment Schedule</h3>
                <div className="space-y-3">
                  {installments[selectedPlan.id]?.map((installment, index) => {
                    // Check if this installment should be disabled
                    const relatedPayment = payments.find(p => p.installment_id === installment.id);
                    const planPaymentsForThisInstallment = payments.filter(p => {
                      const installmentIds = (installments[selectedPlan.id] || []).map(i => i.id);
                      return installmentIds.includes(p.installment_id);
                    });
                    const hasUnapprovedPayment = planPaymentsForThisInstallment.some(
                      p => p.status !== 'Approved' && p.status !== 'Verified'
                    );
                    
                    // Find the next unpaid installment (first one without a paid/approved payment)
                    const allInstallments = installments[selectedPlan.id] || [];
                    const nextUnpaidIndex = allInstallments.findIndex(inst => {
                      const payment = payments.find(p => p.installment_id === inst.id);
                      return !payment || (payment.status !== 'Approved' && payment.status !== 'Verified');
                    });
                    
                    // Lock installments: only allow the next unpaid one to be clickable
                    const isNextUnpaid = index === nextUnpaidIndex;
                    const isPaid = relatedPayment && (relatedPayment.status === 'Approved' || relatedPayment.status === 'Verified');
                    const isLocked = !isPaid && !isNextUnpaid;
                    const isCardDisabled = isLocked || (!relatedPayment && hasUnapprovedPayment);
                    
                    const unapprovedPayment = planPaymentsForThisInstallment.find(
                      p => p.status !== 'Approved' && p.status !== 'Verified'
                    );
                    
                    // Calculate penalty for overdue installments (exclude first installment)
                    const penaltyInfo = installment.installment_number === 1
                      ? { hasPenalty: false, penaltyAmount: 0, totalDue: installment.balance || installment.amount_due, daysOverdue: 0, penaltyPercentage: 0 }
                      : calculateInstallmentPenalty({
                          due_date: installment.due_date,
                          balance: installment.balance || installment.amount_due,
                          status: installment.status,
                          amount_paid: installment.amount_paid
                        });

                    // Determine visual variant for installment card
                    const isFirstInstallment = installment.installment_number === 1;
                    const cardVariant = isCardDisabled
                      ? 'border-gray-300 bg-gray-50 opacity-60 cursor-not-allowed'
                      : penaltyInfo?.hasPenalty
                        ? 'border-red-200 bg-red-50 hover:bg-red-100'
                        : (isFirstInstallment && !isPaid)
                          ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                          : 'hover:bg-muted/50';

                    return (
                    <div
                      key={installment.id}
                      className={`flex items-center justify-between p-4 border rounded-lg transition-all ${cardVariant}`}
                      title={
                        isLocked ? 'Locked - Pay previous installments first' :
                        isCardDisabled && !isLocked ? `Cannot pay - Pending payment awaiting approval (Submitted: ${new Date(unapprovedPayment!.payment_date).toLocaleDateString()})` : ''
                      }
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                          <span className="text-xs text-muted-foreground">No.</span>
                          <span className="font-bold text-primary">{installment.installment_number}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">Installment #{installment.installment_number}</p>
                            {isLocked && (
                              <Lock className="h-3 w-3 text-gray-400" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            Due: {new Date(installment.due_date).toLocaleDateString()}
                            {(() => {
                              const relatedPayment = payments.find(p => p.installment_id === installment.id);
                              if (installment.paid_date) {
                                // Check if payment is verified or still pending
                                const label = relatedPayment?.status === 'Pending' ? 'Submitted' : 'Paid';
                                return (
                                  <span className={relatedPayment?.status === 'Pending' ? 'text-blue-600' : 'text-green-600'}>
                                    • {label}: {new Date(installment.paid_date).toLocaleDateString()}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </p>
                          {penaltyInfo?.hasPenalty && (
                            <div className="mt-1 p-2 bg-red-100 border border-red-200 rounded-md">
                              <p className="text-xs text-red-700 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {penaltyInfo.daysOverdue} day{penaltyInfo.daysOverdue !== 1 ? 's' : ''} overdue
                              </p>
                              <p className="text-xs text-red-600 mt-0.5">
                                Late fee ({penaltyInfo.penaltyPercentage}%): ₱{Number(penaltyInfo.penaltyAmount).toFixed(2)}
                              </p>
                              <p className="text-xs text-red-800 font-bold mt-0.5">
                                Total due with penalty: ₱{Number(penaltyInfo.totalDue).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">₱{Number(installment.amount_due).toLocaleString()}</p>
                        {installment.amount_paid > 0 && (
                          <p className="text-sm text-green-600">
                            Paid: ₱{Number(installment.amount_paid).toLocaleString()}
                          </p>
                        )}
                        {installment.balance > 0 && (
                          <p className="text-sm text-orange-600 font-medium">
                            Balance: ₱{Number(installment.balance).toLocaleString()}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {(() => {
                            // Determine payment status badge
                            const relatedPayment = payments.find(p => p.installment_id === installment.id);
                            
                            // Determine the status to display
                            let displayStatus = 'Pending';
                            let badgeClass = 'bg-yellow-100 text-yellow-800';
                            
                            if (relatedPayment) {
                              // Payment record exists
                              if (relatedPayment.status === 'Approved' || relatedPayment.status === 'Verified') {
                                // Payment verified/approved
                                displayStatus = 'Paid';
                                badgeClass = 'bg-green-100 text-green-800';
                              } else if (relatedPayment.status === 'Pending') {
                                // Payment submitted but not yet verified
                                displayStatus = 'Submitted';
                                badgeClass = 'bg-blue-100 text-blue-800';
                              }
                            } else {
                              // No payment record - treat first installment as 'Required' to encourage payment
                              const today = new Date();
                              const dueDate = new Date(installment.due_date);
                              if (installment.installment_number === 1) {
                                displayStatus = 'Required';
                                badgeClass = 'bg-blue-100 text-blue-800';
                              } else if (dueDate < today) {
                                displayStatus = 'Overdue';
                                badgeClass = 'bg-red-100 text-red-800';
                              } else {
                                displayStatus = 'Pending';
                                badgeClass = 'bg-yellow-100 text-yellow-800';
                              }
                            }
                            
                            return (
                              <Badge className={`text-xs ${badgeClass}`}>
                                {displayStatus}
                              </Badge>
                            );
                          })()}
                          <div className="flex gap-1 ml-auto">
                            {(() => {
                              // Determine if pay button should be shown
                              const relatedPayment = payments.find(p => p.installment_id === installment.id);
                              
                              // If this installment already has a payment, don't show pay button
                              if (relatedPayment) {
                                return null;
                              }
                              
                              // Don't show pay button if locked
                              if (isLocked) {
                                return null;
                              }
                              
                              return (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                                title="Pay Installment"
                                disabled={isCardDisabled}
                                onClick={() => {
                                  if (!enrollment) {
                                    toast.error('Enrollment information not available');
                                    return;
                                  }

                                  // Include penalty amount if overdue
                                  const totalAmountDue = penaltyInfo?.hasPenalty 
                                    ? Number(penaltyInfo.totalDue)
                                    : (installment.balance || installment.amount_due);

                                  const navigationState = {
                                    enrollment,
                                    tuitionFee: {
                                      id: selectedPlan.id,
                                      amount: installment.amount_due,
                                      fee_name: `Installment #${installment.installment_number} - ${selectedPlan.academic_period}`
                                    },
                                    paymentType: 'Installment Payment',
                                    amountPerInstallment: totalAmountDue,
                                    paymentPlanId: selectedPlan.id,
                                    installmentNumber: installment.installment_number,
                                    periodLabel: `Installment ${installment.installment_number}`,
                                    installment: {
                                      ...installment,
                                      penaltyInfo // Include penalty info
                                    },
                                    paymentPlan: selectedPlan,
                                    previousPayment: relatedPayment, // Pass previous payment for reference validation
                                    penaltyAmount: penaltyInfo?.hasPenalty ? Number(penaltyInfo.penaltyAmount) : 0,
                                    daysOverdue: penaltyInfo?.daysOverdue || 0,
                                    waiverSubmitted: false
                                  };

                                  // If there's a penalty, show waiver request modal first
                                  // Do not show for first installment
                                  if (penaltyInfo?.hasPenalty && installment.installment_number !== 1) {
                                    setPendingPaymentNavigation(navigationState);
                                    setShowInstallmentModal(false);
                                    setShowWaiverModal(true);
                                  } else {
                                    // No penalty - proceed directly to payment
                                    localStorage.setItem('pending_installment_payment', JSON.stringify(navigationState));
                                    navigate('/enrollment/payment-process', {
                                      state: navigationState
                                    });
                                    setShowInstallmentModal(false);
                                  }
                                }}
                              >
                                <Coins className="h-4 w-4" />
                              </Button>
                            );
                            })()}
                            {(() => {
                              // Show download invoice button if payment has been submitted or is verified/approved
                              const relatedPayment = payments.find(p => p.installment_id === installment.id);
                              return relatedPayment ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  // Find the payment record for this installment
                                  const paymentRecord = payments.find(p => p.installment_id === installment.id);
                                  if (paymentRecord) {
                                    handleDownloadInvoice(paymentRecord.id);
                                  }
                                }}
                                title="Download Invoice"
                              >
                                <Download className="h-4 w-4 text-blue-600" />
                              </Button>
                            ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  }) || (
                    <p className="text-center text-muted-foreground py-8">
                      No installments found for this plan
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowInstallmentModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Late Payment Explanation Modal (submission required when overdue - penalty is still charged) */}
      <WaiverRequestModal
        isOpen={showWaiverModal}
        onClose={() => {
          setShowWaiverModal(false);
          setPendingPaymentNavigation(null);
        }}
        onSubmitted={(explanationId: number) => {
          if (pendingPaymentNavigation) {
            const navWithWaiver = { ...pendingPaymentNavigation, waiverSubmitted: true, explanationId };
            localStorage.setItem('pending_installment_payment', JSON.stringify(navWithWaiver));
            navigate('/enrollment/payment-process', {
              state: navWithWaiver
            });
            setShowWaiverModal(false);
            setPendingPaymentNavigation(null);
          }
        }}
        installmentId={pendingPaymentNavigation?.installment?.id || 0}
        penaltyAmount={pendingPaymentNavigation?.penaltyAmount || 0}
        daysOverdue={pendingPaymentNavigation?.daysOverdue || 0}
        installmentNumber={pendingPaymentNavigation?.installmentNumber || 1}
      />

      {/* No Enrollment Warning Modal for Students */}
      <Dialog open={showNoEnrollmentModal} onOpenChange={setShowNoEnrollmentModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              Viewing Mode - Submit Enrollment Required
            </DialogTitle>
            <DialogDescription className="text-sm">
              You have limited access to the payment system
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Warning Message */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-900 mb-2">Limited Access Mode</h4>
                  <p className="text-sm text-orange-800 mb-3">
                    You are currently in <strong>viewing mode</strong>. To access the full payment features and pay school fees, you need to submit an enrollment application first.
                  </p>
                </div>
              </div>
            </div>

            {/* What you can do */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                What you can do now:
              </h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>View your payment history and transaction records</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Check your payment summaries and balances</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Download payment invoices and receipts</span>
                </li>
              </ul>
            </div>

            {/* What requires enrollment */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Locked until enrollment:
              </h4>
              <ul className="space-y-2 text-sm text-red-800">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">•</span>
                  <span>Access to school fees payment options</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">•</span>
                  <span>Tuition fee payment and installment plans</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">•</span>
                  <span>Payment of miscellaneous and other fees</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowNoEnrollmentModal(false)}
                className="flex-1"
              >
                Continue Viewing
              </Button>
              <Button
                onClick={() => {
                  setShowNoEnrollmentModal(false);
                  navigate('/enrollment/my-enrollments');
                }}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                <Receipt className="w-4 h-4 mr-2" />
                Submit Enrollment Now
              </Button>
            </div>

            {/* Info Notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">
                  Once your enrollment application is submitted and approved, you'll have full access to all payment features including tuition fees, installment plans, and school fees.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tour Component (desktop only; mobile Joyride is handled in PaymentMobileView) */}
      {!isMobile && (
        <Joyride
          steps={tourSteps}
          run={runTour}
          stepIndex={tourStepIndex}
          callback={handleTourCallback}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          disableOverlayClose={true}
          disableCloseOnEsc={false}
          spotlightClicks={true}
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
              marginRight: 10,
              marginLeft: 'auto',
            },
            buttonSkip: {
              color: '#6b7280',
              fontSize: 14,
            },
            buttonClose: {
              height: 14,
              width: 14,
              right: 15,
              top: 15,
            },
          }}
          locale={{
            back: 'Previous',
            close: 'Close',
            last: 'Finish',
            next: 'Next',
            open: 'Open the dialog',
            skip: 'Skip tour',
          }}
        />
      )}
      </div>
    </DashboardLayout>
  );
};

export default Payment;
