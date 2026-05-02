import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentPageLock } from "@/hooks/usePaymentPageLock";
import { PinVerificationModal } from "@/components/PinVerificationModal";
import { ArrowLeft, Building2, Smartphone, CheckCircle2, Receipt, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { API_ENDPOINTS, apiPost, apiGet } from "@/lib/api";
import gcashQR from "@/assets/images/Gcash-qr.jpg";
import demoGcash from "@/assets/images/Demo-Gcash.png";

interface PaymentProcessState {
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
  paymentType: "Full Payment" | "Installment Payment";
  discount?: {
    id?: number;
    name: string;
    value: number;
    value_type: string;
  };
  numberOfInstallments?: number;
  installmentPlan?: string;
  amountPerInstallment?: number;
  paymentPlanId?: number; // Payment plan ID for linking
  installmentNumber?: number; // Which installment (1, 2, 3, 4)
  periodLabel?: string; // Period label (1st Quarter, Month 1, etc)
  installment?: any; // From Payment.tsx modal - specific installment being paid
  paymentPlan?: any; // Full payment plan object
}

const PaymentProcess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  usePaymentPageLock(); // Protect this page - redirects to setup-pin if payment section not unlocked
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [proofOfPayment, setProofOfPayment] = useState<File | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);
  const [showPinVerificationModal, setShowPinVerificationModal] = useState(false);
  const [demoUploadFilename, setDemoUploadFilename] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<{ reference?: boolean; proof?: boolean }>({});
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [fetchingInstallment, setFetchingInstallment] = useState(false);

  // Tour state
  const [runDemoPaymentTour, setRunDemoPaymentTour] = useState(false);

  // Demo Tour steps
  const demoPaymentTourSteps: Step[] = [
    {
      target: '.payment-header',
      content: 'Welcome to the Payment Process Demo! This tour will guide you through the complete payment flow with sample data.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '.cash-payment-option',
      content: 'Cash payment is selected by default. This is the simplest option - just pay directly at the cashier\'s office.',
      placement: 'right',
    },
    {
      target: '.gcash-payment-option',
      content: 'Now let\'s explore GCash payment. Selecting this will show additional sections for reference number, QR code, and proof of payment upload.',
      placement: 'right',
    },
    {
      target: '.reference-number',
      content: 'If you select a digital payment method, enter the transaction or reference number here from your payment confirmation.',
      placement: 'top',
    },
    {
      target: '.gcash-qr-section',
      content: 'When GCash is selected, you\'ll see the QR code for payment. Click it to view in full size with zoom and pan controls.',
      placement: 'left',
    },
    {
      target: '.proof-upload',
      content: 'For digital payments, you must upload proof of payment (screenshot or receipt). This is required for verification.',
      placement: 'top',
    },
    {
      target: '.payment-summary',
      content: 'Review your payment summary with enrollment details, amounts, and discounts before submitting.',
      placement: 'left',
    },
    {
      target: '.submit-payment-btn',
      content: 'Once everything is complete, submit your payment. It will be reviewed by the admin before approval.',
      placement: 'top',
    },
  ];

  // Define state FIRST before using it in effects
  const state = location.state as PaymentProcessState;
  
  // Restore from localStorage if state is missing (e.g., on page reload)
  const [restoredState, setRestoredState] = useState<PaymentProcessState | null>(null);
  
  useEffect(() => {
    // If no state from navigation, try to restore from localStorage
    if (!state) {
      const savedPayment = localStorage.getItem('pending_installment_payment');
      if (savedPayment) {
        try {
          const parsed = JSON.parse(savedPayment);
          setRestoredState(parsed);
          console.log('Restored payment data from localStorage:', parsed);
        } catch (err) {
          console.error('Failed to restore payment data:', err);
          localStorage.removeItem('pending_installment_payment');
        }
      }
    }
  }, [state]);

  // Fetch installment data if this is an installment payment with a payment plan
  useEffect(() => {
    const currentState = state || restoredState;
    if (!currentState) return;

    const fetchInstallmentData = async () => {
      const isInstallmentPayment = currentState?.paymentType === 'Installment Payment';
      const paymentPlanId = (currentState as any)?.paymentPlanId;
      const installmentNumber = (currentState as any)?.installmentNumber || 1;

      // First, check if installment was already passed from InstallmentPlans
      if ((currentState as any)?.installment) {
        setSelectedInstallment((currentState as any).installment);
        return;
      }

      if (isInstallmentPayment && paymentPlanId) {
        try {
          setFetchingInstallment(true);
          
          // Fetch installments for this payment plan
          const response = await apiGet(API_ENDPOINTS.PAYMENT_PLAN_INSTALLMENTS(paymentPlanId.toString()));
          
          if (response.success && response.data) {
            const installments = response.data;
            
            // Find the specific installment to pay
            const installment = installments.find((inst: any) => inst.installment_number === installmentNumber);
            
            if (installment) {
              setSelectedInstallment(installment);
            }
          }
        } catch (err) {
          console.error('Error fetching installment data:', err);
        } finally {
          setFetchingInstallment(false);
        }
      }
    };

    fetchInstallmentData();
  }, [state, restoredState]);

  // Auto-start demo tour for first-time users
  useEffect(() => {
    const demoTourCompleted = localStorage.getItem('demo-payment-tour-completed');
    if (!demoTourCompleted) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setRunDemoPaymentTour(true);
      }, 1500); // Slightly longer delay than Payment.tsx
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleStartTourEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tourId?: string }>;
      if (customEvent.detail?.tourId !== 'payment-process') {
        return;
      }

      setRunDemoPaymentTour(true);
    };

    window.addEventListener('campuscompanion:start-tour', handleStartTourEvent as EventListener);
    return () => {
      window.removeEventListener('campuscompanion:start-tour', handleStartTourEvent as EventListener);
    };
  }, []);

  const handleDemoPaymentTourCallback = (data: CallBackProps) => {
    const { status, index } = data;
    
    // Smooth scroll to make target visible in center of viewport
    if (status === 'running' || status === 'waiting') {
      setTimeout(() => {
        const step = demoPaymentTourSteps[index];
        if (step && step.target && typeof step.target === 'string') {
          const element = document.querySelector(step.target);
          if (element) {
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
      setRunDemoPaymentTour(false);
      // Reset to cash for normal usage
      setPaymentMethod('Cash');
      localStorage.setItem('demo-payment-tour-completed', 'true'); // Mark as completed
    }
  };

  // Demo tour mock data setup
  useEffect(() => {
    if (runDemoPaymentTour) {
      // Set up mock data for demo
      setReferenceNumber('DEMO123456789');
      setRemarks('Demo payment submission for tour purposes');
      // Create a mock file for demo
      const mockFile = new File(['demo'], 'demo-proof.png', { type: 'image/png' });
      setProofOfPayment(mockFile);
      // generate a demo upload filename once
      const demoName = `gcash_upload${Math.floor(Math.random() * 900000 + 100000)}.png`;
      setDemoUploadFilename(demoName);
    } else {
      // Reset to empty when tour ends
      setReferenceNumber('');
      setRemarks('');
      setProofOfPayment(null);
      setPaymentMethod('Cash');
      setDemoUploadFilename('');
    }
  }, [runDemoPaymentTour]);

  useEffect(() => {
    const currentState = state || restoredState;

    // For installment payments, tuitionFee may not exist but installment/paymentPlan should
    const isInstallmentPayment = currentState?.paymentType === 'Installment Payment';
    const hasValidData = currentState && currentState.enrollment && (currentState.tuitionFee || (isInstallmentPayment && (currentState.installment || currentState.paymentPlan || currentState.paymentPlanId)));
    
    if (!hasValidData) {
      console.log('Validation failed - redirecting');
      console.log('isInstallmentPayment:', isInstallmentPayment);
      console.log('currentState?.installment:', currentState?.installment);
      console.log('currentState?.paymentPlan:', currentState?.paymentPlan);
      console.log('currentState?.paymentPlanId:', currentState?.paymentPlanId);
      toast.error("Invalid payment data. Redirecting...");
      localStorage.removeItem('pending_installment_payment'); // Clear invalid data
      navigate("/enrollment/payment");
    } else {
      console.log('Validation passed');

      // Enforce waiver submission for overdue installment payments
      const penaltyAmt = (currentState as any)?.penaltyAmount || 0;
      const waiverSubmitted = (currentState as any)?.waiverSubmitted;
      if (isInstallmentPayment && penaltyAmt > 0 && !waiverSubmitted) {
        toast.error('An explanation for late payment must be submitted before proceeding. The penalty will still be charged.');
        localStorage.removeItem('pending_installment_payment');
        navigate('/enrollment/payment');
      }
    }
  }, [state, restoredState, navigate, location.state]);

  // For installment payments, tuitionFee may not exist but installment/paymentPlan should
  const currentState = state || restoredState;
  const isInstallmentPayment = currentState?.paymentType === 'Installment Payment';
  const hasValidData = currentState && currentState.enrollment && (currentState.tuitionFee || (isInstallmentPayment && (currentState.installment || currentState.paymentPlan || currentState.paymentPlanId)));
  
  if (!hasValidData) {
    return null;
  }

  const { enrollment, tuitionFee, paymentType, discount, amountPerInstallment, paymentPlanId, installmentNumber = 1, periodLabel = "1st Installment", schoolFee, feeType, feeName, penaltyAmount = 0, daysOverdue = 0, explanationId } = currentState as PaymentProcessState & { amountPerInstallment?: number; paymentPlanId?: number; installmentNumber?: number; periodLabel?: string; schoolFee?: any; feeType?: string; feeName?: string; penaltyAmount?: number; daysOverdue?: number; explanationId?: number };

  
  // Determine if this is a school fee payment
  const isSchoolFeePayment = !!schoolFee;
  
  // For installments, don't apply discount; for full payment, apply if exists
  const discountAmount = paymentType === "Full Payment" && discount && tuitionFee
    ? discount.value_type === "Fixed Amount"
      ? discount.value
      : (tuitionFee.amount * discount.value) / 100
    : 0;
  
  const finalAmount = tuitionFee ? (tuitionFee.amount - discountAmount) : (amountPerInstallment || 0);
  const displayAmount = paymentType === "Installment Payment" && amountPerInstallment ? amountPerInstallment : finalAmount;
  
  // Add penalty to the total amount
  const totalWithPenalty = displayAmount + penaltyAmount;
  
  // For installment payments, the submission amount should be the per-installment amount + penalty
  const submissionAmount = paymentType === "Installment Payment" && amountPerInstallment ? (amountPerInstallment + penaltyAmount) : finalAmount;

  // Demo mock data (used only when demo tour is active)
  const demoData = {
    studentName: 'Juan Dela Cruz',
    email: 'juandelacruz@gmail.com',
    schoolYear: '2026-2027',
    gradeLevel: 'Grade 1',
    paymentTypeDisplay: 'Full Payment',
    tuitionAmount: 5000,
    discountName: 'Full Payment Discount',
    discountAmount: 500,
    finalAmount: 4500,
  };

  const displayStudentName = runDemoPaymentTour ? demoData.studentName : `${user?.first_name} ${user?.last_name}`;
  const displayEmail = runDemoPaymentTour ? demoData.email : user?.email;
  const displaySchoolYear = runDemoPaymentTour ? demoData.schoolYear : enrollment.school_year;
  const displayGradeLevel = runDemoPaymentTour ? demoData.gradeLevel : enrollment.grade_level;
  const displayPaymentType = runDemoPaymentTour ? demoData.paymentTypeDisplay : paymentType;
  // For installments, show the per-installment amount, not the total tuition
  const displayTuitionAmount = runDemoPaymentTour ? demoData.tuitionAmount : (paymentType === "Installment Payment" && amountPerInstallment ? amountPerInstallment : tuitionFee.amount);
  const displayDiscountAmount = runDemoPaymentTour ? demoData.discountAmount : discountAmount;
  const displayDiscountName = runDemoPaymentTour ? demoData.discountName : (discount ? discount.name : '');
  const displayFinalAmount = runDemoPaymentTour ? demoData.finalAmount : finalAmount;
  
  // For school fees, use the actual fee name instead of "Tuition Fee"
  const displayFeeName = isSchoolFeePayment ? (feeName || 'School Fee') : 'Tuition Fee';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofOfPayment(e.target.files[0]);
    }
  };

  const handleQRModalOpen = () => {
    setShowQRModal(true);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleQRModalClose = () => {
    setShowQRModal(false);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPanX(0);
      setPanY(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return; // Only allow dragging when zoomed in
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Limit panning to reasonable bounds
    const maxPan = 150;
    setPanX(Math.max(-maxPan, Math.min(maxPan, newX)));
    setPanY(Math.max(-maxPan, Math.min(maxPan, newY)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prevZoom) => Math.min(Math.max(prevZoom * delta, 1), 3));
  };

  // Touch gesture handlers
  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return { x: 0, y: 0 };
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < e.touches.length; i++) {
      sumX += e.touches[i].clientX;
      sumY += e.touches[i].clientY;
    }
    return { x: sumX / e.touches.length, y: sumY / e.touches.length };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom start
      e.preventDefault();
      setTouchDistance(getTouchDistance(e));
    } else if (e.touches.length === 1) {
      // Check for double tap
      const now = Date.now();
      const timeDiff = now - lastTap;
      
      if (timeDiff < 300 && tapCount > 0) {
        // Double tap detected
        e.preventDefault();
        if (zoom === 1) {
          setZoom(2);
        } else {
          setZoom(1);
          setPanX(0);
          setPanY(0);
        }
        setTapCount(0);
        setLastTap(0);
      } else {
        // Single touch drag start
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - panX, y: touch.clientY - panY });
        setLastTap(now);
        setTapCount((prev) => prev + 1);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // Pinch zoom
      const currentDistance = getTouchDistance(e);
      if (touchDistance > 0) {
        const zoomDelta = currentDistance / touchDistance;
        setZoom((prevZoom) => Math.min(Math.max(prevZoom * zoomDelta, 1), 3));
        setTouchDistance(currentDistance);
      }
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // Single touch drag
      const touch = e.touches[0];
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;
      
      const maxPan = 150;
      setPanX(Math.max(-maxPan, Math.min(maxPan, newX)));
      setPanY(Math.max(-maxPan, Math.min(maxPan, newY)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setTouchDistance(0);
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  const handleSubmitPayment = () => {
    const errors: { reference?: boolean; proof?: boolean } = {};
    
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    if (paymentMethod !== "Cash") {
      toast.error("GCash and other online methods are temporarily unavailable. Please use Cash payment.");
      setPaymentMethod("Cash");
      return;
    }

    if (paymentMethod !== "Cash" && !referenceNumber.trim()) {
      errors.reference = true;
      toast.error(`Reference number is required for ${paymentMethod} payments`);
      if (referenceInputRef.current) {
        referenceInputRef.current.focus();
        referenceInputRef.current.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => {
          referenceInputRef.current?.classList.remove('ring-2', 'ring-red-500');
        }, 3000);
      }
    }

    if (paymentMethod !== "Cash" && !proofOfPayment) {
      errors.proof = true;
      toast.error("Proof of payment is required for non-cash payments");
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // For all payment methods, show PIN verification before submitting
    setShowPinVerificationModal(true);
  };

  const handlePinVerified = () => {
    // After PIN is verified
    setShowPinVerificationModal(false);
    
    // If cash payment, show cash confirmation modal next
    if (paymentMethod === "Cash") {
      setShowCashConfirmModal(true);
      return;
    }
    
    // For other payment methods, proceed directly with submission
    proceedWithPaymentSubmission();
  };

  const proceedWithPaymentSubmission = async () => {
    setValidationErrors({});

    // Validate multiple payment rules for installments
    if (paymentType === "Installment Payment") {
      const previousPayment = (state as any)?.previousPayment;
      
      if (previousPayment) {
        // There's a previous payment for this installment
        if (previousPayment.payment_method === 'Cash') {
          // Cannot make another payment if previous was Cash
          toast.error("Cannot make another payment for this installment. A previous Cash payment already exists.");
          setLoading(false);
          return;
        } else if (previousPayment.payment_method === 'GCash') {
          // For GCash, allow only if reference number is different
          const currentReferenceNumber = referenceNumber?.trim();
          const previousReferenceNumber = previousPayment.reference_number?.trim();
          
          if (!currentReferenceNumber) {
            toast.error("Reference number is required for GCash payments when there's a previous GCash payment.");
            setLoading(false);
            return;
          }
          
          if (currentReferenceNumber === previousReferenceNumber) {
            toast.error("Reference number must be different from the previous payment. This appears to be a duplicate.");
            setLoading(false);
            return;
          }
        }
      }
    }

    setLoading(true);
    try {
      // If file is provided, use FormData for multipart submission
      if (proofOfPayment) {
        const formData = new FormData();
        
        // Add payment fields
        formData.append('student_id', user?.id?.toString() || '');
        formData.append('enrollment_id', enrollment.id.toString());
        formData.append('academic_period_id', enrollment.academic_period_id.toString());
        
        if (isSchoolFeePayment) {
          formData.append('payment_type', feeType || 'Other');
          formData.append('payment_for', feeName || 'School Fee');
        } else {
          formData.append('payment_type', paymentType === "Full Payment" ? "Tuition Full Payment" : "Tuition Installment");
          formData.append('payment_for', paymentType === "Installment Payment" ? `Installment #${installmentNumber} - SY ${enrollment.school_year}` : `${enrollment.school_year} Tuition Fee (${paymentType})`);
        }
        
        // For full payments, send original amount + discount. For installments, send per-installment amount only (no discount)
        const formDataAmount = isSchoolFeePayment ? tuitionFee.amount : (paymentType === "Full Payment" ? tuitionFee.amount : submissionAmount);
        formData.append('amount', formDataAmount.toString());
        formData.append('total_discount', isSchoolFeePayment ? '0' : discountAmount.toString());
        formData.append('payment_method', paymentMethod);
        formData.append('payment_date', new Date().toISOString().split('T')[0]);
        formData.append('reference_number', referenceNumber || '');
        formData.append('status', 'Pending');
        formData.append('remarks', isSchoolFeePayment ? remarks : (discount && paymentType === "Full Payment" ? `Applied ${discount.name}${remarks ? '. ' + remarks : ''}` : remarks));
        formData.append('is_refund', '0');
        
        // Link to installment if this is an installment payment
        if (paymentType === "Installment Payment" && selectedInstallment?.id) {
          formData.append('installment_id', selectedInstallment.id.toString());
        }
        
        // Add penalty information if applicable
        if (penaltyAmount > 0) {
          formData.append('penalty_amount', penaltyAmount.toString());
          formData.append('days_overdue', daysOverdue.toString());
          if (explanationId) {
            formData.append('explanation_id', explanationId.toString());
          }
        }
        
        // Add proof of payment file
        formData.append('proof_of_payment', proofOfPayment);



        // Use fetch for multipart/form-data (FormData)
        const response = await fetch(
          `${window.location.origin}/api/payments`,
          {
            method: 'POST',
            body: formData,
            credentials: 'include'
          }
        );

        const res = await response.json();

        if (res.success) {
          // If full payment with discount, also create enrollment discount record
          if (paymentType === "Full Payment" && discount && discountAmount > 0) {
            try {
              const discountData = {
                enrollment_id: enrollment.id,
                discount_template_id: discount.id || 0,
                discount_name: discount.name,
                discount_type: discount.value_type,
                discount_value: discount.value,
                discount_amount: discountAmount,
                payment_id: res.data?.id,
                notes: `Applied at payment submission`
              };
              
              // Create enrollment discount record
              const discountResponse = await fetch(
                `${window.location.origin}/api/enrollments/${enrollment.id}/discounts`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(discountData),
                  credentials: 'include'
                }
              );
              
              if (!discountResponse.ok) {
                console.warn('Failed to create enrollment discount record, but payment was created successfully');
              } else {
                console.log('Enrollment discount record created successfully');
              }
            } catch (discountError) {
              console.warn('Error creating enrollment discount:', discountError);
              // Don't fail the payment if discount record creation fails
            }
          }

          // Success message with audit trail confirmation
          toast.success(
            "Payment submitted successfully! ✓ Proof of payment recorded ✓ Admin notified ✓ Audit log created",
            { duration: 5000 }
          );
          
          // Log payment submission for frontend tracking
          console.log('Payment submitted:', {
            paymentId: res.data?.id,
            studentId: user?.id,
            amount: submissionAmount,
            type: paymentType,
            method: paymentMethod,
            timestamp: new Date().toISOString(),
            auditTrail: 'Backend automatically created audit log and notified admins'
          });
          
          // Clear localStorage after successful submission
          localStorage.removeItem('pending_installment_payment');
          
          navigate("/enrollment/payment");
        } else {
          toast.error(res.message || "Failed to submit payment");
        }
      } else {
        // No file, use JSON request
        // For full payments, send original amount + discount. For installments, send per-installment amount only (no discount)
        const jsonDataAmount = isSchoolFeePayment ? tuitionFee.amount : (paymentType === "Full Payment" ? tuitionFee.amount : submissionAmount);
        const paymentData = {
          student_id: user?.id,
          enrollment_id: enrollment.id,
          academic_period_id: enrollment.academic_period_id,
          payment_type: isSchoolFeePayment ? (feeType || 'Other') : (paymentType === "Full Payment" ? "Tuition Full Payment" : "Tuition Installment"),
          payment_for: isSchoolFeePayment ? (feeName || 'School Fee') : (paymentType === "Installment Payment" ? `Installment #${installmentNumber} - SY ${enrollment.school_year}` : `${enrollment.school_year} Tuition Fee (${paymentType})`),
          amount: jsonDataAmount,
          total_discount: isSchoolFeePayment ? 0 : discountAmount,
          payment_method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0],
          reference_number: referenceNumber || null,
          status: "Pending",
          remarks: isSchoolFeePayment ? remarks : (discount && paymentType === "Full Payment" ? `Applied ${discount.name}${remarks ? '. ' + remarks : ''}` : remarks),
          is_refund: 0,
          ...(paymentType === "Installment Payment" && selectedInstallment?.id && { installment_id: selectedInstallment.id }), // Include installment ID for installment payments
          ...(penaltyAmount > 0 && { penalty_amount: penaltyAmount, days_overdue: daysOverdue, ...(explanationId && { explanation_id: explanationId }) }) // Include penalty information if applicable
        };



        const res = await apiPost(API_ENDPOINTS.PAYMENTS, paymentData);

        if (res.success) {
          // If full payment with discount, also create enrollment discount record
          if (paymentType === "Full Payment" && discount && discountAmount > 0) {
            try {
              const discountData = {
                enrollment_id: enrollment.id,
                discount_template_id: discount.id || 0,
                discount_name: discount.name,
                discount_type: discount.value_type,
                discount_value: discount.value,
                discount_amount: discountAmount,
                payment_id: res.data?.id,
                notes: `Applied at payment submission`
              };
              
              // Create enrollment discount record
              await apiPost(API_ENDPOINTS.ENROLLMENT_DISCOUNTS(enrollment.id), discountData);
            } catch (discountError) {
              console.warn('Error creating enrollment discount:', discountError);
              // Don't fail the payment if discount record creation fails
            }
          }

          // Success message with audit trail confirmation
          toast.success(
            "Payment submitted successfully! ✓ Admin notified ✓ Audit log created",
            { duration: 5000 }
          );
          
          // Log payment submission for frontend tracking
          console.log('Payment submitted:', {
            paymentId: res.data?.id,
            studentId: user?.id,
            amount: submissionAmount,
            type: paymentType,
            method: paymentMethod,
            timestamp: new Date().toISOString(),
            auditTrail: 'Backend automatically created audit log and notified admins'
          });
          
          // Clear localStorage after successful submission
          localStorage.removeItem('pending_installment_payment');
          
          navigate("/enrollment/payment");
        } else {
          toast.error(res.message || "Failed to submit payment");
        }
      }
    } catch (error) {
      console.error("Error submitting payment:", error);
      toast.error("Failed to submit payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="enrollment-readable p-3 sm:p-8 max-w-4xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/enrollment/payment")}
          className="mb-4 sm:mb-6 h-9 px-2 sm:px-3 text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Payments
        </Button>

        {/* Header */}
        <div className="mb-5 sm:mb-8 payment-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center shadow-md sm:shadow-lg flex-shrink-0">
                <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-1 sm:mb-2 leading-tight">
                  Payment Process
                </h1>
                <p className="text-xs sm:text-base text-muted-foreground">Complete your tuition payment</p>
              </div>
            </div>
            {/* Tour trigger moved to floating TourHelpButton component */}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Payment Summary - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method Selection */}
            <Card className="shadow-md sm:shadow-lg border-0 payment-method-selection">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-xl">Select Payment Method</CardTitle>
                <CardDescription className="text-sm sm:text-base">Choose how you want to pay</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="space-y-3">
                    {/* Cash */}
                    <div className="flex items-center space-x-3 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition cursor-pointer cash-payment-option">
                      <RadioGroupItem value="Cash" id="cash" />
                      <Label htmlFor="cash" className="flex-1 cursor-pointer flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-lg sm:text-xl">💵</span>
                        </div>
                        <div>
                          <p className="font-semibold !text-[13px] sm:!text-sm">Cash Payment</p>
                          <p className="!text-[11px] sm:!text-xs text-muted-foreground">Pay at the cashier's office</p>
                        </div>
                      </Label>
                    </div>

                    {/* GCash */}
                    <div className="flex items-center space-x-3 p-3 sm:p-4 border rounded-lg bg-gray-50 opacity-60 cursor-not-allowed gcash-payment-option">
                      <RadioGroupItem value="GCash" id="gcash" disabled />
                      <Label htmlFor="gcash" className="flex-1 cursor-pointer flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold !text-[13px] sm:!text-sm text-gray-500">GCash</p>
                          <p className="!text-[11px] sm:!text-xs text-gray-400">Temporarily unavailable (school account pending)</p>
                        </div>
                      </Label>
                    </div>

                    {/* Bank Transfer */}
                    <div className="flex items-center space-x-3 p-3 sm:p-4 border rounded-lg bg-gray-50 opacity-60 cursor-not-allowed">
                      <RadioGroupItem value="Bank Transfer" id="bank" disabled />
                      <Label htmlFor="bank" className="flex-1 flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold !text-[13px] sm:!text-sm text-gray-500">Bank Transfer</p>
                          <p className="!text-[11px] sm:!text-xs text-gray-400">Temporarily unavailable</p>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>

                {/* Reference Number (for non-cash payments) */}
                {paymentMethod !== "Cash" && (
                  <div className="space-y-2 pt-3 sm:pt-4 border-t reference-number">
                    <Label htmlFor="reference" className={validationErrors.reference ? "text-red-600 font-semibold" : ""}>
                      Reference/Transaction Number *
                    </Label>
                    <Input
                      ref={referenceInputRef}
                      id="reference"
                      placeholder="Enter transaction or reference number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      onFocus={() => referenceInputRef.current?.classList.remove('ring-2', 'ring-red-500')}
                      className="transition-all"
                      required
                    />
                    {validationErrors.reference && (
                      <p className="text-xs text-red-600 font-medium">This field is required for {paymentMethod} payments</p>
                    )}
                  </div>
                )}

                {/* GCash QR Code */}
                {paymentMethod === "GCash" && (
                  <div className="space-y-3 pt-3 sm:pt-4 border-t bg-blue-50 p-3 sm:p-4 rounded-lg gcash-qr-section">
                    <Label className="text-xs sm:text-base font-semibold text-blue-900">GCash QR Code</Label>
                    <div className="flex justify-center">
                      <div className="bg-white p-3 sm:p-4 rounded-lg border-2 border-gray-300 shadow-md sm:shadow-lg">
                        <img
                          src={runDemoPaymentTour ? demoGcash : gcashQR}
                          alt="GCash QR Code"
                          className="w-44 h-44 sm:w-56 sm:h-56 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleQRModalOpen()}
                          onError={(e) => {
                            console.error('Failed to load GCash QR code');
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] sm:text-sm text-blue-900 text-center font-medium">
                      Click to view full size • Scan with your GCash app to pay
                    </p>
                    
                    {/* Receiver Details */}
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Receiver Name</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-800">JO*N CH********R KI*G Z.</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Mobile Number</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-800">+63 994 909 8150</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks (Optional)</Label>
                  <Textarea
                    id="remarks"
                    placeholder="Add any additional notes or comments"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                {/* Proof of Payment Upload */}
                {paymentMethod !== "Cash" && (
                  <div className="space-y-2 proof-upload">
                    <Label htmlFor="proof" className={validationErrors.proof ? "text-red-600 font-semibold" : ""}>
                      Proof of Payment *
                      {proofOfPayment && <span className="text-green-600 ml-2">✓ Uploaded</span>}
                    </Label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <label
                        htmlFor="proof"
                        className="inline-flex w-full sm:w-auto justify-center items-center px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm cursor-pointer hover:bg-gray-50"
                      >
                        Choose File
                      </label>
                      <span className="text-xs sm:text-sm text-muted-foreground break-all">
                        {proofOfPayment ? proofOfPayment.name : (runDemoPaymentTour ? demoUploadFilename : 'No file chosen')}
                      </span>
                      <Input
                        id="proof"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </div>
                    <p className={`text-xs ${validationErrors.proof ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      {validationErrors.proof ? "Proof of payment is required for non-cash payments (JPG, PNG, PDF)" : "Upload screenshot or receipt of your payment (JPG, PNG, PDF) - Required"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary - Right Side */}
          <div className="space-y-6">
            <Card className="shadow-md sm:shadow-lg border-0 lg:sticky lg:top-4 payment-summary">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-lg">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                {/* Student Info */}
                <div className="pb-4 border-b">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Student</p>
                  <p className="text-sm sm:text-base font-semibold">{displayStudentName}</p>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>

                {/* Enrollment Info */}
                <div className="pb-4 border-b">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">Enrollment Details</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">School Year:</span>
                      <span className="font-medium">{displaySchoolYear}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Grade Level:</span>
                      <span className="font-medium">{displayGradeLevel}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Details - Only show for tuition payments */}
                {!isSchoolFeePayment && (
                  <div className="pb-4 border-b">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">Payment Type</p>
                    <p className="text-sm sm:text-base font-semibold text-blue-600">{displayPaymentType}</p>
                  </div>
                )}

                {/* Amount Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">{displayPaymentType === "Installment Payment" ? "Original Amount:" : `${displayFeeName}:`}</span>
                    <span className="font-medium">₱{displayTuitionAmount.toLocaleString()}</span>
                  </div>

                  {displayDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-green-600">{displayDiscountName}:</span>
                      <span className="text-green-600 font-medium">-₱{displayDiscountAmount.toLocaleString()}</span>
                    </div>
                  )}

                  {penaltyAmount > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-orange-600">Charge Fee (Late Payment):</span>
                      <span className="text-orange-600 font-medium">+₱{penaltyAmount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="flex justify-between">
                      <span className="text-sm sm:text-base font-semibold">Total Amount:</span>
                      <span className="text-base sm:text-xl font-bold text-blue-600">₱{(runDemoPaymentTour ? displayFinalAmount : totalWithPenalty).toLocaleString()}</span>
                    </div>
                    {!runDemoPaymentTour && paymentType === "Installment Payment" && state.numberOfInstallments && (
                      <div className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        <span>Payment plan for {state.numberOfInstallments} installment(s)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmitPayment}
                  disabled={loading || !paymentMethod}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 submit-payment-btn h-10 sm:h-11"
                  size="default"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit Payment
                    </>
                  )}
                </Button>

                {/* Penalty Notice */}
                {penaltyAmount > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="text-[11px] sm:text-xs text-orange-800">
                        <p className="font-semibold">Late Payment Penalty Applied</p>
                        <p className="mt-1 leading-relaxed">This installment is {daysOverdue} day(s) overdue. A 5% late fee of ₱{penaltyAmount.toLocaleString()} has been added to your payment.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] sm:text-xs text-blue-800">
                      <p className="font-semibold mb-1">Payment Verification Process</p>
                      <ul className="space-y-0.5 ml-3">
                        <li>• Your payment will be verified by the admin</li>
                        <li>• Admin will be notified immediately upon submission</li>
                        <li>• An audit log will be created for tracking</li>
                        <li>• You'll receive a notification once approved</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* QR Code Full Screen Modal */}
        <Dialog open={showQRModal} onOpenChange={handleQRModalClose}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] p-4 sm:p-6 flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base">GCash QR Code - Double click to zoom, Drag to move</DialogTitle>
            </DialogHeader>
            <div 
              className="flex-1 flex items-center justify-center overflow-hidden bg-gray-100 rounded-lg touch-none"
              style={{ userSelect: 'none', cursor: zoom > 1 ? 'grab' : 'pointer' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={gcashQR}
                alt="GCash QR Code - Full Size"
                className="object-contain select-none"
                draggable={false}
                onDoubleClick={handleDoubleClick}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              />
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t flex-wrap">
              <span>Current Zoom: {(zoom * 100).toFixed(0)}%</span>
              <span>•</span>
              <span className="hidden sm:inline">Double-click to zoom</span>
              <span className="sm:hidden">Double-tap to zoom</span>
              <span>•</span>
              <span className="hidden sm:inline">Scroll to zoom in/out</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Drag to move</span>
              <span className="sm:hidden">Pinch to zoom</span>
              <span className="sm:hidden">•</span>
              <span className="sm:hidden">Hold & drag</span>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cash Payment Confirmation Modal */}
        <Dialog open={showCashConfirmModal} onOpenChange={setShowCashConfirmModal}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Confirm Cash Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 mb-2">Are you sure to continue this payment?</p>
                  <p className="text-sm text-amber-800">
                    You have selected <strong>Cash Payment</strong> at the counter. You will need to pay directly at the cashier's office.
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>Online payment notice:</strong>
                </p>
                <ul className="text-sm text-blue-800 space-y-1 ml-4">
                  <li>• GCash is temporarily unavailable</li>
                  <li>• School admin account setup is still in progress</li>
                  <li>• Please proceed with cash payment for now</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                Continue with cash payment while online payment options are temporarily disabled.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCashConfirmModal(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowCashConfirmModal(false);
                  proceedWithPaymentSubmission();
                }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Continue with Cash
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* PIN Verification Modal - Required before any payment submission */}
        <PinVerificationModal
          isOpen={showPinVerificationModal}
          onClose={() => setShowPinVerificationModal(false)}
          onVerified={handlePinVerified}
          paymentAmount={totalWithPenalty}
          paymentDescription={`${displayPaymentType} - ${displaySchoolYear}`}
        />
      </div>

      {/* Demo Payment Process Tour - Rendered as Portal for Full Coverage */}
      {createPortal(
        <Joyride
          steps={demoPaymentTourSteps}
          run={runDemoPaymentTour}
          callback={handleDemoPaymentTourCallback}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          disableScrolling={true}
          scrollToFirstStep={false}
          styles={{
            options: {
              primaryColor: '#2563eb',
              textColor: '#1f2937',
              backgroundColor: '#ffffff',
              overlayColor: 'rgba(0, 0, 0, 0.6)',
              spotlightShadow: '0 0 20px rgba(0, 0, 0, 0.7)',
              arrowColor: '#ffffff',
              zIndex: 10000,
            },
            tooltip: {
              borderRadius: 8,
              fontSize: 14,
              maxWidth: 280,
              padding: 16,
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
          }}
          floaterProps={{
            disableAnimation: false,
          }}
          spotlightPadding={8}
          locale={{
            back: 'Previous',
            close: 'Close',
            last: 'Finish',
            next: 'Next',
            open: 'Open the dialog',
            skip: 'Skip tour',
          }}
        />,
        document.body
      )}
    </DashboardLayout>
  );
};

export default PaymentProcess;
