import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
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
  Search,
  Plus,
  User,
  Coins,
  CalendarClock,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  Edit,
  FileText,
  Settings,
  ShieldAlert
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost, apiPut } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";
import { useManilaTime } from "@/hooks/useManilaTime";

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

type ScheduleTemplate = {
  id: string | number;
  name: string;
  description: string;
  schedule_type: "Monthly" | "Quarterly" | "Semestral" | "Tri Semestral";
  number_of_installments: number;
  status: "active" | "inactive";
  installments?: any[];
  created_at?: string;
  updated_at?: string;
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

type Student = {
  user_id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  year_level: string;
};

type AcademicPeriod = {
  id: string;
  school_year: string;
  quarter: string;
  status: string;
};

type Enrollment = {
  id: string;
  academic_period_id: string;
  school_year: string;
  quarter: string;
  grade_level: string;
  status: string;
  student_name: string;
  created_user_id: string;
};

type SchoolFee = {
  id: string;
  fee_type: string;
  fee_name: string;
  amount: number;
  academic_period_id: string;
  year_level: string;
  is_active: boolean;
};

type NotificationRow = {
  id: number | string;
  title?: string;
  body?: string;
  entity_type?: string;
  entity_id?: number | string;
  action_url?: string;
  created_at?: string;
};

const UNREAD_PLAN_NOTIFICATIONS_POLL_MS = 90 * 1000;

export default function PaymentPlans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const confirmFn = useConfirm();
  const queryClient = useQueryClient();
  const { toIsoDate, todayIsoManila } = useManilaTime();
  const highlightedPlanRef = useRef<HTMLTableRowElement | null>(null);
  const highlightedPlanId = searchParams.get("highlight");
  const highlightedNotificationId = searchParams.get("notification_id");
  const [pendingHighlightedPlanId, setPendingHighlightedPlanId] = useState<string | null>(highlightedPlanId);
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(highlightedNotificationId);

  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [schoolFees, setSchoolFees] = useState<SchoolFee[]>([]);
  const [academicPeriods, setAcademicPeriods] = useState<AcademicPeriod[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleTemplate[]>([]);
  const [totalPenalties, setTotalPenalties] = useState<number>(0);
  const [unreadPlanNotifications, setUnreadPlanNotifications] = useState<NotificationRow[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isTemplateSelectOpen, setIsTemplateSelectOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [isEditingInstallments, setIsEditingInstallments] = useState(false);
  const [editedInstallments, setEditedInstallments] = useState<Installment[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "Cash",
    payment_date: todayIsoManila(),
    reference_number: "",
    remarks: ""
  });

  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [form, setForm] = useState({
    student_id: "",
    enrollment_id: "",
    academic_period_id: "",
    total_tuition: "",
    schedule_type: "Quarterly" as "Monthly" | "Quarterly" | "Semestral" | "Tri Semestral",
    number_of_installments: "4",
    start_date: todayIsoManila(),
  });

  const PAYMENT_TYPES = ["Monthly", "Quarterly", "Semestral", "Tri Semestral"];
  const STATUS_OPTIONS = ["All", "Active", "Completed", "Overdue", "Cancelled"];
  const PAYMENT_METHODS = ["Cash", "Check", "Bank Transfer", "GCash", "PayMaya", "Others"];

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
      return false; // Assume doesn't exist on error to allow creation
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
      
      // Format: MCAFINV-YYYYMMDDHHMMSSRRR
      const invoiceNumber = `MCAFINV-${year}${month}${day}${hours}${minutes}${seconds}${random}`;
      
      // Check if this number already exists
      const exists = await checkReferenceNumberExists(invoiceNumber);
      
      if (!exists) {
        return invoiceNumber;
      }
      
      // If duplicate found, wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Fallback: use timestamp in milliseconds if all attempts failed
    const timestamp = Date.now();
    return `MCAFINV-${timestamp}`;
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/unauthorized");
      return;
    }
    fetchData();
  }, [user]);

  // Check for student_id param to auto-open specific plan
  useEffect(() => {
    const studentId = searchParams.get('student_id');
    if (studentId && paymentPlans.length > 0) {
      const plan = paymentPlans.find(p => p.student_id === studentId);
      if (plan) {
        handleViewPlan(plan);
      }
    }
  }, [searchParams, paymentPlans]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, enrollmentsRes, feesRes, periodsRes, paymentsRes, templatesRes, penaltiesRes] = await Promise.all([
        apiGet(API_ENDPOINTS.PAYMENT_PLANS),
        apiGet(API_ENDPOINTS.ADMIN_ENROLLMENTS),
        apiGet(API_ENDPOINTS.SCHOOL_FEES),
        apiGet(API_ENDPOINTS.ACADEMIC_PERIODS),
        apiGet(API_ENDPOINTS.PAYMENTS),
        apiGet(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATES),
        apiGet('/api/payment-installment-penalties') // Fetch all penalties
      ]);

      if (plansRes.success) setPaymentPlans(plansRes.data || []);
      if (enrollmentsRes.success) {
        const enrollmentData = enrollmentsRes.data || enrollmentsRes.enrollments || [];
        setEnrollments(enrollmentData);
      }
      if (feesRes.success) setSchoolFees(feesRes.data || []);
      if (periodsRes.success) setAcademicPeriods(periodsRes.data || []);
      if (paymentsRes.success) setPayments(paymentsRes.data || []);
      if (templatesRes.success) {
        // Filter only active templates
        const activeTemplates = (templatesRes.data || []).filter((t: ScheduleTemplate) => t.status === 'active');
        setScheduleTemplates(activeTemplates);
      }
      
      // Calculate total penalties from penalty records
      if (penaltiesRes.success && penaltiesRes.data) {
        const total = penaltiesRes.data.reduce((sum: number, penalty: any) => {
          return sum + (Number(penalty.penalty_amount) || 0);
        }, 0);
        setTotalPenalties(total);
      }
    } catch (err) {
      setError("Failed to load payment plans");
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlan = async (plan: PaymentPlan) => {
    setSelectedPlan(plan);
    setIsViewOpen(true);
    setIsEditingInstallments(false);
    
    // Fetch installments for this plan
    try {
      const res = await apiGet(`${API_ENDPOINTS.PAYMENT_PLANS}/${plan.id}/installments`);
      if (res.success) {
        const installmentData = res.data || [];
        setInstallments(installmentData);
        setEditedInstallments(installmentData);
      }
    } catch (err) {
      console.error("Failed to load installments:", err);
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
    // Show confirmation dialog
    const confirmed = await confirmFn({
      title: "Confirm Installment Changes",
      description: "Are you sure you want to save these changes? This will update the due dates and amounts for all installments.",
      confirmText: "Save Changes",
      cancelText: "Cancel"
    });

    if (!confirmed) return;

    try {
      // Update each modified installment
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

  const handlePayInstallment = async (installment: Installment) => {
    setSelectedInstallment(installment);
    // Auto-generate invoice number for Cash payment
    const invoiceNumber = await generateInvoiceNumber();
    // Pre-fill amount with remaining balance
    setPaymentForm({
      amount: installment.balance.toString(),
      payment_method: "Cash",
      payment_date: todayIsoManila(),
      reference_number: invoiceNumber,
      remarks: ""
    });
    setIsPaymentOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedInstallment || !selectedPlan) {
      setError("Missing installment or plan information");
      return;
    }

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    const paymentAmount = parseFloat(paymentForm.amount);
    const installmentBalance = selectedInstallment.balance;

    if (paymentAmount > installmentBalance) {
      setError(`Payment amount cannot exceed remaining balance (₱${installmentBalance.toFixed(2)})`);
      return;
    }

    // Check if this installment already has a recent payment (prevent duplicates)
    const recentPayment = payments.find(
      (p) => p.installment_id === selectedInstallment.id && p.status !== 'Rejected'
    );

    if (recentPayment) {
      setError(
        `This installment already has a ${recentPayment.status} payment recorded on ${toIsoDate(recentPayment.payment_date) || '-'}. Recording another payment may create a duplicate.`
      );
      return;
    }

    // Prevent multiple rapid submissions
    if (isSubmittingPayment) {
      return;
    }

    setIsSubmittingPayment(true);

    try {
      // Create payment record
      const res = await apiPost(API_ENDPOINTS.PAYMENTS, {
        student_id: selectedPlan.student_id,
        enrollment_id: selectedPlan.enrollment_id,
        academic_period_id: selectedPlan.academic_period_id,
        payment_type: "Tuition Installment",
        payment_for: `Installment #${selectedInstallment.installment_number} - ${selectedPlan.academic_period}`,
        amount: paymentAmount,
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        reference_number: paymentForm.reference_number,
        installment_id: selectedInstallment.id,
        remarks: paymentForm.remarks,
        status: "Approved",
        receipt_number: generateReceiptNumber(),
        received_by: user?.id
      });

      if (res.success) {
        setSuccess("Payment recorded successfully");
        setIsPaymentOpen(false);
        setPaymentForm({
          amount: "",
          payment_method: "Cash",
          payment_date: todayIsoManila(),
          reference_number: "",
          remarks: ""
        });
        // Refresh installments and plan data
        handleViewPlan(selectedPlan);
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

  const handleTemplateSelect = (template: ScheduleTemplate) => {
    setSelectedTemplate(template);
    setForm({
      ...form,
      schedule_type: template.schedule_type,
      number_of_installments: template.number_of_installments.toString()
    });
    setIsTemplateSelectOpen(false);
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.student_id || !form.enrollment_id || !form.academic_period_id || !form.total_tuition) {
      setError("Please fill all required fields");
      return;
    }

    if (!selectedTemplate) {
      setError("Please select a payment schedule template");
      return;
    }

    try {
      const res = await apiPost(API_ENDPOINTS.PAYMENT_PLANS, {
        student_id: form.student_id,
        enrollment_id: form.enrollment_id,
        academic_period_id: form.academic_period_id,
        total_tuition: parseFloat(form.total_tuition),
        total_paid: 0,
        balance: parseFloat(form.total_tuition),
        schedule_type: form.schedule_type,
        number_of_installments: parseInt(form.number_of_installments),
        template_id: selectedTemplate.id,
        status: "Active",
        start_date: form.start_date
      });

      if (res.success) {
        setSuccess("Payment plan created successfully");
        setIsCreateOpen(false);
        fetchData();
        resetForm();
      } else {
        setError(res.message || "Failed to create payment plan");
      }
    } catch (err) {
      setError("Error creating payment plan");
    }
  };

  const resetForm = () => {
    setForm({
      student_id: "",
      enrollment_id: "",
      academic_period_id: "",
      total_tuition: "",
      schedule_type: "Quarterly",
      number_of_installments: "4",
      start_date: todayIsoManila(),
    });
    setStudentSearchQuery("");
    setSelectedTemplate(null);
  };

  const filteredStudentSuggestions = enrollments.filter((enrollment) => {
    const query = studentSearchQuery.toLowerCase();
    const matchesSearch = (
      enrollment.student_name.toLowerCase().includes(query) ||
      enrollment.grade_level.toLowerCase().includes(query)
    );
    
    // Exclude if enrollment already has a payment plan
    const hasPaymentPlan = paymentPlans.some(
      (plan) => plan.enrollment_id === enrollment.id
    );
    
    // Exclude if enrollment has a "Tuition Full Payment"
    const hasTuitionFullPayment = payments.some(
      (payment) => payment.enrollment_id === enrollment.id &&
                   payment.payment_type === "Tuition Full Payment"
    );
    
    return matchesSearch && !hasPaymentPlan && !hasTuitionFullPayment;
  }).slice(0, 10);

  const filteredPlans = paymentPlans.filter((plan) => {
    const matchesSearch =
      plan.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.student_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const unreadPlanNotificationsByPlanId = unreadPlanNotifications.reduce((acc, notif) => {
    const key = String(notif.entity_id || "");
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {} as Record<string, NotificationRow[]>);

  const unreadHighlightedPlanIds = new Set(Object.keys(unreadPlanNotificationsByPlanId));

  const refreshUnreadPlanNotifications = async () => {
    try {
      const res = await apiGet(`${API_ENDPOINTS.NOTIFICATIONS}?unread_only=true&limit=100`);
      const rows = Array.isArray(res?.data) ? res.data : [];
      const filtered = rows.filter((row: any) => {
        const entityType = String(row?.entity_type || "").toLowerCase();
        const actionUrl = String(row?.action_url || "").toLowerCase();
        return (
          (entityType === "payment_plan" || entityType === "payment_plans" || entityType === "installment") &&
          actionUrl.includes("/admin/payment-plans")
        );
      });
      setUnreadPlanNotifications(filtered);
    } catch (err) {
      console.error("Failed to load unread payment-plan notifications:", err);
    }
  };

  useEffect(() => {
    refreshUnreadPlanNotifications();

    const pollTimer = window.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      refreshUnreadPlanNotifications();
    }, UNREAD_PLAN_NOTIFICATIONS_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, []);

  useEffect(() => {
    if (highlightedPlanId) {
      setPendingHighlightedPlanId(highlightedPlanId);
    }
    if (highlightedNotificationId) {
      setPendingNotificationId(highlightedNotificationId);
    }
  }, [highlightedPlanId, highlightedNotificationId]);

  useEffect(() => {
    if (!pendingHighlightedPlanId || !highlightedPlanRef.current) return;

    const scrollTimer = setTimeout(() => {
      highlightedPlanRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);

    return () => {
      clearTimeout(scrollTimer);
    };
  }, [pendingHighlightedPlanId]);

  const handleViewAction = async (plan: PaymentPlan) => {
    const mappedUnreadForPlan = unreadPlanNotificationsByPlanId[String(plan.id)] || [];
    const mappedNotificationId = mappedUnreadForPlan.length > 0 ? String(mappedUnreadForPlan[0].id) : null;
    const notificationIdToMark = pendingNotificationId || highlightedNotificationId || mappedNotificationId;
    const hasNotificationContext = Boolean(
      notificationIdToMark || pendingHighlightedPlanId || highlightedPlanId
    );

    if (!hasNotificationContext) {
      navigate(`/admin/payment-plans/${plan.id}`);
      return;
    }

    const markResult = await markPlanNotificationsAsRead(String(plan.id), notificationIdToMark ? [String(notificationIdToMark)] : []);

    if (markResult.successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "sidebar-unread-snapshot"] });
      refreshUnreadPlanNotifications();
      setPendingNotificationId(null);
      setPendingHighlightedPlanId(null);
      setSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete("highlight");
        nextParams.delete("notification_id");
        return nextParams;
      });
    } else if (markResult.candidateIds.length > 0) {
      setError(
        markResult.lastErrorMessage
          ? `Failed to mark as read (${markResult.lastErrorMessage})`
          : "Failed to mark notification as read"
      );
      return;
    } else {
      setError("No matching notification found to mark as read");
      return;
    }

    navigate(`/admin/payment-plans/${plan.id}`);
  };

  const markPlanNotificationsAsRead = async (planId: string, preferredIds: string[] = []) => {
    let backendMessage = "";

    try {
      const byPlanRes = await apiPost(API_ENDPOINTS.PAYMENT_PLAN_MARK_NOTIFICATIONS_READ(planId), {});
      if (byPlanRes?.success) {
        const serverCandidates = Array.isArray(byPlanRes?.candidate_notification_ids)
          ? byPlanRes.candidate_notification_ids.map((id: any) => String(id)).filter(Boolean)
          : [];
        const markedCount = Number(byPlanRes?.marked_count || 0);

        if (markedCount > 0) {
          return {
            candidateIds: serverCandidates,
            successCount: markedCount,
            lastErrorMessage: "",
          };
        }

        backendMessage = String(byPlanRes?.message || "");
      }
    } catch (err: any) {
      backendMessage = err?.message || "request failed";
    }

    const mappedUnreadForPlan = unreadPlanNotificationsByPlanId[String(planId)] || [];
    const candidateIds = Array.from(
      new Set([
        ...preferredIds,
        ...mappedUnreadForPlan.map((row) => String(row.id)).filter(Boolean),
      ])
    );

    if (candidateIds.length === 0) {
      try {
        const unreadRes = await apiGet(`${API_ENDPOINTS.NOTIFICATIONS}?unread_only=true&limit=100`);
        const unreadRows = Array.isArray(unreadRes?.data) ? unreadRes.data : [];
        unreadRows.forEach((row: any) => {
          const entityType = String(row?.entity_type || "").toLowerCase();
          const rowEntityId = String(row?.entity_id || "");
          const actionUrl = String(row?.action_url || "").toLowerCase();
          const isPlanNotif =
            (entityType === "payment_plan" || entityType === "payment_plans" || entityType === "installment") &&
            rowEntityId === String(planId) &&
            actionUrl.includes("/admin/payment-plans");

          if (isPlanNotif && row?.id) {
            candidateIds.push(String(row.id));
          }
        });
      } catch {
        // fallback lookup failed, return with current candidates
      }
    }

    const uniqueIds = Array.from(new Set(candidateIds));
    let successCount = 0;
    let lastErrorMessage = "";

    for (const notifId of uniqueIds) {
      try {
        const markReadRes = await apiPost(API_ENDPOINTS.NOTIFICATION_MARK_AS_READ(notifId), {});
        if (markReadRes?.success) {
          successCount += 1;
        } else if (markReadRes?.message) {
          lastErrorMessage = String(markReadRes.message);
        }
      } catch (err: any) {
        lastErrorMessage = err?.message || "request failed";
      }
    }

    return {
      candidateIds: uniqueIds,
      successCount,
      lastErrorMessage: lastErrorMessage || backendMessage,
    };
  };

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

  const stats = {
    active: paymentPlans.filter(p => p.status === "Active").length,
    completed: paymentPlans.filter(p => p.status === "Completed").length,
    overdue: paymentPlans.filter(p => p.status === "Overdue").length,
    totalBalance: paymentPlans.reduce((sum, p) => sum + (Number(p.balance) || 0), 0),
    totalPenalties: totalPenalties,
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Payment Plans & Installments</h1>
            <p className="text-muted-foreground mt-1">Manage student payment schedules and track installments</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => navigate("/admin/installment-schedules")} 
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              Schedule Management
            </Button>
            <Button onClick={() => setIsTemplateSelectOpen(true)} className="bg-gradient-to-r from-blue-600 to-cyan-500">
              <Plus className="h-4 w-4 mr-2" />
              New Payment Plan
            </Button>
          </div>
        </div>

        {/* Alert Messages */}
        {error && <AlertMessage type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertMessage type="success" message={success} onClose={() => setSuccess("")} />}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-semibold">Active Plans</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.active}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-semibold">Completed</p>
                  <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-semibold">Overdue</p>
                  <p className="text-2xl font-bold text-red-700">{stats.overdue}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-semibold">Total Balance</p>
                  <p className="text-2xl font-bold text-orange-700">
                    ₱{stats.totalBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-semibold">Total Penalties</p>
                  <p className="text-2xl font-bold text-purple-700">
                    ₱{stats.totalPenalties.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                  <ShieldAlert className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Plans Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Academic Period</th>
                    <th className="px-6 py-3">Payment Type</th>
                    <th className="px-6 py-3">Total Amount</th>
                    <th className="px-6 py-3">Paid</th>
                    <th className="px-6 py-3">Balance</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      ref={pendingHighlightedPlanId === String(plan.id) ? highlightedPlanRef : null}
                      className={
                        pendingHighlightedPlanId === String(plan.id)
                          ? "border-b bg-yellow-50/80 ring-1 ring-yellow-300 hover:bg-yellow-50"
                          : unreadHighlightedPlanIds.has(String(plan.id))
                            ? "border-b bg-amber-50/70 hover:bg-amber-100/60"
                          : "border-b hover:bg-muted/50"
                      }
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {plan.student_name}
                              {unreadHighlightedPlanIds.has(String(plan.id)) && (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-1.5 py-0 h-5">
                                  New
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{plan.student_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{plan.academic_period}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline">{plan.schedule_type}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {plan.number_of_installments} installment{plan.number_of_installments > 1 ? 's' : ''}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        ₱{Number(plan.total_tuition).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-green-600">
                        ₱{Number(plan.total_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        ₱{Number(plan.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getStatusBadge(plan.status)}>{plan.status}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewAction(plan)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredPlans.length === 0 && (
                <div className="text-center py-16">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No payment plans found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Template Selection Dialog */}
        <Dialog open={isTemplateSelectOpen} onOpenChange={setIsTemplateSelectOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-semibold">Select Payment Schedule Template</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a payment schedule template for this payment plan
              </p>
            </DialogHeader>
            <div className="py-4">
              {scheduleTemplates.length === 0 ? (
                <div className="text-center py-16">
                  <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium mb-2">No active templates available</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Please create a payment schedule template first
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsTemplateSelectOpen(false);
                      navigate("/admin/installment-schedules");
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Go to Schedule Management
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scheduleTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="p-6 border-2 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{template.name}</h3>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">
                          {template.schedule_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">
                            {template.number_of_installments} Installments
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">Active</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Payment Plan Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-semibold">Create Payment Plan</DialogTitle>
              {selectedTemplate && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Selected Template: {selectedTemplate.name}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {selectedTemplate.schedule_type} • {selectedTemplate.number_of_installments} Installments
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreateOpen(false);
                        setIsTemplateSelectOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative">
                <Label>Student *</Label>
                <Input
                  placeholder="Search student by ID or name..."
                  value={studentSearchQuery}
                  onChange={(e) => {
                    setStudentSearchQuery(e.target.value);
                    setShowStudentSuggestions(true);
                    if (!e.target.value) {
                      setForm({ ...form, student_id: "" });
                    }
                  }}
                  onFocus={() => setShowStudentSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowStudentSuggestions(false), 200);
                  }}
                />
                {showStudentSuggestions && filteredStudentSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredStudentSuggestions.map((enrollment) => {
                      // Find tuition fee for this enrollment's grade level (no academic_period filter needed)
                      const tuitionFee = schoolFees.find(
                        (fee) =>
                          fee.fee_type === 'Tuition' &&
                          (fee.year_level === null || fee.year_level === enrollment.grade_level) &&
                          fee.is_active
                      );
                      
                      return (
                        <button
                          key={enrollment.id}
                          type="button"
                          className="w-full px-4 py-2 text-left hover:bg-gray-100"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setForm({ 
                              ...form, 
                              student_id: enrollment.created_user_id,
                              enrollment_id: enrollment.id,
                              academic_period_id: enrollment.academic_period_id,
                              total_tuition: tuitionFee ? tuitionFee.amount.toString() : ""
                            });
                            setStudentSearchQuery(
                              `${enrollment.student_name} (${enrollment.grade_level} - ${enrollment.school_year})`
                            );
                            setShowStudentSuggestions(false);
                          }}
                        >
                          <div className="font-medium">
                            {enrollment.student_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {enrollment.grade_level} • {enrollment.school_year} - {enrollment.quarter}
                            {tuitionFee && (
                              <span className="ml-2 text-green-600">
                                • ₱{tuitionFee.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            Status: {enrollment.status}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <Label>Academic Period *</Label>
                <Select 
                  value={form.academic_period_id} 
                  onValueChange={(v) => {
                    // When academic period changes, try to find and populate tuition amount
                    const selectedEnrollment = enrollments.find(
                      (e) => e.created_user_id === form.student_id && String(e.academic_period_id) === String(v)
                    );
                    
                    // Find tuition fee - no academic_period filtering needed (reusable fees)
                    const tuitionFee = selectedEnrollment
                      ? schoolFees.find(
                          (fee) =>
                            fee.fee_type === 'Tuition' &&
                            (fee.year_level === null || fee.year_level === selectedEnrollment.grade_level) &&
                            fee.is_active
                        )
                      : null;
                    
                    console.log('Selected enrollment:', selectedEnrollment);
                    console.log('Tuition fee found:', tuitionFee);
                    
                    setForm({ 
                      ...form, 
                      academic_period_id: v,
                      total_tuition: tuitionFee ? tuitionFee.amount.toString() : form.total_tuition
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicPeriods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.school_year} - {p.quarter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Tuition *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.total_tuition}
                    onChange={(e) => setForm({ ...form, total_tuition: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type *</Label>
                  <Select 
                    value={form.schedule_type} 
                    onValueChange={(v: any) => {
                      let installments = "4";
                      if (v === "Monthly") installments = "10";
                      else if (v === "Quarterly") installments = "4";
                      else if (v === "Semestral") installments = "2";
                      else if (v === "Tri Semestral") installments = "3";
                      setForm({ ...form, schedule_type: v, number_of_installments: installments });
                    }}
                    disabled={!!selectedTemplate}
                  >
                    <SelectTrigger className={selectedTemplate ? "bg-muted" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Locked by selected template
                    </p>
                  )}
                </div>

                <div>
                  <Label>Number of Installments *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.number_of_installments}
                    onChange={(e) => setForm({ ...form, number_of_installments: e.target.value })}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on payment type
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setIsCreateOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!selectedTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Payment Plan Dialog */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-semibold">Payment Plan Details</DialogTitle>
            </DialogHeader>
            {selectedPlan && (
              <div className="space-y-6 py-4">
                {/* Plan Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Student</p>
                    <p className="font-semibold">{selectedPlan.student_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPlan.student_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Academic Period</p>
                    <p className="font-semibold">{selectedPlan.academic_period}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-bold">
                      ₱{Number(selectedPlan.total_tuition).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-lg font-bold text-red-600">
                      ₱{Number(selectedPlan.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Type</p>
                    <Badge variant="outline">{selectedPlan.schedule_type}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={getStatusBadge(selectedPlan.status)}>{selectedPlan.status}</Badge>
                  </div>
                </div>

                {/* Payment Progress Summary */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-sm mb-3 text-blue-900">Payment Progress</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Paid</span>
                      <span className="font-bold text-green-600">
                        ₱{Number(selectedPlan.total_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${((Number(selectedPlan.total_paid) / Number(selectedPlan.total_tuition)) * 100).toFixed(1)}%` }}
                      >
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{((Number(selectedPlan.total_paid) / Number(selectedPlan.total_tuition)) * 100).toFixed(1)}% Complete</span>
                      <span>{installments.filter(i => i.status === 'Paid').length} of {installments.length} installments paid</span>
                    </div>
                  </div>
                </div>

                {/* Installments Schedule */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Installment Schedule</h3>
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
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {(isEditingInstallments ? editedInstallments : installments).map((installment, index) => (
                      <div
                        key={installment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                            <span className="text-xs text-muted-foreground">No.</span>
                            <span className="font-bold text-primary">{installment.installment_number}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">
                              Installment #{installment.installment_number}
                            </p>
                            {!isEditingInstallments ? (
                              <>
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  Due: {toIsoDate(installment.due_date) || '-'}
                                  {installment.paid_date && (
                                    <span className="text-green-600">
                                      • Paid: {toIsoDate(installment.paid_date) || '-'}
                                    </span>
                                  )}
                                </p>
                                {installment.days_overdue > 0 && (
                                  <p className="text-xs text-red-600">
                                    {installment.days_overdue} days overdue
                                    {installment.late_fee > 0 && ` • Late fee: ₱${installment.late_fee.toFixed(2)}`}
                                  </p>
                                )}
                              </>
                            ) : (
                              <div className="flex gap-2 mt-2">
                                <div>
                                  <Label className="text-xs">Due Date</Label>
                                  <Input
                                    type="date"
                                    value={installment.due_date}
                                    onChange={(e) => handleInstallmentChange(index, 'due_date', e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Amount</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={installment.amount_due}
                                    onChange={(e) => handleInstallmentChange(index, 'amount_due', parseFloat(e.target.value))}
                                    className="h-8 text-sm w-32"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isEditingInstallments && (
                          <div className="text-right">
                            <p className="font-semibold">
                              ₱{Number(installment.amount_due).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </p>
                            {installment.amount_paid > 0 && (
                              <p className="text-sm text-green-600">
                                Paid: ₱{Number(installment.amount_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                            {installment.balance > 0 && (
                              <p className="text-sm text-orange-600 font-medium">
                                Balance: ₱{Number(installment.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={getInstallmentStatusBadge(installment.status)}>
                                {installment.status}
                              </Badge>
                              {(installment.status === 'Pending' || installment.status === 'Partial' || installment.status === 'Overdue') && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handlePayInstallment(installment)}
                                  className="ml-2"
                                >
                                  <Coins className="h-3 w-3 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {installments.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No installments found for this plan
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-semibold">Record Installment Payment</DialogTitle>
            </DialogHeader>
            {selectedInstallment && selectedPlan && (
              <div className="space-y-4 py-4">
                {/* Installment Info */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Student</p>
                      <p className="font-semibold">{selectedPlan.student_name}</p>
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
                      <p className="font-medium">{toIsoDate(selectedInstallment.due_date) || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount Due</p>
                      <p className="font-medium">₱{Number(selectedInstallment.amount_due).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-medium text-orange-600">₱{Number(selectedInstallment.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
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
                    max={selectedInstallment.balance}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum: ₱{Number(selectedInstallment.balance).toFixed(2)}
                  </p>
                </div>

                <div>
                  <Label>Payment Method *</Label>
                  <Select 
                    value={paymentForm.payment_method} 
                    onValueChange={async (v) => {
                      const newForm = { ...paymentForm, payment_method: v };
                      // Auto-generate invoice for Cash payments
                      if (v === "Cash") {
                        newForm.reference_number = await generateInvoiceNumber();
                      } else if (paymentForm.payment_method === "Cash") {
                        // Clear reference number when switching from Cash to other methods
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
                    placeholder="Check number, Transaction ID, etc."
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
      </div>
    </DashboardLayout>
  );
}
