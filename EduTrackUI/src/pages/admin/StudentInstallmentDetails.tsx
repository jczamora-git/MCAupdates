import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  ArrowLeft,
  Coins,
  Edit,
  CheckCircle,
  User,
  FileText,
  AlertCircle,
  XCircle,
  QrCode,
  Loader2,
  Tag,
  ShieldOff
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost, apiPut } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";
import DiscountDialog from "@/components/admin/payments/DiscountDialog";
import { calculateInstallmentPenalty, type PenaltyInfo } from "@/utils/penaltyCalculator";

type PaymentPlan = {
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
};

type Installment = {
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
};

type InstallmentWithPenalty = Installment & {
  penaltyInfo: PenaltyInfo;
};

export default function StudentInstallmentDetails() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const { user } = useAuth();
  const confirmFn = useConfirm();

  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [installments, setInstallments] = useState<InstallmentWithPenalty[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isEditingInstallments, setIsEditingInstallments] = useState(false);
  const [editedInstallments, setEditedInstallments] = useState<InstallmentWithPenalty[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentWithPenalty | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "Cash",
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: "",
    remarks: ""
  });

  // GCash QR uploader state
  const [gcashToken, setGcashToken] = useState<string | null>(null);
  const [gcashSessionLoading, setGcashSessionLoading] = useState(false);
  const [gcashProofReceived, setGcashProofReceived] = useState(false);

  // Discount dialog state
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [selectedInstallmentForDiscount, setSelectedInstallmentForDiscount] = useState<InstallmentWithPenalty | null>(null);

  // Penalty records (read-only - penalties are ALWAYS charged per school policy)
  const [penaltyRecords, setPenaltyRecords] = useState<any[]>([]);

  // Installment discounts (stored in localStorage before payment)
  const [installmentDiscounts, setInstallmentDiscounts] = useState<{ [installmentId: string]: { amount: number, templates: any[] } }>({});

  const PAYMENT_METHODS = ["Cash", "Check", "Bank Transfer", "GCash", "PayMaya", "Others"];

  // ---- GCash QR Session helpers ----
  const handleOpenGcashQr = async () => {
    if (!selectedInstallment || !plan) return;
    setGcashSessionLoading(true);
    setGcashProofReceived(false);
    try {
      const res = await apiPost(API_ENDPOINTS.GCASH_SESSIONS, {
        installment_id: selectedInstallment.id,
        plan_id: plan.id,
        user_id: plan.student_id,
        installment_number: selectedInstallment.installment_number,
        amount_due: selectedInstallment.balance
      });
      if (res.success && res.token) {
        setGcashToken(res.token);
        // Open the GCash session page in a new tab
        window.open(`${import.meta.env.BASE_URL}admin/gcash-session/${res.token}`, '_blank');
      } else {
        setError(res.message || 'Failed to create GCash session');
      }
    } catch {
      setError('Failed to create GCash session');
    } finally {
      setGcashSessionLoading(false);
    }
  };

  // Listen for proof upload result broadcast from the GCash session tab
  useEffect(() => {
    if (!gcashToken) return;
    const handler = (e: StorageEvent) => {
      if (e.key === `gcash_proof_${gcashToken}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.ocr_reference) {
            setPaymentForm(prev => ({ ...prev, reference_number: data.ocr_reference }));
          }
          setGcashProofReceived(true);
        } catch {}
        localStorage.removeItem(`gcash_proof_${gcashToken}`);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [gcashToken]);

  const generateReceiptNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RCP-${year}${month}-${random}`;
  };

  const checkReferenceNumberExists = async (referenceNumber: string): Promise<boolean> => {
    try {
      const response = await apiGet(`/api/payments/check-reference?reference=${encodeURIComponent(referenceNumber)}`);
      return response?.exists || false;
    } catch (error) {
      console.error('Error checking reference number:', error);
      return false;
    }
  };

  const generateInvoiceNumber = async (): Promise<string> => {
    const maxAttempts = 5;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      
      const invoiceNumber = `MCAFINV-${year}${month}${day}${hours}${minutes}${seconds}${random}`;
      
      const exists = await checkReferenceNumberExists(invoiceNumber);
      
      if (!exists) {
        return invoiceNumber;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const timestamp = Date.now();
    return `MCAFINV-${timestamp}`;
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/unauthorized");
      return;
    }
    if (planId) {
      fetchData();
      // Load installment discounts from localStorage
      const storedDiscounts = localStorage.getItem(`installment_discounts_${planId}`);
      if (storedDiscounts) {
        try {
          setInstallmentDiscounts(JSON.parse(storedDiscounts));
        } catch (e) {
          console.error("Failed to parse stored discounts:", e);
        }
      }
    }
  }, [user, planId]);

  // Fetch penalties when installments are loaded
  useEffect(() => {
    if (installments.length > 0) {
      fetchPenalties();
    }
  }, [installments.length]);

  const fetchPenalties = async () => {
    try {
      const penalties: any[] = [];
      for (const inst of installments) {
        const res = await apiGet(API_ENDPOINTS.PAYMENT_PENALTY_BY_INSTALLMENT(inst.id));
        if (res.success && res.data) {
          penalties.push(...res.data);
        }
      }
      setPenaltyRecords(penalties);
    } catch (err) {
      console.error("Failed to fetch penalties:", err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [planRes, installmentsRes, paymentsRes] = await Promise.all([
        apiGet(`${API_ENDPOINTS.PAYMENT_PLANS}/${planId}`),
        apiGet(`${API_ENDPOINTS.PAYMENT_PLANS}/${planId}/installments`),
        apiGet(API_ENDPOINTS.PAYMENTS)
      ]);

      if (planRes.success) {
        setPlan(planRes.data);
      }
      if (installmentsRes.success) {
        const installmentData = installmentsRes.data || [];
        // Calculate penalties for each installment (exclude first installment from overdue logic)
        const installmentsWithPenalties = installmentData.map((inst: Installment) => ({
          ...inst,
          penaltyInfo: inst.installment_number === 1 
            ? { hasPenalty: false, penaltyAmount: 0, totalDue: inst.balance, daysOverdue: 0, penaltyPercentage: 0 }
            : calculateInstallmentPenalty({
                due_date: inst.due_date,
                balance: inst.balance,
                status: inst.status,
                amount_paid: inst.amount_paid
              })
        }));
        setInstallments(installmentsWithPenalties);
        setEditedInstallments(installmentsWithPenalties);
      }
      if (paymentsRes.success) {
        setPayments(paymentsRes.data || []);
      }
    } catch (err) {
      setError("Failed to load payment plan details");
    } finally {
      setLoading(false);
    }
  };

  const handleEditInstallments = () => {
    setIsEditingInstallments(true);
    setEditedInstallments([...installments]);
  };

  const handleCancelEdit = () => {
    setIsEditingInstallments(false);
    setEditedInstallments([...installments]);
  };

  const handleSaveInstallments = async () => {
    const confirmed = await confirmFn({
      title: "Confirm Installment Changes",
      description: "Are you sure you want to save these changes? This will update the due dates and amounts for all installments.",
      confirmText: "Save Changes",
      cancelText: "Cancel"
    });

    if (!confirmed) return;

    try {
      const updates = editedInstallments.map(inst => 
        apiPut(`${API_ENDPOINTS.PAYMENT_PLANS}/installments/${inst.id}`, {
          due_date: inst.due_date,
          amount_due: inst.amount_due
        })
      );
      
      await Promise.all(updates);
      
      setSuccess("Installments updated successfully");
      setIsEditingInstallments(false);
      setInstallments([...editedInstallments]);
    } catch (err) {
      setError("Failed to update installments");
    }
  };

  const handleInstallmentChange = (index: number, field: string, value: any) => {
    const updated = [...editedInstallments];
    updated[index] = { ...updated[index], [field]: value };
    setEditedInstallments(updated);
  };

  const handlePayInstallment = async (installment: InstallmentWithPenalty) => {
    setSelectedInstallment(installment);
    // const invoiceNumber = await generateInvoiceNumber(); // Temporarily disabled: manual OR/invoice entry for Cash
    
    // Calculate the amount to pay considering discount
    const discount = installmentDiscounts[installment.id];
    const baseAmount = Number(installment.balance);
    const discountedAmount = discount ? baseAmount - Number(discount.amount) : baseAmount;
    
    // Default amount includes penalty if overdue
    const defaultAmount = installment.penaltyInfo?.hasPenalty 
      ? discountedAmount + Number(installment.penaltyInfo.penaltyAmount)
      : discountedAmount;
      
    setPaymentForm({
      amount: defaultAmount.toFixed(2),
      payment_method: "Cash",
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: "",
      remarks: ""
    });
    setIsPaymentOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedInstallment || !plan) {
      setError("Missing installment or plan information");
      return;
    }

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    const paymentAmount = parseFloat(paymentForm.amount);
    const installmentBalance = Number(selectedInstallment.balance);
    
    // Calculate max allowed considering discount
    const discount = installmentDiscounts[selectedInstallment.id];
    const discountedBalance = discount ? installmentBalance - Number(discount.amount) : installmentBalance;
    const maxAllowedAmount = selectedInstallment.penaltyInfo?.hasPenalty 
      ? discountedBalance + Number(selectedInstallment.penaltyInfo.penaltyAmount)
      : discountedBalance;

    if (paymentAmount > maxAllowedAmount) {
      setError(`Payment amount cannot exceed ${selectedInstallment.penaltyInfo?.hasPenalty ? 'total due with penalty' : 'remaining balance'} (₱${maxAllowedAmount.toFixed(2)})`);
      return;
    }

    const recentPayment = payments.find(
      (p) => p.installment_id === selectedInstallment.id && p.status !== 'Rejected'
    );

    if (recentPayment) {
      setError(
        `This installment already has a ${recentPayment.status} payment recorded on ${new Date(recentPayment.payment_date).toLocaleDateString()}. Recording another payment may create a duplicate.`
      );
      return;
    }

    if (isSubmittingPayment) {
      return;
    }

    setIsSubmittingPayment(true);

    try {
      // Calculate discount and amounts for payment record
      const discountAmount = installmentDiscounts[selectedInstallment.id]?.amount || 0;
      const originalAmount = Number(selectedInstallment.amount_due);
      const penaltyAmount = selectedInstallment.penaltyInfo?.hasPenalty 
        ? Number(selectedInstallment.penaltyInfo.penaltyAmount) 
        : 0;
      
      const paymentData: any = {
        student_id: plan.student_id,
        enrollment_id: plan.enrollment_id,
        academic_period_id: plan.academic_period_id,
        payment_type: "Tuition Installment",
        payment_for: `Installment #${selectedInstallment.installment_number} - ${plan.academic_period}`,
        amount: originalAmount + penaltyAmount, // Original amount + penalty
        total_discount: discountAmount, // Discount applied (net_amount auto-calculated by DB)
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        reference_number: paymentForm.reference_number,
        installment_id: selectedInstallment.id,
        remarks: paymentForm.remarks,
        status: "Approved",
        receipt_number: generateReceiptNumber(),
        received_by: user?.id
      };

      // Include penalty data if installment is overdue (admin payment - no explanation required)
      if (selectedInstallment.penaltyInfo?.hasPenalty) {
        paymentData.penalty_amount = penaltyAmount;
        paymentData.days_overdue = selectedInstallment.penaltyInfo.daysOverdue;
        // No explanation_id since this is admin-recorded
      }

      const res = await apiPost(API_ENDPOINTS.PAYMENTS, paymentData);

      if (res.success) {
        const paymentId = res.data?.id || res.id;
        
        // Always update the installment after payment
        try {
          const discount = installmentDiscounts[selectedInstallment.id];
          const amountDue = Number(selectedInstallment.amount_due);
          const discountAmount = discount ? Number(discount.amount) : 0;
          const penaltyAmount = selectedInstallment.penaltyInfo?.hasPenalty 
            ? Number(selectedInstallment.penaltyInfo.penaltyAmount) 
            : 0;
          
          const installmentUpdate: any = {
            amount_paid: amountDue + penaltyAmount, // Original amount + penalty (discount tracked in payment)
            balance: 0,
            status: 'Paid',
            paid_date: paymentForm.payment_date
          };
          
          // Add penalty details if applicable
          if (selectedInstallment.penaltyInfo?.hasPenalty) {
            installmentUpdate.late_fee = penaltyAmount;
            installmentUpdate.days_overdue = selectedInstallment.penaltyInfo.daysOverdue;
          }
          
          await apiPut(`${API_ENDPOINTS.PAYMENT_PLANS}/installments/${selectedInstallment.id}`, installmentUpdate);
          
          // If there's a discount, link it to the payment
          if (discount && plan.enrollment_id && paymentId) {
            const enrollmentDiscountsRes = await apiGet(`/api/enrollments/${plan.enrollment_id}/discounts`);
            if (enrollmentDiscountsRes.success && enrollmentDiscountsRes.data) {
              // Get the discount template IDs from the localStorage discount data
              const discountTemplateIds = discount.templates.map((t: any) => t.discount_id);
              
              // Find the discount records that match these templates and have no payment_id yet
              const unlinkedDiscounts = enrollmentDiscountsRes.data.filter(
                (d: any) => d.payment_id === null && discountTemplateIds.includes(d.template_id)
              );
              
              // Link each discount to the payment
              for (const discountRecord of unlinkedDiscounts) {
                await apiPut(`/api/enrollments/${plan.enrollment_id}/discounts/${discountRecord.id}`, {
                  payment_id: paymentId
                });
              }
            }
            
            // Clear the discount from localStorage since it's now attached to the payment
            const updatedDiscounts = { ...installmentDiscounts };
            delete updatedDiscounts[selectedInstallment.id];
            setInstallmentDiscounts(updatedDiscounts);
            localStorage.setItem(`installment_discounts_${planId}`, JSON.stringify(updatedDiscounts));
          }
        } catch (updateErr) {
          console.error("Error updating installment or linking discount:", updateErr);
          // Don't fail the whole operation, payment was still recorded
        }
        
        // Penalty is automatically recorded by the backend when payment data includes penalty_amount
        const successMessage = selectedInstallment.penaltyInfo?.hasPenalty 
          ? `Payment recorded successfully (including ₱${Number(selectedInstallment.penaltyInfo.penaltyAmount).toFixed(2)} late fee)`
          : "Payment recorded successfully";
        setSuccess(successMessage);
        setIsPaymentOpen(false);
        setPaymentForm({
          amount: "",
          payment_method: "Cash",
          payment_date: new Date().toISOString().split('T')[0],
          reference_number: "",
          remarks: ""
        });
        fetchData();
      } else {
        setError(res.message || "Failed to record payment");
      }
    } catch (err) {
      console.error("Error recording payment:", err);
      setError("Error recording payment. Please try again.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // REMOVED: handleWaivePenalty - penalties are ALWAYS charged per school policy

  const getInstallmentPenalties = (installmentId: string) => {
    return penaltyRecords.filter(p => String(p.installment_id) === String(installmentId));
  };

  // REMOVED: getInstallmentWaivedPenalties - penalties are ALWAYS charged, no waiving

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      Active: "bg-blue-100 text-blue-800",
      Completed: "bg-green-100 text-green-800",
      Overdue: "bg-red-100 text-red-800",
      Cancelled: "bg-gray-100 text-gray-800",
    };
    return variants[status] || "";
  };

  const getInstallmentStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      Pending: "bg-yellow-100 text-yellow-800",
      Paid: "bg-green-100 text-green-800",
      Partial: "bg-orange-100 text-orange-800",
      Overdue: "bg-red-100 text-red-800",
    };
    return variants[status] || "";
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      Active: <AlertCircle className="h-5 w-5 text-blue-600" />,
      Completed: <CheckCircle className="h-5 w-5 text-green-600" />,
      Overdue: <XCircle className="h-5 w-5 text-red-600" />,
      Cancelled: <XCircle className="h-5 w-5 text-gray-600" />,
    };
    return icons[status] || null;
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading payment plan...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-muted-foreground">Payment plan not found</p>
            <Button onClick={() => navigate("/admin/payment-plans")} className="mt-4">
              Back to Payment Plans
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/payment-plans")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Payment Plan: {plan.student_name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage installments and payment records
            </p>
          </div>
        </div>

        {/* Alert Messages */}
        {error && <AlertMessage type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertMessage type="success" message={success} onClose={() => setSuccess("")} />}

        {/* Plan Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <User className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-blue-600 font-semibold">Student Details</p>
              </div>
              <p className="text-xl font-bold text-blue-900">{plan.student_name}</p>
              <p className="text-sm text-blue-700">{plan.student_number}</p>
              <p className="text-xs text-blue-600 mt-2">{plan.academic_period}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <Coins className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-600 font-semibold">Payment Progress</p>
              </div>
              <p className="text-2xl font-bold text-green-900">
                ₱{Number(plan.total_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-green-700">
                of ₱{Number(plan.total_tuition).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <div className="w-full bg-green-200 rounded-full h-2 mt-3">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${((Number(plan.total_paid) / Number(plan.total_tuition)) * 100)}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                {getStatusIcon(plan.status)}
                <p className="text-sm text-orange-600 font-semibold">Plan Status</p>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getStatusBadge(plan.status)}>{plan.status}</Badge>
                <Badge variant="outline">{plan.schedule_type}</Badge>
              </div>
              <p className="text-xl font-bold text-orange-900">
                ₱{Number(plan.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-orange-700">Remaining Balance</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Progress Summary */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <h4 className="font-semibold text-sm mb-3 text-blue-900">Overall Progress</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Paid</span>
                <span className="font-bold text-green-600">
                  ₱{Number(plan.total_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${((Number(plan.total_paid) / Number(plan.total_tuition)) * 100).toFixed(1)}%` }}
                >
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{((Number(plan.total_paid) / Number(plan.total_tuition)) * 100).toFixed(1)}% Complete</span>
                <span>{installments.filter(i => i.status === 'Paid').length} of {installments.length} installments paid</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Installments Schedule */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl">Installment Schedule</CardTitle>
              {!isEditingInstallments && installments.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleEditInstallments}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Schedule
                </Button>
              )}
              {isEditingInstallments && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveInstallments}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {(isEditingInstallments ? editedInstallments : installments).map((installment, index) => (
                <div
                  key={installment.id}
                  className="flex items-center justify-between p-6 border-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30">
                      <span className="text-xs text-muted-foreground font-medium">No.</span>
                      <span className="font-bold text-primary text-lg">{installment.installment_number}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">
                        Installment #{installment.installment_number}
                      </p>
                      {!isEditingInstallments ? (
                        <>
                          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            Due: {new Date(installment.due_date).toLocaleDateString()}
                            {installment.paid_date && (
                              <span className="text-green-600 font-medium">
                                • Paid: {new Date(installment.paid_date).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                          {installment.penaltyInfo?.hasPenalty && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                              <p className="text-xs text-red-700 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {installment.penaltyInfo.daysOverdue} day{installment.penaltyInfo.daysOverdue !== 1 ? 's' : ''} overdue
                              </p>
                              <p className="text-xs text-red-600 mt-1">
                                Late fee ({installment.penaltyInfo.penaltyPercentage}%): ₱{Number(installment.penaltyInfo.penaltyAmount).toFixed(2)}
                              </p>
                              <p className="text-xs text-red-800 font-bold mt-1">
                                Total due with penalty: ₱{Number(installment.penaltyInfo.totalDue).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {/* REMOVED: Waived penalties display - penalties are ALWAYS charged per school policy */}
                        </>
                      ) : (
                        <div className="flex gap-3 mt-2">
                          <div>
                            <Label className="text-xs">Due Date</Label>
                            <Input
                              type="date"
                              value={installment.due_date}
                              onChange={(e) => handleInstallmentChange(index, 'due_date', e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Amount</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={installment.amount_due}
                              onChange={(e) => handleInstallmentChange(index, 'amount_due', parseFloat(e.target.value))}
                              className="h-9 text-sm w-32"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {!isEditingInstallments && (
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        ₱{Number(installment.amount_due).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                      {installmentDiscounts[installment.id] && (
                        <>
                          <p className="text-sm text-amber-600 font-medium">
                            Discount: -₱{Number(installmentDiscounts[installment.id].amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-blue-600 font-bold">
                            Net Amount: ₱{(Number(installment.amount_due) - Number(installmentDiscounts[installment.id].amount)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                        </>
                      )}
                      {installment.amount_paid > 0 && (
                        <p className="text-sm text-green-600 font-medium">
                          Paid: ₱{Number(installment.amount_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {installment.balance > 0 && (
                        <p className="text-sm text-orange-600 font-semibold">
                          Balance: ₱{Number(installment.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3 justify-end">
                        <Badge className={getInstallmentStatusBadge(installment.status)}>
                          {installment.status}
                        </Badge>
                        {installment.installment_number === 1 && (installment.status === 'Pending' || installment.status === 'Partial' || installment.status === 'Overdue') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInstallmentForDiscount(installment);
                              setIsDiscountDialogOpen(true);
                            }}
                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            Discount
                          </Button>
                        )}
                        {/* REMOVED: Waive Penalty button - penalties are ALWAYS charged per school policy */}
                        {(installment.status === 'Pending' || installment.status === 'Partial' || installment.status === 'Overdue') && (
                          <Button
                            size="sm"
                            onClick={() => handlePayInstallment(installment)}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                          >
                            <Coins className="h-3 w-3 mr-1" />
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {installments.length === 0 && (
              <div className="text-center py-16">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-muted-foreground">No installments found for this plan</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-semibold">Record Installment Payment</DialogTitle>
            </DialogHeader>
            {selectedInstallment && plan && (
              <div className="space-y-4 py-4">
                {/* Installment Info */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Student</p>
                      <p className="font-semibold">{plan.student_name}</p>
                    </div>
                    <Badge className={getInstallmentStatusBadge(selectedInstallment.status)}>
                      {selectedInstallment.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Installment</p>
                      <p className="font-medium">#{selectedInstallment.installment_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="font-medium">{new Date(selectedInstallment.due_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount Due</p>
                      <p className="font-medium">₱{Number(selectedInstallment.amount_due).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                    </div>
                    {installmentDiscounts[selectedInstallment.id] && (
                      <div>
                        <p className="text-xs text-muted-foreground">Discount Applied</p>
                        <p className="font-medium text-amber-600">-₱{Number(installmentDiscounts[selectedInstallment.id].amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-medium text-orange-600">₱{Number(selectedInstallment.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                    </div>
                    {selectedInstallment.penaltyInfo?.hasPenalty && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Days Overdue</p>
                          <p className="font-medium text-red-600">{selectedInstallment.penaltyInfo.daysOverdue} days</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Late Fee ({selectedInstallment.penaltyInfo.penaltyPercentage}%)</p>
                          <p className="font-medium text-red-600">₱{Number(selectedInstallment.penaltyInfo.penaltyAmount).toFixed(2)}</p>
                        </div>
                      </>
                    )}
                  </div>
                  {selectedInstallment.penaltyInfo?.hasPenalty && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-semibold text-red-800">
                        Total Amount Due (with penalty):
                      </p>
                      <p className="text-2xl font-bold text-red-700">
                        ₱{Number(selectedInstallment.penaltyInfo.totalDue).toFixed(2)}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Balance: ₱{Number(selectedInstallment.balance).toFixed(2)} + Late Fee: ₱{Number(selectedInstallment.penaltyInfo.penaltyAmount).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment Form */}
                <div>
                  <Label>Payment Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    max={selectedInstallment.penaltyInfo?.hasPenalty ? Number(selectedInstallment.penaltyInfo.totalDue) : Number(selectedInstallment.balance)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(() => {
                      const discount = installmentDiscounts[selectedInstallment.id];
                      const baseBalance = Number(selectedInstallment.balance);
                      const discountedBalance = discount ? baseBalance - Number(discount.amount) : baseBalance;
                      
                      if (selectedInstallment.penaltyInfo?.hasPenalty) {
                        const totalWithPenalty = discountedBalance + Number(selectedInstallment.penaltyInfo.penaltyAmount);
                        return (
                          <>
                            Maximum: ₱{totalWithPenalty.toFixed(2)}
                            {discount && <span className="text-amber-600 font-medium"> (₱{baseBalance.toFixed(2)} - ₱{Number(discount.amount).toFixed(2)} discount + ₱{Number(selectedInstallment.penaltyInfo.penaltyAmount).toFixed(2)} late fee)</span>}
                            {!discount && <span className="text-red-600 font-medium"> (includes ₱{Number(selectedInstallment.penaltyInfo.penaltyAmount).toFixed(2)} late fee)</span>}
                          </>
                        );
                      } else {
                        return (
                          <>
                            Maximum: ₱{discountedBalance.toFixed(2)}
                            {discount && <span className="text-amber-600 font-medium"> (₱{baseBalance.toFixed(2)} - ₱{Number(discount.amount).toFixed(2)} discount)</span>}
                          </>
                        );
                      }
                    })()}
                  </p>
                </div>

                <div>
                  <Label>Payment Method *</Label>
                  <Select 
                    value={paymentForm.payment_method} 
                    onValueChange={async (v) => {
                      const newForm = { ...paymentForm, payment_method: v };
                      // if (v === "Cash") {
                      //   newForm.reference_number = await generateInvoiceNumber();
                      // } else 
                      if (paymentForm.payment_method === "Cash") {
                        newForm.reference_number = "";
                      }
                      setPaymentForm(newForm);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* GCash QR Uploader button */}
                {paymentForm.payment_method === 'GCash' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-700 mb-2 font-medium">
                      Let the student upload their GCash screenshot by scanning a QR code.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                      onClick={handleOpenGcashQr}
                      disabled={gcashSessionLoading}
                    >
                      {gcashSessionLoading
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating session…</>
                        : <><QrCode className="h-4 w-4 mr-2" />Open QR Uploader</>}
                    </Button>
                    {gcashProofReceived && (
                      <div className="mt-2 flex items-center gap-2 text-green-700 text-xs font-medium">
                        <CheckCircle className="h-4 w-4" />
                        Proof received — reference auto-filled
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label>Payment Date *</Label>
                  <Input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Reference Number</Label>
                  <Input
                    placeholder="Enter official receipt invoice number"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Remarks</Label>
                  <Input
                    placeholder="Additional notes (optional)"
                    value={paymentForm.remarks}
                    onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsPaymentOpen(false)} disabled={isSubmittingPayment}>
                Cancel
              </Button>
              <Button onClick={handleSubmitPayment} disabled={isSubmittingPayment}>
                <Coins className="h-4 w-4 mr-2" />
                {isSubmittingPayment ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Discount Dialog */}
        {selectedInstallmentForDiscount && plan && (() => {
          // Find the payment record associated with this installment
          const installmentPayment = payments.find(p => p.installment_id === selectedInstallmentForDiscount.id);
          
          // For enrollment discounts (no payment yet), we use a virtual payment object
          const paymentData = installmentPayment ? {
            id: installmentPayment.id,
            student_id: parseInt(plan.student_id),
            enrollment_id: plan.enrollment_id ? parseInt(plan.enrollment_id) : installmentPayment.enrollment_id,
            payment_type: "Tuition Installment",
            amount: installmentPayment.amount,
            total_discount: installmentPayment.total_discount || 0,
            net_amount: installmentPayment.net_amount || installmentPayment.amount
          } : {
            id: 0, // Virtual payment ID for enrollment discount
            student_id: parseInt(plan.student_id),
            enrollment_id: plan.enrollment_id ? parseInt(plan.enrollment_id) : undefined,
            payment_type: "Tuition Installment",
            amount: selectedInstallmentForDiscount.amount_due,
            total_discount: installmentDiscounts[selectedInstallmentForDiscount.id]?.amount || 0,
            net_amount: selectedInstallmentForDiscount.amount_due - (installmentDiscounts[selectedInstallmentForDiscount.id]?.amount || 0)
          };
          
          return (
            <DiscountDialog
              open={isDiscountDialogOpen}
              onOpenChange={setIsDiscountDialogOpen}
              payment={paymentData}
              excludeDiscountNames={["Full Payment"]} // Exclude full payment discounts for installments
              onDiscountsUpdated={(updatedDiscounts) => {
                // Calculate total discount amount
                const totalDiscount = updatedDiscounts.reduce((sum, d) => sum + d.applied_amount, 0);
                
                // Store discount in localStorage for pending installments
                if (!installmentPayment) {
                  const updatedInstallmentDiscounts = {
                    ...installmentDiscounts,
                    [selectedInstallmentForDiscount.id]: {
                      amount: totalDiscount,
                      templates: updatedDiscounts
                    }
                  };
                  setInstallmentDiscounts(updatedInstallmentDiscounts);
                  localStorage.setItem(`installment_discounts_${planId}`, JSON.stringify(updatedInstallmentDiscounts));
                  setSuccess(`Discount of ₱${totalDiscount.toFixed(2)} applied to Installment #${selectedInstallmentForDiscount.installment_number}`);
                }
                
                fetchData();
                setIsDiscountDialogOpen(false);
              }}
            />
          );
        })()}

        {/* REMOVED: Waive Penalty Dialog - penalties are ALWAYS charged per school policy */}

      </div>
    </DashboardLayout>
  );
}
