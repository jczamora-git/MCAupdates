import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentPageLock } from "@/hooks/usePaymentPageLock";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, AlertCircle, PhilippinePeso, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";

interface InstallmentPlanState {
  enrollment: {
    id: number;
    student_id: number;
    academic_period_id: number;
    school_year: string;
    quarter: string;
    grade_level: string;
  };
  tuitionFee: {
    id: number;
    amount: number;
    fee_name: string;
  };
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

interface ScheduleInstallment {
  id: number;
  template_id: number;
  installment_number: number;
  month: string | null;
  week_of_month: string;
  label: string;
}

interface ScheduleTemplate {
  id: number;
  name: string;
  description: string;
  schedule_type: "Monthly" | "Quarterly" | "Semestral" | "Tri Semestral";
  number_of_installments: number;
  is_default: number;
  is_active: number;
  status: string;
  created_at: string;
  updated_at: string;
  installments: ScheduleInstallment[];
}

const InstallmentPlans = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  usePaymentPageLock(); // Protect this page - redirects to setup-pin if payment section not unlocked
  const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [discountTemplates, setDiscountTemplates] = useState<DiscountTemplate[]>([]);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingPlanData, setPendingPlanData] = useState<any>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  // Demo tour state
  const [runDemoInstallmentTour, setRunDemoInstallmentTour] = useState(false);
  const [currentTourIndex, setCurrentTourIndex] = useState(0);

  // Mock data for demo tour
  const demoData = {
    studentName: 'Juan Dela Cruz',
    email: 'juandelacruz@gmail.com',
    schoolYear: '2026-2027',
    gradeLevel: 'Grade 1',
  };

  const displayStudentName = runDemoInstallmentTour ? demoData.studentName : `${user?.first_name} ${user?.last_name}`;
  const displayEmail = runDemoInstallmentTour ? demoData.email : user?.email;

  const demoInstallmentTourSteps: Step[] = [
    {
      target: '.installment-header',
      content: 'Welcome to the Installment Plan demo. This tour will guide you through setting up a payment plan.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '.enrollment-info',
      content: 'Here\'s your enrollment information for the current school year and grade level.',
      placement: 'bottom',
    },
    {
      target: '.monthly-plan',
      content: 'Monthly Plan: Pay in 10 monthly installments over the school year.',
      placement: 'right',
    },
    {
      target: '.quarterly-plan',
      content: 'Quarterly Plan (Recommended): Pay in 4 quarterly installments. Most popular option.',
      placement: 'right',
    },
    {
      target: '.semestral-plan',
      content: 'Semestral Plan: Pay in 2 semestral installments (every semester).',
      placement: 'right',
    },
    {
      target: '.trisemestral-plan',
      content: 'Tri Semestral Plan: Pay in 3 installments spread across the school year.',
      placement: 'right',
    },
    {
      target: '.payment-summary',
      content: 'The Payment Summary shows your enrollment details and calculated payment amounts.',
      placement: 'left',
    },
    {
      target: '.proceed-to-pay-btn',
      content: 'Click "Proceed to Pay First Installment" to review and confirm your payment plan.',
      placement: 'top',
    },
    {
      target: 'body',
      content: 'When you click Proceed, a confirmation modal will appear showing: Plan Type, Number of Installments, Total Tuition, Per Installment amount, and the complete Installment Schedule with all due dates and amounts for each payment.',
      placement: 'center',
      disableBeacon: true,
    },
  ];

  const handleDemoInstallmentTourCallback = (data: CallBackProps) => {
    const { status, index, action } = data;

    console.log('=== Tour Callback ===', { 
      index, 
      action, 
      status,
      timestamp: new Date().toLocaleTimeString()
    });

    // Track current tour step
    setCurrentTourIndex(index);

    // Smooth scroll to center the target element in viewport
    if (status === 'running' || status === 'waiting') {
      setTimeout(() => {
        const step = demoInstallmentTourSteps[index];
        if (step && typeof step.target === 'string') {
          const element = document.querySelector(step.target);
          if (element) {
            console.log('Scrolling to target:', step.target);
            const elementRect = element.getBoundingClientRect();
            const elementTop = window.scrollY + elementRect.top;
            const viewportHeight = window.innerHeight;
            const scrollTarget = elementTop - (viewportHeight / 2) + (elementRect.height / 2);
            
            window.scrollTo({
              top: Math.max(0, scrollTarget),
              behavior: 'smooth'
            });
          }
        }
      }, 100);
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      console.log('Tour finished/skipped. Cleaning up...');
      setRunDemoInstallmentTour(false);
      setCurrentTourIndex(0);
      setShowConfirmationModal(false);
      localStorage.setItem('demoInstallmentTourCompleted', 'true');
    }
  };

  const state = location.state as InstallmentPlanState;

  useEffect(() => {
    if (!state || !state.enrollment || !state.tuitionFee) {
      toast.error("Invalid installment plan data. Redirecting...");
      navigate("/enrollment/payment");
    }
  }, [state, navigate]);

  // Fetch schedule templates
  useEffect(() => {
    const fetchScheduleTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const data = await apiGet(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATES);
        if (data.success && data.data) {
          const activeTemplates = data.data.filter((t: ScheduleTemplate) => t.is_active === 1);
          setScheduleTemplates(activeTemplates);
          
          // Auto-select Quarterly template as default if available
          const defaultTemplate = activeTemplates.find((t: ScheduleTemplate) => t.schedule_type === "Quarterly") || activeTemplates[0];
          if (defaultTemplate) {
            setSelectedTemplate(defaultTemplate);
          }
        }
      } catch (err) {
        console.error('Error fetching schedule templates:', err);
        toast.error("Failed to load payment schedules");
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchScheduleTemplates();
  }, []);

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

    fetchDiscountTemplates();
  }, []);

  // Removed - now using schedule templates instead of hardcoded types
  useEffect(() => {
    const demoTourCompleted = localStorage.getItem('demoInstallmentTourCompleted');
    if (!demoTourCompleted) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setRunDemoInstallmentTour(true);
      }, 2000); // Slightly longer delay than PaymentProcess
      return () => clearTimeout(timer);
    }
  }, []);
  useEffect(() => {
    console.log('Tour state changed:', {
      runDemoInstallmentTour,
      showConfirmationModal,
    });
  }, [runDemoInstallmentTour, showConfirmationModal]);

  useEffect(() => {
    const handleStartTourEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tourId?: string }>;
      if (customEvent.detail?.tourId !== 'installment-plans') {
        return;
      }

      setCurrentTourIndex(0);
      setRunDemoInstallmentTour(true);
    };

    window.addEventListener('campuscompanion:start-tour', handleStartTourEvent as EventListener);
    return () => {
      window.removeEventListener('campuscompanion:start-tour', handleStartTourEvent as EventListener);
    };
  }, []);

  if (!state || !state.enrollment || !state.tuitionFee) {
    return null;
  }

  const { enrollment, tuitionFee } = state;

  // Display variables for demo tour
  const displaySchoolYear = runDemoInstallmentTour ? demoData.schoolYear : enrollment.school_year;
  const displayGradeLevel = runDemoInstallmentTour ? demoData.gradeLevel : enrollment.grade_level;

  const handleTemplateChange = (template: ScheduleTemplate) => {
    setSelectedTemplate(template);
  };

  const calculateInstallmentAmounts = (template: ScheduleTemplate, totalAmount: number): number[] => {
    const installmentsCount = template.number_of_installments;
    const safeTotal = Math.max(0, Number(totalAmount) || 0);
    const roundTo2 = (value: number) => Math.round(value * 100) / 100;

    if (installmentsCount <= 0) return [];

    const isMonthlyOrQuarterly = template.schedule_type === "Monthly" || template.schedule_type === "Quarterly";

    if (isMonthlyOrQuarterly) {
      const firstPayment = Math.min(5000, safeTotal);
      if (installmentsCount === 1) return [roundTo2(firstPayment)];

      const remainingTotal = safeTotal - firstPayment;
      const remainingInstallments = installmentsCount - 1;
      const amountPerRemaining = remainingInstallments > 0 ? roundTo2(remainingTotal / remainingInstallments) : 0;

      const amounts: number[] = [roundTo2(firstPayment)];
      for (let i = 0; i < remainingInstallments; i++) {
        if (i === remainingInstallments - 1) {
          const allocatedBeforeLast = amountPerRemaining * (remainingInstallments - 1);
          amounts.push(roundTo2(remainingTotal - allocatedBeforeLast));
        } else {
          amounts.push(amountPerRemaining);
        }
      }

      return amounts;
    }

    const evenAmount = roundTo2(safeTotal / installmentsCount);
    const amounts: number[] = [];
    for (let i = 0; i < installmentsCount; i++) {
      if (i === installmentsCount - 1) {
        amounts.push(roundTo2(safeTotal - evenAmount * (installmentsCount - 1)));
      } else {
        amounts.push(evenAmount);
      }
    }
    return amounts;
  };

  const selectedInstallmentAmounts = selectedTemplate
    ? calculateInstallmentAmounts(selectedTemplate, Number(tuitionFee.amount))
    : [];

  const perInstallmentAmount = selectedInstallmentAmounts[0] || 0;

  // Calculate actual due dates from schedule template
  const calculateDueDatesFromTemplate = (template: ScheduleTemplate) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    return template.installments.map((inst) => {
      // If "Upon Enrollment", use current date
      if (inst.week_of_month === "Upon Enrollment") {
        return new Date().toISOString().split('T')[0];
      }
      
      // Parse month from template
      const month = parseInt(inst.month || "1") - 1; // Month is 0-indexed
      
      // Determine year - if month is before current month, it's next year
      let year = currentYear;
      if (month < currentMonth) {
        year = currentYear + 1;
      }
      
      // Get the day based on week of month
      let day = 1;
      if (inst.week_of_month.includes("1st")) day = 7;
      else if (inst.week_of_month.includes("2nd")) day = 14;
      else if (inst.week_of_month.includes("3rd")) day = 21;
      else if (inst.week_of_month.includes("4th") || inst.week_of_month.includes("Last")) day = 28;
      
      const dueDate = new Date(year, month, day);
      return dueDate.toISOString().split('T')[0];
    });
  };

  // Removed - now using labels from database schedule templates

  const handleProceedToPayment = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a payment schedule");
      return;
    }

    try {
      // Calculate actual due dates from template
      const dueDates = calculateDueDatesFromTemplate(selectedTemplate);

      // Create payment plan data using template's installment schedule
      const paymentPlanData = {
        student_id: user?.id,
        enrollment_id: enrollment.id,
        academic_period_id: enrollment.academic_period_id,
        total_tuition: Number(tuitionFee.amount),
        schedule_type: selectedTemplate.schedule_type,
        template_id: selectedTemplate.id,
        number_of_installments: selectedTemplate.number_of_installments,
        start_date: new Date().toISOString().split('T')[0],
        installments: selectedTemplate.installments.map((inst, index) => ({
          installment_number: inst.installment_number,
          amount_due: selectedInstallmentAmounts[index] || 0,
          due_date: dueDates[index],
          status: "Pending",
          period_label:
            (selectedTemplate.schedule_type === "Monthly" || selectedTemplate.schedule_type === "Quarterly") && index === 0
              ? "Upon Enrollment Payment"
              : inst.label,
          is_upon_enrollment:
            ((selectedTemplate.schedule_type === "Monthly" || selectedTemplate.schedule_type === "Quarterly") && index === 0) ||
            inst.week_of_month === "Upon Enrollment"
        }))
      };

      // Store the pending data and show confirmation modal
      setPendingPlanData(paymentPlanData);
      setShowConfirmationModal(true);
    } catch (error) {
      console.error("Error preparing payment plan:", error);
      toast.error("Failed to prepare payment plan. Please try again.");
    }
  };

  const handleConfirmPaymentPlan = async () => {
    if (!pendingPlanData) return;

    setIsCreatingPlan(true);
    try {
      // Scroll to top on mobile to show payment form clearly
      window.scrollTo(0, 0);

      const res = await apiPost(API_ENDPOINTS.PAYMENT_PLANS, pendingPlanData);

      if (res.success) {
        toast.success("Payment plan created successfully");
        setShowConfirmationModal(false);
        
        // Use plan_id from backend response (not id)
        const paymentPlanId = res.data?.plan_id;
        
        // Fetch the installments for this newly created plan
        let firstInstallment = null;
        try {
          const installmentsRes = await apiGet(API_ENDPOINTS.PAYMENT_PLAN_INSTALLMENTS(paymentPlanId.toString()));
          
          if (installmentsRes.success && installmentsRes.data && installmentsRes.data.length > 0) {
            // Get the first installment to pay
            firstInstallment = installmentsRes.data.find((inst: any) => inst.installment_number === 1);
          }
        } catch (err) {
          console.error('Error fetching installments:', err);
          // Continue even if fetch fails - PaymentProcess will try to fetch again
        }
        
        // Navigate to payment process with plan details and the first installment
        navigate('/enrollment/payment-process', {
          state: {
            enrollment,
            tuitionFee,
            paymentType: 'Installment Payment',
            installmentPlan: selectedTemplate?.schedule_type,
            numberOfInstallments: selectedTemplate?.number_of_installments,
            amountPerInstallment: selectedInstallmentAmounts[0] || 0,
            paymentPlanId: paymentPlanId,
            installmentNumber: 1,
            periodLabel:
              (selectedTemplate?.schedule_type === "Monthly" || selectedTemplate?.schedule_type === "Quarterly")
                ? "Upon Enrollment Payment"
                : (selectedTemplate?.installments[0]?.label || "First Installment"),
            paymentPlan: res.data,
            installment: firstInstallment // Pass the first installment data
          }
        });
      } else {
        toast.error(res.message || "Failed to create payment plan");
      }
    } catch (error) {
      console.error("Error creating payment plan:", error);
      toast.error("Failed to create payment plan. Please try again.");
    } finally {
      setIsCreatingPlan(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="enrollment-readable p-3 sm:p-8 max-w-4xl mx-auto font-sans antialiased">
        {/* Back Button */}
          <div className="mb-4 sm:mb-8 installment-header">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/enrollment/payment')}
            className="mb-3 sm:mb-4 h-9 px-2 sm:px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Payment
          </Button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-center shadow-md sm:shadow-lg flex-shrink-0">
                <Calendar className="h-6 sm:h-8 w-6 sm:w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent mb-1 sm:mb-2 leading-tight">
                  Installment Payment Plan
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">Flexible payment options for your tuition</p>
              </div>
            </div>
            <Badge variant="default" className="hidden sm:inline-flex w-fit bg-gradient-to-r from-green-600 to-green-700 text-white text-xs sm:text-sm px-2.5 py-0.5">
              Installment
            </Badge>
          </div>
        </div>

        {/* Enrollment Info */}
        <Card className="hidden sm:block shadow-md sm:shadow-lg border-0 mb-4 sm:mb-6 enrollment-info">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Enrollment Information</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">School Year</p>
                <p className="text-sm sm:text-base font-semibold text-foreground">{displaySchoolYear}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Grade Level</p>
                <p className="text-sm sm:text-base font-semibold text-foreground">{displayGradeLevel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Student Name</p>
                <p className="text-sm sm:text-base font-semibold text-foreground">{displayStudentName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Email</p>
                <p className="text-sm sm:text-base font-semibold text-foreground break-all">{displayEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Left Column - Plan Selection */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Plan Selection Card */}
            <Card className="shadow-md sm:shadow-lg border-0">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Select Payment Schedule</CardTitle>
                <CardDescription>Choose how you would like to distribute your tuition payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 sm:space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
                {/* Payment Schedule Selection */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground">Payment Frequency:</h4>
                  
                  {loadingTemplates ? (
                    <div className="text-center py-6 sm:py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="text-sm text-muted-foreground mt-2">Loading payment schedules...</p>
                    </div>
                  ) : scheduleTemplates.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 border-2 border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground">No payment schedules available</p>
                      <p className="text-xs text-muted-foreground mt-1">Please contact the admin</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {scheduleTemplates.map((template) => {
                        const isSelected = selectedTemplate?.id === template.id;
                        const installmentAmounts = calculateInstallmentAmounts(template, Number(tuitionFee.amount));
                        const firstAmount = installmentAmounts[0] || 0;
                        const followingAmount = installmentAmounts.length > 1 ? installmentAmounts[1] : firstAmount;
                        const isMonthlyOrQuarterly = template.schedule_type === "Monthly" || template.schedule_type === "Quarterly";
                        
                        return (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateChange(template)}
                            className={`p-3 border-2 rounded-lg transition-all text-left ${
                              isSelected
                                ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                                : "border-border hover:border-green-300"
                            } ${template.schedule_type.toLowerCase()}-plan`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-semibold text-foreground mb-1 !text-[15px] sm:!text-lg leading-tight">
                                  {template.name}
                                  {template.schedule_type === "Quarterly" && " (Recommended)"}
                                </h5>
                                <p className="!text-[12px] sm:!text-sm text-muted-foreground mb-1 leading-relaxed">
                                  {template.description}
                                </p>
                                <p className="!text-[12px] sm:!text-sm text-muted-foreground">
                                  {template.number_of_installments} installments
                                </p>
                                {isMonthlyOrQuarterly ? (
                                  <div className="mt-2 space-y-1">
                                    <p className="!text-[13px] sm:!text-base font-bold text-green-600">
                                      Upon Enrollment: ₱{firstAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="!text-[12px] sm:!text-sm text-muted-foreground">
                                      Following installments: ₱{followingAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="!text-[13px] sm:!text-base font-bold text-green-600 mt-2">
                                    ₱{firstAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} per installment
                                  </p>
                                )}
                              </div>
                              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                                isSelected
                                  ? "border-green-500 bg-green-500"
                                  : "border-muted-foreground"
                              }`}>
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full" />
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Important Notice */}
                <div className="border-t pt-4 sm:pt-6">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <h5 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Payment Information</h5>
                        <ul className="text-[11px] sm:text-xs text-blue-800 dark:text-blue-200 space-y-1">
                          <li>• Each installment payment must be submitted on schedule</li>
                          <li>• Proof of payment is required for each transaction</li>
                          <li>• Late payments may affect your enrollment status</li>
                          <li>• Contact the admin office for special arrangements</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payment Summary */}
          <div className="space-y-4 sm:space-y-6">
            {/* Plan Summary Card */}
            <Card className="shadow-md sm:shadow-lg border-0 lg:sticky lg:top-8 payment-summary">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">
                {/* Student Section */}
                <div className="space-y-1 pb-4 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student</p>
                  <p className="text-sm font-semibold text-foreground">{displayStudentName}</p>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>

                {/* Enrollment Details */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Enrollment Details</p>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">School Year:</span>
                    <span className="text-sm font-medium text-foreground">{displaySchoolYear}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Grade Level:</span>
                    <span className="text-sm font-medium text-foreground">{displayGradeLevel}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Type */}
                <div className="space-y-1 pb-4 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Type</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {selectedTemplate?.name || "No plan selected"}
                    {selectedTemplate && ` (${selectedTemplate.number_of_installments} installments)`}
                  </p>
                </div>

                {/* Tuition Information */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Tuition Fee:</span>
                    <span className="text-sm font-medium text-foreground">₱{Number(tuitionFee.amount).toLocaleString()}</span>
                  </div>
                  {(selectedTemplate?.schedule_type === "Monthly" || selectedTemplate?.schedule_type === "Quarterly") ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground font-semibold">Upon Enrollment Payment:</span>
                        <span className="text-lg font-bold text-blue-600">₱{(selectedInstallmentAmounts[0] || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Following Installment(s):</span>
                        <span className="text-sm font-medium text-foreground">₱{(selectedInstallmentAmounts[1] || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground font-semibold">Per Installment:</span>
                      <span className="text-lg font-bold text-blue-600">₱{(selectedInstallmentAmounts[0] || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Total for {selectedTemplate?.number_of_installments || 0} installment(s):
                    </span>
                    <span className="text-sm font-medium text-foreground">₱{Number(tuitionFee.amount).toLocaleString()}</span>
                  </div>
                </div>

                {/* Proceed Button */}
                <Button
                  onClick={handleProceedToPayment}
                  disabled={isCreatingPlan || !selectedTemplate || loadingTemplates}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 sm:h-11 px-4 text-sm rounded-lg proceed-to-pay-btn"
                >
                  {isCreatingPlan ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Plan...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 mr-2" />
                      Proceed to Pay First Installment
                    </>
                  )}
                </Button>

                {/* Info Box */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900 dark:text-blue-100">Your payment will be verified by the admin. You will receive a notification once approved.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md max-h-[88vh] overflow-y-auto p-4 sm:p-6 confirm-payment-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Confirm Payment Plan
            </DialogTitle>
            <DialogDescription>
              Please review your payment plan details before proceeding
            </DialogDescription>
          </DialogHeader>

          {pendingPlanData && (
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Plan Summary */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 sm:p-4 rounded-lg space-y-3 border border-blue-200 dark:border-blue-800">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Plan Type:</span>
                    <span className="font-semibold text-foreground">{selectedTemplate?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Number of Installments:</span>
                    <span className="font-semibold text-foreground">{selectedTemplate?.number_of_installments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Total Tuition:</span>
                    <span className="font-semibold text-foreground">₱{Number(tuitionFee.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-700">
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {(selectedTemplate?.schedule_type === "Monthly" || selectedTemplate?.schedule_type === "Quarterly")
                        ? "Upon Enrollment Payment:"
                        : "Per Installment:"}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-blue-600">₱{(selectedInstallmentAmounts[0] || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Installment Schedule */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Installment Schedule:</h4>
                <div className="max-h-48 overflow-y-auto space-y-2 installment-schedule">
                  {pendingPlanData.installments.slice(0, 4).map((inst: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-xs sm:text-sm p-2 bg-muted/30 rounded">
                      <div className="flex-1">
                        <span className="text-muted-foreground font-medium block">
                          #{inst.installment_number} - {inst.period_label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Due: {inst.is_upon_enrollment ? "Upon Enrollment" : new Date(inst.due_date).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="font-medium">₱{Number(inst.amount_due).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  {pendingPlanData.installments.length > 4 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      ... and {pendingPlanData.installments.length - 4} more installments
                    </div>
                  )}
                </div>
              </div>

              {/* Warning */}
              {/* Overdue charge info */}
              <div className="bg-muted/10 dark:bg-muted/800 p-3 rounded-lg border border-muted/20 dark:border-muted/700">
                <p className="text-xs text-muted-foreground">
                  <strong>Overdue Charge:</strong> A 5% overdue charge of the installment amount will be applied for late payments. Please ensure timely payment to avoid additional fees.
                </p>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  ⚠️ Once confirmed, you will be directed to pay the first installment. This plan cannot be modified after creation.
                </p>
              </div>
            </div>
          )}

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowConfirmationModal(false)}
              disabled={isCreatingPlan}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPaymentPlan}
              disabled={isCreatingPlan}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 confirm-payment-btn"
            >
              {isCreatingPlan ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm & Proceed
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Demo Installment Plan Tour - Render as portal for full coverage */}
      {createPortal(
        <Joyride
          steps={demoInstallmentTourSteps}
          run={runDemoInstallmentTour}
          callback={handleDemoInstallmentTourCallback}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          disableScrolling={true}
          scrollToFirstStep={false}
          styles={{
            options: {
              primaryColor: '#16a34a',
              textColor: '#1f2937',
              backgroundColor: '#ffffff',
              overlayColor: 'rgba(0, 0, 0, 0.6)',
              spotlightShadow: '0 0 20px rgba(0, 0, 0, 0.7)',
              zIndex: 999999,
            },
            tooltip: { 
              borderRadius: 8, 
              fontSize: 14, 
              maxWidth: 300,
              zIndex: 999999,
            },
            buttonNext: { backgroundColor: '#16a34a' },
            buttonSkip: { color: '#6b7280' },
          }}
          spotlightPadding={8}
        />,
        document.body
      )}

    </DashboardLayout>
  );
};

export default InstallmentPlans;
