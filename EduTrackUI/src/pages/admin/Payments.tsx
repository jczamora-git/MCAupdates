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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Coins,
  Search,
  Filter,
  Download,
  Plus,
  Receipt,
  Calendar,
  User,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Edit,
  TrendingUp,
  Wallet,
  FileText,
  Settings,
  X,
  Trash2,
  Save,
  CalendarClock,
  Tag,
  ChevronDown,
  Package,
  Shirt,
  GraduationCap,
  HandCoins,
  CalendarDays,
  BookOpen,
  Layers,
  MoreHorizontal,
  Loader2,
  QrCode,
  RotateCcw
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";
import DiscountDialog from "@/components/admin/payments/DiscountDialog";
import { Pagination } from "@/components/Pagination";
import { useManilaTime } from "@/hooks/useManilaTime";

type Payment = {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  enrollment_id?: string;
  academic_period: string;
  academic_period_id: string;
  receipt_number: string;
  payment_type: string;
  payment_for: string;
  amount: number;
  net_amount?: number;
  total_discount?: number;
  payment_method: string;
  payment_date: string;
  reference_number?: string;
  status: string;
  proof_of_payment_url?: string;
  is_refund: boolean;
  has_been_refunded?: boolean;
  original_payment_id?: string;
  remarks?: string;
  received_by_name?: string;
  verified_by_name?: string;
  verified_at?: string;
  is_recurring_service?: boolean;
  service_period_month?: number;
  service_period_year?: number;
};

type Student = {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  year_level: string;
  enrollment_id?: string; // For filtering enrolled students
};

type AcademicPeriod = {
  id: string;
  school_year: string;
  quarter: string;
  status: 'active' | 'past' | 'upcoming';
  description?: string;
};

type SchoolFee = {
  id: string;
  academic_period_id: string;
  academic_period?: string;
  year_level: string | null; // null means all grades, otherwise specific grade
  year_levels?: string[]; // array of applicable grades
  fee_type: string;
  fee_name: string;
  amount: number;
  is_required: boolean;
  due_date?: string;
  is_active: boolean;
  description?: string;
  grouped_ids?: string[]; // IDs of all fees grouped together
};

type Discount = {
  id: string;
  student_id: string;
  student_name?: string;
  academic_period_id: string;
  academic_period?: string;
  discount_type: string;
  discount_name: string;
  discount_amount: number | null;
  discount_percentage: number | null;
  applies_to: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  valid_from?: string;
  valid_until?: string;
  remarks?: string;
};

type DiscountTemplate = {
  id: string;
  name: string;
  type: 'Scholarship' | 'Sibling' | 'Staff' | 'Early Bird' | 'Other';
  value: number;
  value_type: 'Percentage' | 'Fixed Amount';
  description?: string;
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

const UNREAD_PAYMENT_NOTIFICATIONS_POLL_MS = 90 * 1000;

// Payment types for creating NEW payments (Tuition Installment removed - created via Payment Plans)
const PAYMENT_TYPES = [
  "Tuition Full Payment",
  "Miscellaneous",
  "Contribution",
  "Event Fee",
  "Book",
  "Uniform",
  "Other"
];

const PAYMENT_TYPE_PICKER_OPTIONS = [
  {
    value: "Tuition Full Payment",
    label: "Tuition",
    icon: GraduationCap,
    className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
  },
  {
    value: "Miscellaneous",
    label: "Miscellaneous",
    icon: Layers,
    className: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
  },
  {
    value: "Contribution",
    label: "Contribution",
    icon: HandCoins,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
  },
  {
    value: "Event Fee",
    label: "Event Fee",
    icon: CalendarDays,
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
  },
  {
    value: "Book",
    label: "Book",
    icon: BookOpen,
    className: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
  },
  {
    value: "Uniform",
    label: "Uniform",
    icon: Shirt,
    className: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
  },
  {
    value: "Other",
    label: "Other",
    icon: MoreHorizontal,
    className: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
  }
];

const FEE_TYPES = [
  "Service Fee",
  "Miscellaneous",
  "Contribution",
  "Event Fee",
  "Book",
  "Other"
];

const YEAR_LEVELS = [
  "All Grades",
  "Nursery 1",
  "Nursery 2",
  "Kinder",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6"
];

const PAYMENT_METHODS = [
  { value: "Cash", label: "Cash", enabled: true },
  { value: "GCash", label: "GCash", enabled: true },
  { value: "Check", label: "Check", enabled: true },
  { value: "Bank Transfer", label: "Bank Transfer", enabled: false },
  { value: "PayMaya", label: "PayMaya", enabled: false },
  { value: "Others", label: "Others", enabled: false }
];

const PAYMENT_STATUS = [
  "Pending",
  "Verified",
  "Approved",
  "Rejected"
];

const DISCOUNT_TYPES = [
  "Scholarship",
  "Sibling",
  "Early Bird",
  "Staff",
  "Other"
];

const DISCOUNT_APPLIES_TO = [
  "Tuition",
  "All Fees",
  "Miscellaneous",
  "Specific Fee"
];

const DISCOUNT_STATUS = [
  "Active",
  "Expired",
  "Revoked"
];

// Mock Discounts Data - REMOVED (use database instead)

// Mock data - REMOVED (use database instead)

// Mock School Fees Data - REMOVED (use database instead)

const Payments = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedPaymentRef = useRef<HTMLTableRowElement>(null);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { toIsoDate, formatDateTimeDisplay, todayIsoManila } = useManilaTime();

  const highlightedPaymentId = searchParams.get("highlight");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [academicPeriods, setAcademicPeriods] = useState<AcademicPeriod[]>([]);
  const [schoolFees, setSchoolFees] = useState<SchoolFee[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountTemplates, setDiscountTemplates] = useState<DiscountTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [viewMode, setViewMode] = useState<"payments" | "refunds">("payments"); // Toggle between payments and refunds
  const [summaryView, setSummaryView] = useState<"payment" | "fee">("payment");

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetPayment, setRejectTargetPayment] = useState<Payment | null>(null);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundTargetPayment, setRefundTargetPayment] = useState<Payment | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountDialogPayment, setDiscountDialogPayment] = useState<Payment | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // School Fees Panel
  const [isFeesPanelOpen, setIsFeesPanelOpen] = useState(false);
  const [feesSearchQuery, setFeesSearchQuery] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState("all");
  const [yearLevelFilter, setYearLevelFilter] = useState("all");
  const [isEditingFee, setIsEditingFee] = useState(false);
  const [selectedFee, setSelectedFee] = useState<SchoolFee | null>(null);
  const [feeForm, setFeeForm] = useState({
    fee_type: "Miscellaneous",
    fee_name: "",
    year_levels: [] as string[],
    amount: "",
    is_required: true,
    is_active: true,
    is_recurring: false,
    due_date: "",
    description: ""
  });

  // Discounts Panel
  const [isDiscountsPanelOpen, setIsDiscountsPanelOpen] = useState(false);
  const [discountsSearchQuery, setDiscountsSearchQuery] = useState("");
  const [discountTypeFilter, setDiscountTypeFilter] = useState("all");
  const [discountStatusFilter, setDiscountStatusFilter] = useState("all");
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountTemplate | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [paymentStudentSearchQuery, setPaymentStudentSearchQuery] = useState("");
  const [showPaymentStudentSuggestions, setShowPaymentStudentSuggestions] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    name: "",
    discount_type: "Scholarship",
    value_type: "Percentage" as "Percentage" | "Fixed Amount",
    value: "",
    description: "",
    is_active: true
  });

  // Form
  const [form, setForm] = useState({
    student_id: "",
    enrollment_id: "",
    academic_period_id: "",
    payment_type: "",
    payment_for: "",
    amount: "",
    payment_method: "Cash",
    payment_date: todayIsoManila(),
    reference_number: "",
    status: "Approved",
    remarks: "",
    proof_of_payment_url: ""
  });

  // Selected discounts for current payment
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);

  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [paidServicePeriods, setPaidServicePeriods] = useState<{month: number, year: number}[]>([]);

  // GCash session state (for payment modal)
  const [gcashToken, setGcashToken] = useState<string | null>(null);
  const [gcashSessionLoading, setGcashSessionLoading] = useState(false);
  const [gcashProofReceived, setGcashProofReceived] = useState(false);
  const [unreadPaymentNotifications, setUnreadPaymentNotifications] = useState<NotificationRow[]>([]);

  const isGcashUploaderReady = Boolean(form.student_id && form.payment_for);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  const getNetAmount = (payment: Payment) =>
    Number(payment.net_amount ?? payment.amount ?? 0);

  // Calculate discounted amount based on selected discounts
  const calculateDiscountedAmount = (): { originalAmount: number; totalDiscount: number; finalAmount: number } => {
    const originalAmount = parseFloat(form.amount) || 0;
    let totalDiscount = 0;

    selectedDiscountIds.forEach(discountId => {
      const discount = discountTemplates.find(d => d.id === discountId);
      if (discount && discount.is_active) {
        if (discount.value_type === "Percentage") {
          totalDiscount += (originalAmount * parseFloat(discount.value.toString())) / 100;
        } else {
          totalDiscount += parseFloat(discount.value.toString());
        }
      }
    });

    const finalAmount = Math.max(0, originalAmount - totalDiscount);
    return { originalAmount, totalDiscount, finalAmount };
  };

  // Group fees that have the same properties but different year levels
  const groupFeesByProperties = (fees: SchoolFee[]): SchoolFee[] => {
    const grouped = new Map<string, SchoolFee>();

    fees.forEach(fee => {
      // Create a key based on fee properties (excluding id and year_level)
      const key = `${fee.academic_period_id}-${fee.fee_type}-${fee.fee_name}-${fee.amount}-${fee.is_required}-${fee.description || ''}`;
      
      if (grouped.has(key)) {
        // Merge year levels
        const existing = grouped.get(key)!;
        const existingLevels = existing.year_levels || (existing.year_level ? [existing.year_level] : []);
        const newLevels = fee.year_levels || (fee.year_level ? [fee.year_level] : []);
        
        // Combine and deduplicate year levels
        const combinedLevels = [...new Set([...existingLevels, ...newLevels])];
        
        // Store all IDs for later reference (we'll use the first one as primary, but keep track of all)
        if (!existing.grouped_ids) {
          existing.grouped_ids = [existing.id];
        }
        existing.grouped_ids.push(fee.id);
        
        existing.year_levels = combinedLevels;
        // If all levels covered, set year_level to null
        if (combinedLevels.length === 0) {
          existing.year_level = null;
        }
      } else {
        // First occurrence of this fee
        const yearLevels = fee.year_levels || (fee.year_level ? [fee.year_level] : []);
        grouped.set(key, {
          ...fee,
          year_levels: yearLevels,
          grouped_ids: [fee.id] // Track all IDs that were grouped
        });
      }
    });

    return Array.from(grouped.values());
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
    } else {
      fetchData();
    }
  }, [isAuthenticated, user, navigate]);

  // Auto-populate payment_for and amount when enrollment is selected for Tuition Full Payment
  useEffect(() => {
    if (!isCreateOpen || isEditOpen) return;

    if (form.payment_type === "Tuition Full Payment" && form.enrollment_id && form.student_id) {
      // Get the selected enrollment's grade level
      const enrollment = enrollments.find((e: any) => String(e.id) === String(form.enrollment_id));
      const gradeLevel = enrollment?.grade_level || enrollment?.year_level;
      
      if (gradeLevel) {
        // Find tuition fee for this grade level
        const tuitionFee = schoolFees.find(
          f => f.fee_type === 'Tuition' && 
               f.is_active && 
               (f.year_level === gradeLevel || 
                (f.year_levels && f.year_levels.includes(gradeLevel)) ||
                !f.year_level)
        );
        
        if (tuitionFee) {
          setForm(prev => ({
            ...prev,
            payment_for: tuitionFee.fee_name,
            amount: tuitionFee.amount.toString()
          }));
        }
      }
    } else if (form.payment_type && form.payment_type !== "Tuition Full Payment") {
      // Reset payment_for and amount when payment type changes
      setForm(prev => ({
        ...prev,
        payment_for: "",
        amount: ""
      }));
    }
  }, [form.payment_type, form.enrollment_id, form.student_id, schoolFees, enrollments, isCreateOpen, isEditOpen]);

  // Auto-apply Full Payment Discount for Tuition Full Payment
  useEffect(() => {
    if (form.payment_type === "Tuition Full Payment") {
      const fullPaymentDiscount = discountTemplates.find(
        d => d.name === "Full Payment Discount" && d.is_active
      );
      
      if (fullPaymentDiscount && !selectedDiscountIds.includes(fullPaymentDiscount.id)) {
        setSelectedDiscountIds(prev => [...prev, fullPaymentDiscount.id]);
      }
    } else {
      // Clear Full Payment Discount when switching away from Tuition Full Payment
      const fullPaymentDiscount = discountTemplates.find(
        d => d.name === "Full Payment Discount"
      );
      if (fullPaymentDiscount) {
        setSelectedDiscountIds(prev => prev.filter(id => id !== fullPaymentDiscount.id));
      }
    }
  }, [form.payment_type, discountTemplates]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch payments from API
      try {
        const paymentsRes = await apiGet(API_ENDPOINTS.PAYMENTS);
        if (paymentsRes && paymentsRes.success) {
          setPayments(paymentsRes.data || []);
        } else {
          setPayments([]);
        }
      } catch (err) {
        console.error('Error fetching payments:', err);
        setPayments([]);
      }

      // Fetch payment plans to filter out students who already have plans
      try {
        const plansRes = await apiGet(API_ENDPOINTS.PAYMENT_PLANS);
        if (plansRes && plansRes.success) {
          setPaymentPlans(plansRes.data || []);
        }
      } catch (err) {
        console.error('Error fetching payment plans:', err);
        setPaymentPlans([]);
      }

      // Fetch students and enrollees (for discount assignment)
      try {
        const studentsRes = await apiGet(`${API_ENDPOINTS.STUDENTS_ENROLLEES}`);
        const studentRows = studentsRes?.data || studentsRes?.students || [];
        setStudents(studentRows);
      } catch (err) {
        console.error('Error fetching students and enrollees:', err);
        // Use empty array as fallback
        setStudents([]);
      }

      // Fetch enrollments (for tuition payments)
      try {
        const enrollmentsRes = await apiGet(API_ENDPOINTS.ADMIN_ENROLLMENTS);
        const enrollmentRows = enrollmentsRes?.data || enrollmentsRes?.enrollments || [];
        setEnrollments(enrollmentRows);
      } catch (err) {
        console.error('Error fetching enrollments:', err);
        setEnrollments([]);
      }

      // Fetch academic periods
      const periodsRes = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS);
      const periods = periodsRes?.data || periodsRes?.periods || [];
      setAcademicPeriods(periods);

      // Fetch school fees
      try {
        const feesRes = await apiGet(API_ENDPOINTS.SCHOOL_FEES);
        if (feesRes && feesRes.success && feesRes.data) {
          // Filter out inactive fees - DO NOT group for payment form to work correctly
          const activeFees = feesRes.data.filter((fee: SchoolFee) => fee.is_active);
          setSchoolFees(activeFees);
        }
      } catch (err) {
        console.error('Error fetching school fees:', err);
        setSchoolFees([]);
      }

      // Fetch discount templates
      try {
        const discountsRes = await apiGet(API_ENDPOINTS.DISCOUNT_TEMPLATES);
        if (discountsRes && discountsRes.success) {
          setDiscountTemplates(discountsRes.data || []);
        }
      } catch (err) {
        console.error('Error fetching discount templates:', err);
        setDiscountTemplates([]);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      showAlert('info', 'Using sample payment data for demonstration');
    } finally {
      setLoading(false);
    }
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

  const generateReceiptNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RCP-${year}${month}-${random}`;
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

  // GCash QR session helpers
  const handleOpenGcashQr = async () => {
    if (!form.student_id) {
      showAlert("error", "Please select a student first");
      return;
    }
    setGcashSessionLoading(true);
    setGcashProofReceived(false);
    try {
      const res = await apiPost(API_ENDPOINTS.GCASH_SESSIONS, {
        user_id: form.student_id,
        amount_due: parseFloat(form.amount) || 0,
        payment_description: form.payment_for || "General Payment",
      });
      if (res.success && res.token) {
        setGcashToken(res.token);
        window.open(`${import.meta.env.BASE_URL}admin/gcash-session/${res.token}`, '_blank');
      } else {
        showAlert("error", res.message || 'Failed to create GCash session');
      }
    } catch {
      showAlert("error", 'Failed to create GCash session');
    } finally {
      setGcashSessionLoading(false);
    }
  };

  useEffect(() => {
    if (!gcashToken) return;
    const handler = (e: StorageEvent) => {
      if (e.key === `gcash_proof_${gcashToken}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.ocr_reference) {
            setForm(prev => ({ ...prev, reference_number: data.ocr_reference }));
          }
          if (data.file_url) {
            setForm(prev => ({ ...prev, proof_of_payment_url: data.file_url }));
          }
          setGcashProofReceived(true);
        } catch {}
        localStorage.removeItem(`gcash_proof_${gcashToken}`);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [gcashToken]);

  const handleOpenCreate = async (paymentType?: string) => {
    const activePeriod = academicPeriods.find(p => p.status === 'active');
    // const invoiceNumber = await generateInvoiceNumber(); // Auto-generate unique invoice for cash - TEMPORARILY DISABLED
    
    setForm({
      student_id: "",
      enrollment_id: "",
      academic_period_id: activePeriod?.id || "",
      payment_type: paymentType || "",
      payment_for: "",
      amount: "",
      payment_method: "Cash",
      payment_date: todayIsoManila(),
      reference_number: "", // invoiceNumber (commented out - use official receipt invoice)
      status: paymentType === "Tuition Full Payment" ? "Pending" : "Approved",
      remarks: "",
      proof_of_payment_url: ""
    });
    
    // Auto-apply Full Payment Discount for Tuition Full Payment
    if (paymentType === "Tuition Full Payment") {
      const fullPaymentDiscount = discountTemplates.find(
        d => d.name === "Full Payment Discount" && d.is_active
      );
      if (fullPaymentDiscount) {
        setSelectedDiscountIds([fullPaymentDiscount.id]);
      } else {
        setSelectedDiscountIds([]);
      }
    } else {
      setSelectedDiscountIds([]);
    }
    
    setPaymentStudentSearchQuery("");
    setShowPaymentStudentSuggestions(false);
    setGcashToken(null);
    setGcashProofReceived(false);
    setIsCreateOpen(true);
  };

  const handleOpenTypePicker = () => {
    setIsTypePickerOpen(true);
  };

  const handleCreate = async () => {
    if (!form.student_id || !form.amount || !form.payment_for) {
      showAlert("error", "Please fill in all required fields");
      return;
    }

    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        enrollment_id: form.enrollment_id || null,
        reference_number: form.reference_number || null,
        remarks: form.remarks || null,
        proof_of_payment_url: form.proof_of_payment_url || null,
        receipt_number: generateReceiptNumber(),
        discount_template_ids: selectedDiscountIds.length > 0 ? selectedDiscountIds : null
      };

      const res = await apiPost('/api/payments', payload);
      if (res && res.success) {
        showAlert("success", "Payment recorded successfully");
        setIsCreateOpen(false);
        fetchData();
      } else {
        showAlert("error", res.message || "Failed to create payment");
      }
    } catch (error: any) {
      showAlert("error", error.message || "Error creating payment");
    }
  };

  const handleOpenEdit = (payment: Payment) => {
    setSelectedPayment(payment);
    setForm({
      student_id: payment.student_id,
      enrollment_id: payment.enrollment_id || "",
      academic_period_id: payment.academic_period_id || payment.academic_period || "",
      payment_type: payment.payment_type,
      payment_for: payment.payment_for,
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
      payment_date: toIsoDate(payment.payment_date) || todayIsoManila(),
      reference_number: payment.reference_number || "",
      status: payment.status,
      remarks: payment.remarks || "",
      proof_of_payment_url: payment.proof_of_payment_url || ""
    });
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedPayment) return;

    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        enrollment_id: form.enrollment_id || null,
        reference_number: form.reference_number || null,
        remarks: form.remarks || null,
        proof_of_payment_url: form.proof_of_payment_url || null
      };

      const res = await apiPut(`/api/payments/${selectedPayment.id}`, payload);
      if (res && res.success) {
        showAlert("success", "Payment updated successfully");
        setIsEditOpen(false);
        setSelectedPayment(null);
        fetchData();
      } else {
        showAlert("error", res.message || "Failed to update payment");
      }
    } catch (error: any) {
      showAlert("error", error.message || "Error updating payment");
    }
  };

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsViewOpen(true);
  };

  const markPaymentNotificationsAsRead = async (paymentId: string) => {
    let backendMessage = "";

    try {
      const byPaymentRes = await apiPost(API_ENDPOINTS.PAYMENT_MARK_NOTIFICATIONS_READ(paymentId), {});
      if (byPaymentRes?.success && Number(byPaymentRes?.marked_count || 0) > 0) {
        await refreshUnreadPaymentNotifications();
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'payment-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'sidebar-unread-snapshot'] });
        queryClient.refetchQueries({ queryKey: ['notifications', 'sidebar-unread-snapshot'] });
        return;
      }

      if (byPaymentRes?.message) {
        backendMessage = String(byPaymentRes.message);
      }
    } catch (err: any) {
      backendMessage = err?.message || 'request failed';
    }

    let candidateIds = unreadPaymentNotifications
      .filter((row) => String(row.entity_id || "") === String(paymentId))
      .map((row) => String(row.id || ""))
      .filter(Boolean);

    if (candidateIds.length === 0) {
      try {
        const unreadRes = await apiGet(`${API_ENDPOINTS.NOTIFICATIONS}?unread_only=true&limit=100`);
        const unreadRows = Array.isArray(unreadRes?.data) ? unreadRes.data : [];
        candidateIds = unreadRows
          .filter((row: any) => {
            const entityType = String(row?.entity_type || "").toLowerCase();
            const rowEntityId = String(row?.entity_id || "");
            const actionUrl = String(row?.action_url || "").toLowerCase();
            const type = String(row?.type || "").toLowerCase();
            return (
              rowEntityId === String(paymentId) &&
              (
                actionUrl.includes('/admin/payments') ||
                entityType === 'payment' ||
                entityType === 'payments' ||
                type.includes('payment')
              )
            );
          })
          .map((row: any) => String(row.id || ""))
          .filter(Boolean);
      } catch {
        // best-effort fallback
      }
    }

    for (const notifId of Array.from(new Set(candidateIds))) {
      try {
        await apiPost(API_ENDPOINTS.NOTIFICATION_MARK_AS_READ(notifId), {});
      } catch {
        // best-effort mark read
      }
    }

    if (!candidateIds.length && backendMessage) {
      console.warn('No payment notification candidates found:', backendMessage);
    }

    await refreshUnreadPaymentNotifications();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'payment-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'sidebar-unread-snapshot'] });
    queryClient.refetchQueries({ queryKey: ['notifications', 'sidebar-unread-snapshot'] });
  };

  const handleVerifyPayment = async (paymentId: string) => {
    const ok = await confirm({
      title: 'Verify Payment',
      description: 'Mark this payment as verified?',
      confirmText: 'Verify',
      cancelText: 'Cancel',
      variant: 'default'
    });

    if (!ok) return;

    try {
      const res = await apiPut(`/api/payments/${paymentId}`, {
        status: 'Verified',
        verified_by: user?.id,
        verified_at: new Date().toISOString()
      });

      if (res && res.success) {
        showAlert("success", "Payment verified successfully");
        fetchData();
        await markPaymentNotificationsAsRead(paymentId);
      }
    } catch (error: any) {
      showAlert("error", error.message || "Error verifying payment");
    }
  };

  const handleApprovePayment = async (paymentId: string, paymentMethod: string) => {
    const ok = await confirm({
      title: 'Approve Payment',
      description: 'Approve this payment now?',
      confirmText: 'Approve',
      cancelText: 'Cancel',
      variant: 'default'
    });

    if (!ok) return;

    try {
      let payload: any = {
        status: 'Approved'
      };

      // If Cash payment, update received_by
      if (paymentMethod === 'Cash') {
        payload.received_by = user?.id;
      }

      // If GCash payment, update verified_by, verified_at, and set status to Verified
      if (paymentMethod === 'GCash') {
        payload.status = 'Verified';
        payload.verified_by = user?.id;
        payload.verified_at = new Date().toISOString();
      }

      const res = await apiPut(`/api/payments/${paymentId}`, payload);

      if (res && res.success) {
        const message = paymentMethod === 'GCash' 
          ? "Payment verified successfully" 
          : "Payment approved successfully";
        showAlert("success", message);
        fetchData();
        await markPaymentNotificationsAsRead(paymentId);
      }
    } catch (error: any) {
      showAlert("error", error.message || "Error approving payment");
    }
  };

  const handleOpenRejectPayment = (payment: Payment) => {
    setRejectTargetPayment(payment);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  const handleRejectPayment = async () => {
    if (!rejectTargetPayment) return;

    const reason = rejectReason.trim();
    if (!reason) {
      showAlert("error", "Please enter a reason for rejection");
      return;
    }

    try {
      const res = await apiPut(`/api/payments/${rejectTargetPayment.id}`, {
        status: 'Rejected',
        remarks: reason
      });

      if (res && res.success) {
        showAlert("success", "Payment rejected successfully");
        setIsRejectOpen(false);
        setRejectTargetPayment(null);
        setRejectReason("");
        fetchData();
        await markPaymentNotificationsAsRead(String(rejectTargetPayment.id));
      } else {
        showAlert("error", res?.message || "Failed to reject payment");
      }
    } catch (error: any) {
      showAlert("error", error.message || "Error rejecting payment");
    }
  };

  const handleOpenRefundPayment = (payment: Payment) => {
    setRefundTargetPayment(payment);
    setRefundReason("");
    setRefundAmount(getNetAmount(payment).toFixed(2));
    setIsRefundOpen(true);
  };

  const handleRefundPayment = async () => {
    if (!refundTargetPayment) return;

    const amount = parseFloat(refundAmount);
    const reason = refundReason.trim();
    const maxRefundable = getNetAmount(refundTargetPayment);

    if (!amount || amount <= 0) {
      showAlert("error", "Please enter a valid refund amount");
      return;
    }

    if (amount > maxRefundable) {
      showAlert("error", `Refund amount cannot exceed ₱${maxRefundable.toFixed(2)}`);
      return;
    }

    if (!reason) {
      showAlert("error", "Please enter a reason for refund");
      return;
    }

    try {
      const res = await apiPost(`/api/payments/${refundTargetPayment.id}/refund`, {
        amount,
        reason,
        payment_date: todayIsoManila(),
        received_by: user?.id
      });

      if (res?.success) {
        showAlert("success", "Refund created successfully");
        setIsRefundOpen(false);
        setRefundReason("");
        setRefundAmount("");
        setRefundTargetPayment(null);
        fetchData();
      } else {
        showAlert("error", res?.message || "Failed to create refund");
      }
    } catch (error: any) {
      showAlert("error", error.message || "Error creating refund");
    }
  };

  // School Fees Handlers
  const handleOpenFeesPanel = () => {
    setIsFeesPanelOpen(true);
    setIsDiscountsPanelOpen(false); // Close discounts panel
    resetFeeForm();
  };

  const resetFeeForm = () => {
    setFeeForm({
      fee_type: "Miscellaneous",
      fee_name: "",
      year_levels: [],
      amount: "",
      is_required: true,
      is_active: true,
      is_recurring: false,
      due_date: "",
      description: ""
    });
    setIsEditingFee(false);
    setSelectedFee(null);
  };

  const handleEditFee = (fee: SchoolFee) => {
    // If it's a Tuition fee, redirect to tuition-packages page
    if (fee.fee_type === 'Tuition') {
      navigate('/admin/tuition-packages');
      return;
    }
    
    setSelectedFee(fee);
    
    // Build year_levels array from the fee
    let yearLevels: string[] = [];
    if (fee.year_levels && fee.year_levels.length > 0) {
      // Use the year_levels array if available
      yearLevels = fee.year_levels;
    } else if (fee.year_level) {
      // Single year level
      yearLevels = [fee.year_level];
    } else {
      // All grades (null year_level)
      yearLevels = ["All Grades"];
    }
    
    setFeeForm({
      fee_type: fee.fee_type,
      fee_name: fee.fee_name,
      year_levels: yearLevels,
      amount: fee.amount.toString(),
      is_required: fee.is_required,
      is_active: fee.is_active,
      is_recurring: (fee as any).is_recurring || false,
      due_date: fee.due_date || "",
      description: fee.description || ""
    });
    setIsEditingFee(true);
  };

  const handleSaveFee = async () => {
    if (!feeForm.fee_name || !feeForm.amount) {
      showAlert("error", "Please fill in fee name and amount");
      return;
    }

    if (feeForm.year_levels.length === 0) {
      showAlert("error", "Please select at least one year level");
      return;
    }

    try {
      // Simplified payload - no academic_period_id needed (fees are reusable)
      const payload = {
        fee_type: feeForm.fee_type,
        fee_name: feeForm.fee_name,
        year_levels: feeForm.year_levels,
        amount: parseFloat(feeForm.amount),
        is_required: feeForm.is_required ? 1 : 0,
        is_active: feeForm.is_active ? 1 : 0,
        is_recurring: feeForm.is_recurring ? 1 : 0,
        due_date: feeForm.due_date || null,
        description: feeForm.description || null
      };

      if (isEditingFee && selectedFee) {
        // EDIT MODE: Simple update - let backend handle the logic
        const res = await apiPut(API_ENDPOINTS.SCHOOL_FEE_BY_ID(selectedFee.id), payload);

        if (res && res.success) {
          showAlert("success", "Fee updated successfully");
          fetchData();
          resetFeeForm();
        } else {
          showAlert("error", res?.message || "Failed to update fee");
        }
      } else {
        // CREATE MODE
        const res = await apiPost(API_ENDPOINTS.SCHOOL_FEES, payload);

        if (res && res.success) {
          showAlert("success", "Fee added successfully");
          fetchData();
          resetFeeForm();
        } else {
          showAlert("error", res?.message || "Failed to save fee");
        }
      }
    } catch (error: any) {
      console.error('Error saving fee:', error);
      showAlert("error", error?.message || "Error saving fee");
    }
  };

  const handleDeleteFee = async (feeId: string) => {
    const fee = schoolFees.find(f => f.id === feeId);
    const ok = await confirm({
      title: 'Delete School Fee',
      description: `Are you sure you want to delete "${fee?.fee_name}"?${fee?.grouped_ids && fee.grouped_ids.length > 1 ? ` This will delete ${fee.grouped_ids.length} fee record(s).` : ''}`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive'
    });

    if (!ok) return;

    try {
      // If this is a grouped fee, delete all grouped records
      if (fee?.grouped_ids && fee.grouped_ids.length > 0) {
        for (const groupedId of fee.grouped_ids) {
          await apiDelete(API_ENDPOINTS.SCHOOL_FEE_BY_ID(groupedId));
        }
      } else {
        await apiDelete(API_ENDPOINTS.SCHOOL_FEE_BY_ID(feeId));
      }
      
      showAlert("success", "Fee deleted successfully");
      fetchData(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting fee:', error);
      showAlert("error", error?.message || "Error deleting fee");
    }
  };

  const handleToggleFeeStatus = async (feeId: string) => {
    try {
      const fee = schoolFees.find(f => f.id === feeId);
      
      // If this is a grouped fee, toggle all grouped records
      if (fee?.grouped_ids && fee.grouped_ids.length > 0) {
        for (const groupedId of fee.grouped_ids) {
          await apiPut(API_ENDPOINTS.SCHOOL_FEES_TOGGLE_STATUS(groupedId), {});
        }
      } else {
        await apiPut(API_ENDPOINTS.SCHOOL_FEES_TOGGLE_STATUS(feeId), {});
      }
      
      showAlert("success", `Fee ${fee?.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchData(); // Refresh the list
    } catch (error: any) {
      console.error('Error toggling fee status:', error);
      showAlert("error", error?.message || "Error updating fee status");
    }
  };

  const fetchDiscountTemplates = async () => {
    try {
      const res = await apiGet(API_ENDPOINTS.DISCOUNT_TEMPLATES);
      if (res.success) {
        setDiscountTemplates(res.data || []);
      }
    } catch (error) {
      console.error("Error fetching discounts:", error);
    }
  };

  // Discount Handlers
  const handleOpenDiscountsPanel = () => {
    setIsDiscountsPanelOpen(true);
    setIsFeesPanelOpen(false); // Close fees panel
    resetDiscountForm();
    fetchDiscountTemplates();
  };

  const resetDiscountForm = () => {
    setDiscountForm({
      name: "",
      discount_type: "Scholarship",
      value_type: "Percentage",
      value: "",
      description: "",
      is_active: true
    });
    setStudentSearchQuery("");
    setShowStudentSuggestions(false);
    setIsEditingDiscount(false);
    setSelectedDiscount(null);
  };

  const handleEditDiscount = (discount: DiscountTemplate) => {
    setSelectedDiscount(discount);
    setDiscountForm({
      name: discount.name,
        discount_type: discount.type,
        value_type: discount.value_type,
        value: discount.value.toString(),
        description: discount.description || "",
        is_active: discount.is_active
      });
      setIsEditingDiscount(true);
    };

    const handleSaveDiscount = async () => {
      if (!discountForm.name || !discountForm.value) {
        showAlert("error", "Please enter a discount name and value");
        return;
      }

      const payload = {
        name: discountForm.name,
        discount_type: discountForm.discount_type,
        value: parseFloat(discountForm.value),
        value_type: discountForm.value_type,
        description: discountForm.description,
        is_active: discountForm.is_active ? 1 : 0
      };

    try {
      if (isEditingDiscount && selectedDiscount) {
        const res = await apiPut(API_ENDPOINTS.DISCOUNT_TEMPLATE_BY_ID(selectedDiscount.id), payload);
        if (res.success) {
           showAlert("success", "Discount updated successfully");
        } else {
           showAlert("error", res.message || "Failed to update");
        }
      } else {
        const res = await apiPost(API_ENDPOINTS.DISCOUNT_TEMPLATES, payload);
        if (res.success) {
           showAlert("success", "Discount added successfully");
        } else {
           showAlert("error", res.message || "Failed to add");
        }
      }
      fetchDiscountTemplates();
      resetDiscountForm();
    } catch (error: any) {
      showAlert("error", error.message || "Error saving discount");
    }
  };

  const handleDeleteDiscount = async (discountId: string) => {
    const discount = discountTemplates.find(d => d.id === discountId);
    const ok = await confirm({
      title: 'Delete Discount Template',
      description: `Are you sure you want to delete "${discount?.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive'
    });

    if (!ok) return;

    try {
      await apiDelete(API_ENDPOINTS.DISCOUNT_TEMPLATE_BY_ID(discountId));
      showAlert("success", "Discount template deleted successfully");
      fetchDiscountTemplates();
    } catch (error: any) {
      console.error('Error deleting discount:', error);
      showAlert("error", error?.message || "Error deleting discount");
    }
  };

  const handleToggleDiscountStatus = async (discountId: string) => {
    try {
      await apiPut(API_ENDPOINTS.DISCOUNT_TEMPLATE_TOGGLE(discountId), {});
      fetchDiscountTemplates();
    } catch (error: any) {
      console.error('Error toggling discount status:', error);
      showAlert("error", error?.message || "Error updating status");
    }
  };

  const refreshUnreadPaymentNotifications = async () => {
    try {
      const res = await apiGet(`${API_ENDPOINTS.NOTIFICATIONS}?unread_only=true&limit=100`);
      const rows = Array.isArray(res?.data) ? res.data : [];
      const filtered = rows.filter((row: any) => {
        const entityType = String(row?.entity_type || "").toLowerCase();
        const actionUrl = String(row?.action_url || "").toLowerCase();
        return (
          (entityType === "payment" || entityType === "payments") &&
          actionUrl.includes("/admin/payments")
        );
      });
      setUnreadPaymentNotifications(filtered);
    } catch {
      setUnreadPaymentNotifications([]);
    }
  };

  useEffect(() => {
    refreshUnreadPaymentNotifications();

    const pollTimer = window.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      refreshUnreadPaymentNotifications();
    }, UNREAD_PAYMENT_NOTIFICATIONS_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, []);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = searchQuery === "" ||
      p.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.student_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.receipt_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = paymentTypeFilter === "all" || p.payment_type === paymentTypeFilter;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;

    const paymentDateIso = toIsoDate(p.payment_date);
    const matchesDate = (!dateFromFilter || paymentDateIso >= dateFromFilter) &&
               (!dateToFilter || paymentDateIso <= dateToFilter);

    // Filter by view mode: payments (is_refund = 0) or refunds (is_refund = 1)
    const matchesViewMode = viewMode === "payments" ? !p.is_refund : p.is_refund;

    return matchesSearch && matchesType && matchesStatus && matchesDate && matchesViewMode;
  });

  const unreadPaymentNotificationsByPaymentId = unreadPaymentNotifications.reduce((acc, notif) => {
    const key = String(notif.entity_id || "");
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {} as Record<string, NotificationRow[]>);

  const unreadHighlightedPaymentIds = new Set(Object.keys(unreadPaymentNotificationsByPaymentId));

  const editPaymentTypeOptions = (() => {
    const options = [...PAYMENT_TYPES];
    const currentType = String(form.payment_type || selectedPayment?.payment_type || "").trim();
    if (currentType && !options.includes(currentType)) {
      options.push(currentType);
    }
    return options;
  })();

  const totalItems = filteredPayments.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, paymentTypeFilter, statusFilter, dateFromFilter, dateToFilter, viewMode]);

  const pagedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (!highlightedPaymentId) return;

    const highlightedIndex = filteredPayments.findIndex(
      (payment) => String(payment.id) === highlightedPaymentId
    );

    if (highlightedIndex === -1) return;

    const targetPage = Math.floor(highlightedIndex / itemsPerPage) + 1;
    if (currentPage !== targetPage) {
      setCurrentPage(targetPage);
    }
  }, [highlightedPaymentId, filteredPayments, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!highlightedPaymentId || !highlightedPaymentRef.current) return;

    const scrollTimer = setTimeout(() => {
      highlightedPaymentRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 250);

    const clearTimer = setTimeout(() => {
      setSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete("highlight");
        return nextParams;
      });
    }, 5000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedPaymentId, currentPage, setSearchParams]);

  // Filtered School Fees - with grouping for display only
  const filteredSchoolFees = (() => {
    const filtered = schoolFees.filter((f) => {
      const matchesSearch = feesSearchQuery === "" ||
        f.fee_name.toLowerCase().includes(feesSearchQuery.toLowerCase()) ||
        (f.description || "").toLowerCase().includes(feesSearchQuery.toLowerCase());

      const matchesType = feeTypeFilter === "all" || f.fee_type === feeTypeFilter;
      const matchesYearLevel = yearLevelFilter === "all" || 
        (yearLevelFilter === "All Grades" && !f.year_level) ||
        f.year_level === yearLevelFilter;

      return matchesSearch && matchesType && matchesYearLevel;
    });
    
    // Group fees for display purposes only
    return groupFeesByProperties(filtered);
  })();

  // Filtered Discounts
const filteredDiscounts = discountTemplates.filter((d) => {
      const matchesSearch = discountsSearchQuery === "" ||
        d.name.toLowerCase().includes(discountsSearchQuery.toLowerCase());

      const matchesStatus = discountStatusFilter === "all" || 
         (discountStatusFilter === "Active" && d.is_active) ||
         (discountStatusFilter !== "Active" && !d.is_active);

      return matchesSearch && matchesStatus;
  });

  // Filtered Students for autocomplete (limit 10)
  const filteredStudentSuggestions = students.filter((s) => {
    if (!studentSearchQuery || studentSearchQuery.trim() === "") return true; // Show all if empty
    const query = studentSearchQuery.toLowerCase();
    return (
      s.student_id?.toLowerCase().includes(query) ||
      s.first_name?.toLowerCase().includes(query) ||
      s.last_name?.toLowerCase().includes(query) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(query)
    );
  }).slice(0, 10);

  // Payment creation (non-tuition) should only use student accounts, not enrollees.
  const paymentEligibleStudents = students.filter((s: any) => {
    const studentId = String(s?.student_id || '').trim();
    return studentId !== '';
  });

  // Get selected student's year level
  const getSelectedStudentYearLevel = (): string | null => {
    if (!form.student_id) return null;

    if (form.payment_type === "Tuition Full Payment" && form.enrollment_id) {
      // For tuition payments, get from enrollment
      const enrollment = enrollments.find((e: any) => String(e.id) === String(form.enrollment_id));
      return enrollment?.grade_level || enrollment?.year_level || null;
    } else {
      // For other payments, get from student
      const student = paymentEligibleStudents.find((s: any) => String(s.user_id) === String(form.student_id));
      return student?.year_level || null;
    }
  };

  // Map payment type to fee type
  const getPaymentTypeToFeeType = (paymentType: string): string => {
    if (paymentType === "Tuition Full Payment" || paymentType === "Tuition Installment") {
      return "Tuition";
    }
    // For other types, they match directly
    return paymentType;
  };

  // Check if payment type has any active fees
  const hasActiveFeesForPaymentType = (paymentType: string): boolean => {
    const feeType = getPaymentTypeToFeeType(paymentType);
    return schoolFees.some(fee => fee.fee_type === feeType && fee.is_active);
  };

  // Check if payment type has any active fees excluding Service Fee
  const hasActiveFeesExcludingServiceFee = (paymentType: string): boolean => {
    const feeType = getPaymentTypeToFeeType(paymentType);
    return schoolFees.some(fee =>
      fee.fee_type === feeType &&
      fee.is_active &&
      fee.fee_type !== 'Service Fee'
    );
  };

  // Filter school fees for payment form based on selected payment type and student year level
  const paymentFormSchoolFees = (() => {
    if (!form.payment_type) {
      return [];
    }

    const feeType = getPaymentTypeToFeeType(form.payment_type);
    const selectedYearLevel = getSelectedStudentYearLevel();

    const filtered = schoolFees.filter(fee => {
      const typeMatch = fee.fee_type === feeType;
      const activeMatch = fee.is_active;

      if (!typeMatch || !activeMatch) {
        return false;
      }

      // If a student is selected, filter by their year level
      if (selectedYearLevel) {
        if (fee.year_levels && fee.year_levels.length > 0) {
          // Fee has specific year levels - check if student's level is included
          return fee.year_levels.includes(selectedYearLevel) || fee.year_levels.includes("All Grades");
        } else if (fee.year_level) {
          // Fee has single year level - check if it matches student's level or is "All Grades"
          return fee.year_level === selectedYearLevel || fee.year_level === "All Grades";
        } else {
          // Fee is for all grades (year_level is null)
          return true;
        }
      }

      // No student selected - show all fees of this type
      return true;
    });

    return filtered;
  })();

  // Filtered Students for payment form autocomplete
  const filteredPaymentStudentSuggestions = (() => {
    // For Tuition Full Payment, use enrollments instead of students
    if (form.payment_type === "Tuition Full Payment") {
      return enrollments.filter((enrollment: any) => {
        // Exclude if enrollment already has a payment plan (ALWAYS check this first)
        const hasPaymentPlan = paymentPlans.some(
          (plan: any) => String(plan.enrollment_id) === String(enrollment.id)
        );
        
        if (hasPaymentPlan) return false;

        // Exclude if enrollment already has a payment record (checks enrollment_id)
        const hasPaymentRecord = payments.some(
          (payment: any) => String(payment.enrollment_id) === String(enrollment.id)
        );
        
        if (hasPaymentRecord) return false;

        // Then filter by search query
        if (!paymentStudentSearchQuery || paymentStudentSearchQuery.trim() === "") return true;
        
        const query = paymentStudentSearchQuery.toLowerCase();
        return enrollment.student_name?.toLowerCase().includes(query);
      }).slice(0, 10);
    }
    
    // For other payment types, use students
    return paymentEligibleStudents.filter((s) => {
      if (!paymentStudentSearchQuery || paymentStudentSearchQuery.trim() === "") return true;
      const query = paymentStudentSearchQuery.toLowerCase();
      return (
        s.student_id?.toLowerCase().includes(query) ||
        s.first_name?.toLowerCase().includes(query) ||
        s.last_name?.toLowerCase().includes(query) ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(query)
      );
    }).slice(0, 10);
  })();

  // Statistics
  // For payments view: exclude refund records AND refunded payments
  // For refunds view: only include refund records
  const paidPayments = viewMode === "payments"
    ? filteredPayments.filter(p => 
        (p.status === 'Approved' || p.status === 'Verified') && !p.is_refund && !p.has_been_refunded
      )
    : filteredPayments.filter(p => 
        (p.status === 'Approved' || p.status === 'Verified') && p.is_refund
      );
  
  const totalPayments = viewMode === "payments"
    ? paidPayments.reduce((sum, p) => sum + getNetAmount(p), 0)
    : paidPayments.reduce((sum, p) => Math.abs(getNetAmount(p)), 0); // Show positive total for refunds
  
  const pendingCount = filteredPayments.filter(p => p.status === 'Pending' && !p.is_refund).length;
  const verifiedCount = filteredPayments.filter(p => p.status === 'Verified' && !p.is_refund).length;
  const approvedCount = filteredPayments.filter(p => p.status === 'Approved' && !p.is_refund && !p.has_been_refunded).length;

  const feeTypeSummary = (() => {
    const totals = {
      tuition: 0,
      serviceFee: 0,
      uniform: 0,
      miscellaneous: 0,
      contribution: 0,
      eventFee: 0,
      book: 0,
      others: 0
    };

    paidPayments.forEach((payment) => {
      const amount = getNetAmount(payment);
      const isServiceFee = payment.payment_type === 'Service Fee';

      if (isServiceFee) {
        totals.serviceFee += amount;
        return;
      }

      if (payment.payment_type === 'Tuition Full Payment' || payment.payment_type === 'Tuition Installment') {
        totals.tuition += amount;
      } else if (payment.payment_type === 'Uniform') {
        totals.uniform += amount;
      } else if (payment.payment_type === 'Miscellaneous') {
        totals.miscellaneous += amount;
      } else if (payment.payment_type === 'Contribution') {
        totals.contribution += amount;
      } else if (payment.payment_type === 'Event Fee') {
        totals.eventFee += amount;
      } else if (payment.payment_type === 'Book') {
        totals.book += amount;
      } else if (payment.payment_type === 'Other') {
        totals.others += amount;
      }
    });

    return [
      { key: 'tuition', label: 'Tuition', total: totals.tuition, className: "bg-gradient-to-br from-blue-50 to-blue-100", iconBg: "bg-blue-200", iconColor: "text-blue-700", icon: GraduationCap },
      { key: 'service_fee', label: 'Service Fee', total: totals.serviceFee, className: "bg-gradient-to-br from-slate-50 to-slate-100", iconBg: "bg-slate-200", iconColor: "text-slate-700", icon: Package },
      { key: 'uniform', label: 'Uniform', total: totals.uniform, className: "bg-gradient-to-br from-rose-50 to-rose-100", iconBg: "bg-rose-200", iconColor: "text-rose-700", icon: Shirt },
      { key: 'miscellaneous', label: 'Miscellaneous', total: totals.miscellaneous, className: "bg-gradient-to-br from-slate-50 to-slate-100", iconBg: "bg-slate-200", iconColor: "text-slate-700", icon: Layers },
      { key: 'contribution', label: 'Contribution', total: totals.contribution, className: "bg-gradient-to-br from-emerald-50 to-emerald-100", iconBg: "bg-emerald-200", iconColor: "text-emerald-700", icon: HandCoins },
      { key: 'event_fee', label: 'Event Fee', total: totals.eventFee, className: "bg-gradient-to-br from-amber-50 to-amber-100", iconBg: "bg-amber-200", iconColor: "text-amber-700", icon: CalendarDays },
      { key: 'book', label: 'Book', total: totals.book, className: "bg-gradient-to-br from-indigo-50 to-indigo-100", iconBg: "bg-indigo-200", iconColor: "text-indigo-700", icon: BookOpen },
      { key: 'others', label: 'Others', total: totals.others, className: "bg-gradient-to-br from-gray-50 to-gray-100", iconBg: "bg-gray-200", iconColor: "text-gray-700", icon: MoreHorizontal }
    ];
  })();

  const getStatusBadge = (payment: Payment) => {
    // Show "Refunded" badge for approved payments that have been refunded (only in payment records view)
    if (viewMode === "payments" && payment.status === 'Approved' && payment.has_been_refunded) {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    }
    
    const variants: Record<string, string> = {
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Verified': 'bg-blue-100 text-blue-800 border-blue-300',
      'Approved': 'bg-green-100 text-green-800 border-green-300',
      'Rejected': 'bg-red-100 text-red-800 border-red-300'
    };
    return variants[payment.status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusText = (payment: Payment) => {
    // Show "Refunded" text for approved payments that have been refunded (only in payment records view)
    if (viewMode === "payments" && payment.status === 'Approved' && payment.has_been_refunded) {
      return 'Refunded';
    }
    return payment.status;
  };

  const getPaymentMethodIcon = (method: string) => {
    if (method === 'Cash') return <Wallet className="h-4 w-4" />;
    if (method.includes('Bank') || method.includes('GCash') || method.includes('PayMaya')) return <CreditCard className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading payments...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Payment Management
            </h1>
            <p className="text-muted-foreground">Track and manage student payments</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Settings Dropdown - School Fees & Discounts */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200 hover:bg-slate-100"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Management
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={handleOpenFeesPanel}
                  className="!bg-white hover:!bg-purple-100 cursor-pointer"
                >
                  <Settings className="h-4 w-4 mr-2 text-purple-600" />
                  <span className="text-purple-700 font-medium">School Fees</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleOpenDiscountsPanel}
                  className="!bg-white hover:!bg-amber-100 cursor-pointer"
                >
                  <Tag className="h-4 w-4 mr-2 text-amber-600" />
                  <span className="text-amber-700 font-medium">Discounts</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => navigate("/admin/tuition-packages")}
                  className="!bg-white hover:!bg-blue-100 cursor-pointer"
                >
                  <Package className="h-4 w-4 mr-2 text-blue-600" />
                  <span className="text-blue-700 font-medium">Tuition Packages</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleOpenTypePicker} className="bg-gradient-to-r from-blue-600 to-cyan-500">
              <Plus className="h-4 w-4 mr-2" />
              New Payment
            </Button>
          </div>
        </div>

        {/* Summary Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={summaryView === "payment" ? "default" : "outline"}
            size="sm"
            onClick={() => setSummaryView("payment")}
          >
            Payment Summary
          </Button>
          <Button
            variant={summaryView === "fee" ? "default" : "outline"}
            size="sm"
            onClick={() => setSummaryView("fee")}
          >
            Fee Summary
          </Button>
        </div>

        {summaryView === "payment" ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className={viewMode === "payments"
              ? "border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100"
              : "border-0 shadow-lg bg-gradient-to-br from-orange-50 to-red-100"
            }>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={viewMode === "payments" ? "text-sm text-blue-600 font-semibold" : "text-sm text-orange-600 font-semibold"}>
                      {viewMode === "payments" ? "Total Collected" : "Total Refunds"}
                    </p>
                    <p className={viewMode === "payments" ? "text-2xl font-bold text-blue-700" : "text-2xl font-bold text-orange-700"}>
                      ₱{Number(totalPayments).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className={viewMode === "payments" ? "w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center" : "w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center"}>
                    <Coins className={viewMode === "payments" ? "h-6 w-6 text-blue-600" : "h-6 w-6 text-orange-600"} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-semibold">Approved</p>
                    <p className="text-2xl font-bold text-green-700">{approvedCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-semibold">Verified</p>
                    <p className="text-2xl font-bold text-blue-700">{verifiedCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600 font-semibold">Pending</p>
                    <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-yellow-200 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {feeTypeSummary.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.key} className={`border-0 shadow-lg ${item.className}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-semibold">{item.label}</p>
                        <p className="text-2xl font-bold text-gray-800">
                          ₱{Number(item.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.iconBg}`}>
                        <Icon className={`h-6 w-6 ${item.iconColor}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student, receipt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Payment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PAYMENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {PAYMENT_STATUS.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                placeholder="From Date"
              />

              <Input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                placeholder="To Date"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {viewMode === "payments" ? "Payment Records" : "Refund Lists"} ({filteredPayments.length})
              </CardTitle>
              <Button
                variant={viewMode === "refunds" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(viewMode === "payments" ? "refunds" : "payments")}
                className={viewMode === "refunds" ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {viewMode === "payments" ? "Show Refunds" : "Show Payments"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt #</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment For</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pagedPayments.map((payment) => {
                    const isHighlighted = highlightedPaymentId === String(payment.id);
                    const isUnreadFromNotification = unreadHighlightedPaymentIds.has(String(payment.id));

                    return (
                    <tr
                      key={payment.id}
                      ref={isHighlighted ? highlightedPaymentRef : null}
                      className={`transition-colors duration-500 ${
                        isHighlighted
                          ? "bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary"
                          : isUnreadFromNotification
                            ? "bg-amber-50/70 hover:bg-amber-100/60"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{payment.receipt_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {payment.student_name}
                              {isUnreadFromNotification && (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-1.5 py-0 h-5">
                                  New
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{payment.student_number}</p>
                            {isHighlighted && (
                              <p className="text-xs font-medium text-primary mt-1">Selected from notification</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <Badge variant="outline" className="text-xs">{payment.payment_type}</Badge>
                          <p className="text-sm text-gray-600 mt-1">{payment.payment_for}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span className="text-sm font-semibold text-gray-900">
                            ₱{getNetAmount(payment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                          {payment.total_discount && payment.total_discount > 0 && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Discount: -₱{Number(payment.total_discount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(payment.payment_method)}
                          <span className="text-sm">{payment.payment_method}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{toIsoDate(payment.payment_date) || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getStatusBadge(payment)}>
                          {getStatusText(payment)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPayment(payment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(payment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {payment.payment_method === 'Cash' && payment.status === 'Pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprovePayment(payment.id, payment.payment_method)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {payment.payment_method !== 'Cash' && payment.status === 'Pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerifyPayment(payment.id)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {payment.payment_method !== 'Cash' && payment.status === 'Verified' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprovePayment(payment.id, payment.payment_method)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {(payment.status === 'Pending' || payment.status === 'Verified') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRejectPayment(payment)}
                              title="Reject Payment"
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                          {payment.status === 'Approved' && !payment.is_refund && !payment.has_been_refunded && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRefundPayment(payment)}
                              title="Refund Payment"
                            >
                              <RotateCcw className="h-4 w-4 text-orange-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredPayments.length === 0 && (
                <div className="text-center py-16">
                  <Receipt className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No payments found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {totalItems > 0 && (
          <div className="mt-6 px-2">
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        )}

        {/* Payment Type Picker */}
        <Dialog open={isTypePickerOpen} onOpenChange={setIsTypePickerOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Select Payment Type</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {/* Service Fee Button - Always shown and redirects to school services */}
              <Button
                type="button"
                variant="outline"
                className="h-20 flex-col gap-2 border bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                onClick={() => {
                  setIsTypePickerOpen(false);
                  navigate('/admin/school-services');
                }}
              >
                <Package className="h-6 w-6" />
                <span className="text-xs font-semibold text-center leading-tight">
                  Service Fee
                </span>
              </Button>

              {/* Other Payment Types - Check for fees excluding Service Fee */}
              {PAYMENT_TYPE_PICKER_OPTIONS.map((option) => {
                const Icon = option.icon;
                // Uniform is always enabled and redirects to uniform orders
                const isUniform = option.value === "Uniform";
                const hasFees = isUniform ? true : hasActiveFeesExcludingServiceFee(option.value);
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    disabled={!hasFees}
                    className={`h-20 flex-col gap-2 border ${option.className} ${!hasFees ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (isUniform) {
                        setIsTypePickerOpen(false);
                        navigate('/admin/uniform-orders');
                      } else if (hasFees) {
                        setIsTypePickerOpen(false);
                        handleOpenCreate(option.value);
                      }
                    }}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-semibold text-center leading-tight">
                      {option.label}
                    </span>
                    {!hasFees && !isUniform && (
                      <span className="text-[10px] text-muted-foreground mt-1">
                        No fees
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Payment Dialog */}
        <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to reject this payment? Please provide a reason.
              </p>
              {rejectTargetPayment && (
                <div className="rounded-md border p-3 bg-muted/40 text-sm">
                  <p><span className="font-medium">Student:</span> {rejectTargetPayment.student_name}</p>
                  <p><span className="font-medium">Receipt:</span> {rejectTargetPayment.receipt_number}</p>
                </div>
              )}
              <div>
                <Label>Rejection Reason *</Label>
                <Textarea
                  placeholder="Enter reason for rejection"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectOpen(false);
                  setRejectReason("");
                  setRejectTargetPayment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectPayment}
              >
                Reject Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Refund Payment Dialog */}
        <Dialog open={isRefundOpen} onOpenChange={setIsRefundOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Refund Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {refundTargetPayment && (
                <div className="rounded-md border p-3 bg-muted/40 text-sm space-y-1">
                  <p><span className="font-medium">Student:</span> {refundTargetPayment.student_name}</p>
                  <p><span className="font-medium">Receipt:</span> {refundTargetPayment.receipt_number}</p>
                  <p><span className="font-medium">Max Refundable:</span> ₱{getNetAmount(refundTargetPayment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
              )}

              <div>
                <Label>Refund Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>

              <div>
                <Label>Refund Reason *</Label>
                <Textarea
                  placeholder="Enter reason for refund"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRefundOpen(false);
                  setRefundReason("");
                  setRefundAmount("");
                  setRefundTargetPayment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRefundPayment}
              >
                Confirm Refund
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Payment Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent onOpenAutoFocus={(e: any) => e.preventDefault()} className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Info Banner for Tuition Full Payment */}
              {form.payment_type === "Tuition Full Payment" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">Tuition Full Payment</h4>
                    <p className="text-sm text-blue-800">
                      Only <strong>enrolled students</strong> can pay full tuition. Student list is filtered to show students with active enrollment records for the selected academic period.
                    </p>
                    <p className="text-xs text-blue-700 mt-2">
                      💡 <em>For installment payments, create a Payment Plan first, then record payments through that plan.</em>
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Label>
                    Student *
                    {form.payment_type === "Tuition Full Payment" && (
                      <span className="text-xs text-muted-foreground ml-2">(Enrolled students only)</span>
                    )}
                  </Label>
                  <Input
                    placeholder={form.payment_type === "Tuition Full Payment" ? "Search enrolled student..." : "Search student by ID or name..."}
                    value={paymentStudentSearchQuery}
                    onChange={(e) => {
                      setPaymentStudentSearchQuery(e.target.value);
                      setShowPaymentStudentSuggestions(true);
                      if (!e.target.value) {
                        setForm({ ...form, student_id: "" });
                      }
                    }}
                    onFocus={() => setShowPaymentStudentSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowPaymentStudentSuggestions(false), 200);
                    }}
                  />
                  {showPaymentStudentSuggestions && filteredPaymentStudentSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredPaymentStudentSuggestions.map((item: any) => {
                        // For Tuition Full Payment, item is enrollment object
                        if (form.payment_type === "Tuition Full Payment") {
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (!item.created_user_id) {
                                  showAlert(
                                    "error",
                                    "This enrollee has no user account yet. Create the user account first before recording tuition payments."
                                  );
                                  return;
                                }
                                // Use created_user_id as student_id for payments
                                setForm({ 
                                  ...form, 
                                  student_id: item.created_user_id.toString(),
                                  enrollment_id: item.id.toString()
                                });
                                setPaymentStudentSearchQuery(item.student_name);
                                setShowPaymentStudentSuggestions(false);
                              }}
                            >
                              <div className="font-medium">
                                {item.student_name}
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {item.status}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.grade_level} • {item.school_year} - {item.quarter}
                              </div>
                            </button>
                          );
                        }
                        
                        // For other payment types, item is student object
                        return (
                          <button
                            key={item.user_id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setForm({ ...form, student_id: item.user_id });
                              setPaymentStudentSearchQuery(
                                `${item.first_name} ${item.last_name} (${item.student_id || 'Enrollee'})`
                              );
                              setShowPaymentStudentSuggestions(false);
                            }}
                          >
                            <div className="font-medium">
                              {item.first_name} {item.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.student_id || "Enrollee"} • {item.year_level || "N/A"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Academic Period *</Label>
                  <Select value={form.academic_period_id} onValueChange={(v) => setForm({ ...form, academic_period_id: v })}>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type *</Label>
                  <Select value={form.payment_type} onValueChange={(v) => {
                    const newForm = { ...form, payment_type: v, status: v === "Tuition Full Payment" ? "Pending" : "Approved" };
                    // Clear enrollment_id when switching away from Tuition Full Payment
                    if (v !== "Tuition Full Payment") {
                      newForm.enrollment_id = "";
                    }
                    setForm(newForm);
                    // Clear student selection when switching payment types
                    setPaymentStudentSearchQuery("");
                    setShowPaymentStudentSuggestions(false);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Payment Method *</Label>
                  <Select 
                    value={form.payment_method} 
                    onValueChange={async (v) => {
                      // const invoiceNumber = v === "Cash" ? await generateInvoiceNumber() : ""; // TEMPORARILY DISABLED
                      setForm({ 
                        ...form, 
                        payment_method: v,
                        reference_number: ""
                      });
                      setGcashToken(null);
                      setGcashProofReceived(false);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem 
                          key={method.value} 
                          value={method.value}
                          disabled={!method.enabled}
                        >
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Payment For *</Label>
                <Select 
                  value={form.payment_for} 
                  onValueChange={(value) => {
                    setForm({ ...form, payment_for: value });
                    // Auto-populate amount based on selected fee
                    const selectedFee = schoolFees.find(f => f.fee_name === value);
                    if (selectedFee) {
                      setForm(prev => ({ ...prev, amount: selectedFee.amount.toString() }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a fee" />
                  </SelectTrigger>
                  <SelectContent>
                    {form.payment_type ? (
                      // Show filtered fees based on payment type
                      paymentFormSchoolFees.length > 0 ? (
                        paymentFormSchoolFees.map((fee) => (
                          <SelectItem key={fee.id} value={fee.fee_name}>
                            {fee.fee_name} - ₱{Number(fee.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-fees-available" disabled>
                          No fees available for {form.payment_type}
                        </SelectItem>
                      )
                    ) : (
                      <SelectItem value="select-payment-type" disabled>
                        Select payment type first
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Payment Date *</Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  />
                </div>
              </div>

              {form.payment_type === "Tuition Full Payment" && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Apply Discounts</Label>
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    {discountTemplates.filter(d => d.is_active).length > 0 ? (
                      <>
                        {discountTemplates.filter(d => d.is_active).map((discount) => {
                          const isSelected = selectedDiscountIds.includes(discount.id);
                          const isFullPaymentDiscount = discount.name === "Full Payment Discount";
                          const isAutoApplied = isFullPaymentDiscount && form.payment_type === "Tuition Full Payment";
                          
                          return (
                            <div
                              key={discount.id}
                              className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`discount-${discount.id}`}
                                  checked={isSelected}
                                  disabled={isAutoApplied}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedDiscountIds(prev => [...prev, discount.id]);
                                    } else {
                                      setSelectedDiscountIds(prev => prev.filter(id => id !== discount.id));
                                    }
                                  }}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`discount-${discount.id}`}
                                    className="cursor-pointer font-medium text-gray-900"
                                  >
                                    {discount.name}
                                    {isAutoApplied && (
                                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        Auto-applied
                                      </span>
                                    )}
                                  </Label>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {discount.type} • {discount.value_type === "Percentage" 
                                      ? `${parseFloat(discount.value.toString())}%` 
                                      : `₱${parseFloat(discount.value.toString()).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                                  </p>
                                  {discount.description && (
                                    <p className="text-xs text-gray-400 mt-1">{discount.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-emerald-600">
                                  -{discount.value_type === "Percentage"
                                    ? `₱${((parseFloat(form.amount) || 0) * parseFloat(discount.value.toString()) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                    : `₱${parseFloat(discount.value.toString()).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Discount Summary */}
                        {selectedDiscountIds.length > 0 && form.amount && (
                          <div className="border-t-2 border-gray-300 pt-3 mt-3">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Original Amount:</span>
                                <span className="font-medium">₱{calculateDiscountedAmount().originalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Discount:</span>
                                <span className="font-medium text-emerald-600">
                                  -₱{calculateDiscountedAmount().totalDiscount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between text-base font-bold border-t pt-2">
                                <span className="text-gray-900">Final Amount:</span>
                                <span className="text-blue-600">
                                  ₱{calculateDiscountedAmount().finalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No active discounts available
                      </p>
                    )}
                  </div>
                </div>
              )}

              {form.payment_method === "GCash" ? (
                <div className="space-y-3">
                  {/* GCash QR uploader */}
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
                      disabled={gcashSessionLoading || !isGcashUploaderReady}
                    >
                      {gcashSessionLoading
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating session…</>
                        : <><QrCode className="h-4 w-4 mr-2" />Open GCash QR Uploader</>}
                    </Button>
                    {!isGcashUploaderReady && (
                      <p className="text-[10px] text-blue-400 mt-1.5 text-center">Select student and payment for first to enable</p>
                    )}
                    {gcashProofReceived && (
                      <div className="mt-2 flex items-center gap-2 text-green-700 text-xs font-medium">
                        <CheckCircle className="h-4 w-4" />
                        Proof received — reference auto-filled below
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>GCash Reference Number</Label>
                    <Input
                      placeholder="Auto-filled from QR upload, or enter manually"
                      value={form.reference_number}
                      onChange={(e) => setForm({ ...form, reference_number: e.target.value.replace(/\D/g, "") })}
                      className="font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label>
                    {form.payment_method === "Cash" ? "Invoice Number" : "Reference Number"}
                    {form.payment_method !== "Cash" && " (Check #, Transaction ID, etc.)"}
                  </Label>
                  <Input
                    placeholder={form.payment_method === "Cash" ? "Enter official receipt invoice number" : "Enter reference number"}
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label>Payment Status *</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Remarks</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Payment Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type</Label>
                  <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editPaymentTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Payment Dialog */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Receipt Number</Label>
                    <p className="font-semibold">{selectedPayment.receipt_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={getStatusBadge(selectedPayment)}>
                      {getStatusText(selectedPayment)}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Student</Label>
                    <p className="font-semibold">{selectedPayment.student_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedPayment.student_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Amount</Label>
                    <p className="text-2xl font-bold text-green-600">
                      ₱{getNetAmount(selectedPayment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                    {selectedPayment.total_discount && selectedPayment.total_discount > 0 && (
                      <p className="text-sm text-emerald-600 mt-1">
                        Discount Applied: -₱{Number(selectedPayment.total_discount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Payment Type</Label>
                    <p className="font-semibold">{selectedPayment.payment_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Payment Method</Label>
                    <p className="font-semibold">{selectedPayment.payment_method}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Payment For</Label>
                  <p className="font-semibold">{selectedPayment.payment_for}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Payment Date</Label>
                    <p className="font-semibold">{toIsoDate(selectedPayment.payment_date) || '-'}</p>
                  </div>
                  {selectedPayment.reference_number && (
                    <div>
                      <Label className="text-muted-foreground">Reference Number</Label>
                      <p className="font-semibold">{selectedPayment.reference_number}</p>
                    </div>
                  )}
                </div>

                {selectedPayment.remarks && (
                  <div>
                    <Label className="text-muted-foreground">Remarks</Label>
                    <p className="text-sm">{selectedPayment.remarks}</p>
                  </div>
                )}

                {selectedPayment.received_by_name && (
                  <div>
                    <Label className="text-muted-foreground">Received By</Label>
                    <p className="font-semibold">{selectedPayment.received_by_name}</p>
                  </div>
                )}

                {selectedPayment.verified_by_name && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Verified By</Label>
                      <p className="font-semibold">{selectedPayment.verified_by_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Verified At</Label>
                      <p className="font-semibold">
                        {selectedPayment.verified_at ? formatDateTimeDisplay(selectedPayment.verified_at) : '-'}
                      </p>
                    </div>
                  </div>
                )}

                {selectedPayment.payment_method === "GCash" && selectedPayment.proof_of_payment_url && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const url = selectedPayment.proof_of_payment_url?.startsWith('/') 
                          ? selectedPayment.proof_of_payment_url 
                          : `/${selectedPayment.proof_of_payment_url}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Proof of Payment
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* School Fees Side Panel */}
        {isFeesPanelOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/40 transition-opacity"
              onClick={() => setIsFeesPanelOpen(false)}
            />
            
            {/* Panel */}
            <div className="relative ml-auto w-full max-w-4xl bg-background shadow-2xl flex flex-col border-l border-border">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white flex items-center justify-between border-b border-purple-500">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="h-6 w-6" />
                    School Fees Management
                  </h2>
                  <p className="text-purple-100 text-sm mt-1">Manage fee catalog and pricing</p>
                </div>
                <button
                  onClick={() => setIsFeesPanelOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  title="Close panel"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content - Two column layout */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left: Fee List */}
                <div className="w-3/5 border-r border-border flex flex-col">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-lg">Current Fees ({filteredSchoolFees.length})</h3>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {academicPeriods.find(p => p.status === 'active')?.school_year || "2026-2027"}
                      </Badge>
                    </div>
                    
                    {/* Filters */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search fees..."
                          value={feesSearchQuery}
                          onChange={(e) => setFeesSearchQuery(e.target.value)}
                          className="pl-10 py-2 text-sm"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={feeTypeFilter} onValueChange={setFeeTypeFilter}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Fee Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {FEE_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={yearLevelFilter} onValueChange={setYearLevelFilter}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Year Level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            {YEAR_LEVELS.map(level => (
                              <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Fee List */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {filteredSchoolFees.length > 0 ? (
                      <div className="space-y-2">
                        {filteredSchoolFees.map((fee) => (
                          <div
                            key={fee.id}
                            className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              selectedFee?.id === fee.id
                                ? 'border-purple-500 bg-purple-50'
                                : fee.is_active
                                ? 'border-border/50 bg-card hover:border-purple-300'
                                : 'border-border/30 bg-muted/30 opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-sm">{fee.fee_name}</h4>
                                  {!fee.is_active && (
                                    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                                      Inactive
                                    </Badge>
                                  )}
                                  {Boolean(fee.is_required) && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="secondary" className="text-xs">
                                    {fee.fee_type}
                                  </Badge>
                                  <span>•</span>
                                  <span>
                                    {fee.year_level === null && (!fee.year_levels || fee.year_levels.length === 0)
                                      ? "All Grades"
                                      : fee.year_levels && fee.year_levels.length > 0
                                      ? fee.year_levels.join(", ")
                                      : fee.year_level}
                                  </span>
                                </div>
                                {fee.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{fee.description}</p>
                                )}
                              </div>
                              <div className="text-right ml-3">
                                <p className="font-bold text-lg text-purple-700">
                                  ₱{Number(fee.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                                {fee.due_date && (
                                  <p className="text-xs text-muted-foreground">
                                    Due: {toIsoDate(fee.due_date) || '-'}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditFee(fee)}
                                className="text-xs h-7"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleFeeStatus(fee.id)}
                                className="text-xs h-7"
                              >
                                {fee.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFee(fee.id)}
                                className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <FileText className="h-16 w-16 mb-3 opacity-30" />
                        <p className="text-sm">
                          {feesSearchQuery || feeTypeFilter !== "all" || yearLevelFilter !== "all"
                            ? "No fees match your filters"
                            : "No fees configured yet"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Add/Edit Form */}
                <div className="w-2/5 flex flex-col bg-muted/20">
                  <div className="p-4 border-b border-border bg-muted/50">
                    <h3 className="font-bold text-lg">
                      {isEditingFee ? 'Edit Fee' : 'Add New Fee'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isEditingFee ? 'Update fee details below' : 'Configure a new school fee'}
                    </p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Fee Type *</Label>
                        <Select 
                          value={feeForm.fee_type} 
                          onValueChange={(v) => setFeeForm({ ...feeForm, fee_type: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FEE_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Fee Name *</Label>
                        <Input
                          placeholder="e.g., Quarterly Tuition Fee"
                          value={feeForm.fee_name}
                          onChange={(e) => setFeeForm({ ...feeForm, fee_name: e.target.value })}
                          className="mt-1"
                          disabled={isEditingFee && selectedFee?.fee_name === 'Service Fee'}
                        />
                        {isEditingFee && selectedFee?.fee_name === 'Service Fee' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Service Fee name cannot be changed
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Year Level *</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {YEAR_LEVELS.map(level => (
                            <div key={level} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`year_level_${level}`}
                                checked={feeForm.year_levels.includes(level)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    // If "All Grades" is selected, clear other selections
                                    if (level === "All Grades") {
                                      setFeeForm({ ...feeForm, year_levels: ["All Grades"] });
                                    } else {
                                      // Remove "All Grades" if selecting specific grade
                                      const filtered = feeForm.year_levels.filter(l => l !== "All Grades");
                                      setFeeForm({ ...feeForm, year_levels: [...filtered, level] });
                                    }
                                  } else {
                                    setFeeForm({ 
                                      ...feeForm, 
                                      year_levels: feeForm.year_levels.filter(l => l !== level) 
                                    });
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <Label 
                                htmlFor={`year_level_${level}`} 
                                className="text-sm font-normal cursor-pointer select-none"
                              >
                                {level}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Select "All Grades" for fees applicable to all year levels, or choose specific grades
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Amount (₱) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={feeForm.amount}
                          onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Due Date (Optional)</Label>
                        <Input
                          type="date"
                          value={feeForm.due_date}
                          onChange={(e) => setFeeForm({ ...feeForm, due_date: e.target.value })}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-semibold">Description</Label>
                        <Textarea
                          placeholder="Brief description of this fee..."
                          value={feeForm.description}
                          onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })}
                          rows={3}
                          className="mt-1"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_required"
                            checked={feeForm.is_required}
                            onChange={(e) => setFeeForm({ ...feeForm, is_required: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="is_required" className="text-sm font-normal cursor-pointer">
                            Required Fee
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_active"
                            checked={feeForm.is_active}
                            onChange={(e) => setFeeForm({ ...feeForm, is_active: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="is_active" className="text-sm font-normal cursor-pointer">
                            Active
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_recurring"
                            checked={feeForm.is_recurring}
                            onChange={(e) => setFeeForm({ ...feeForm, is_recurring: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="is_recurring" className="text-sm font-normal cursor-pointer">
                            Recurring (monthly)
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="p-4 border-t border-border bg-background flex gap-2">
                    {isEditingFee && (
                      <Button
                        variant="outline"
                        onClick={resetFeeForm}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveFee}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isEditingFee ? 'Update Fee' : 'Add Fee'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Discounts Panel - Slide-in from right */}
        {isDiscountsPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-stretch">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/40 transition-opacity"
              onClick={() => setIsDiscountsPanelOpen(false)}
            />
            
            {/* Panel */}
            <div className="relative ml-auto w-full max-w-4xl bg-background shadow-2xl flex flex-col border-l border-border">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white flex items-center justify-between border-b border-amber-500">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="h-6 w-6" />
                    Discount Management
                  </h2>
                  <p className="text-amber-100 text-sm mt-1">Manage student discounts and scholarships</p>
                </div>
                <button
                  onClick={() => setIsDiscountsPanelOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  title="Close panel"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content - Two column layout */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left: Discount List */}
                <div className="w-3/5 border-r border-border flex flex-col">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <div className="text-sm font-semibold text-muted-foreground mb-3 flex items-center justify-between">
                      <span>Current Discounts ({filteredDiscounts.length})</span>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {academicPeriods.find(p => p.status === 'active')?.school_year || '2026-2027'}
                      </Badge>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search discounts..."
                        value={discountsSearchQuery}
                        onChange={(e) => setDiscountsSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={discountTypeFilter} onValueChange={setDiscountTypeFilter}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {DISCOUNT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={discountStatusFilter} onValueChange={setDiscountStatusFilter}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          {DISCOUNT_STATUS.map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Discount List */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {filteredDiscounts.length > 0 ? (
                      <div className="space-y-2">
                        {filteredDiscounts.map((discount) => (
                          <div
                            key={discount.id}
                            className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              selectedDiscount?.id === discount.id
                                ? 'border-amber-500 bg-amber-50'
                                : discount.is_active
                                ? 'border-border/50 bg-card hover:border-amber-300'
                                : 'border-border/30 bg-muted/30 opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-sm">{discount.name}</h4>
                                  {!discount.is_active && (
                                    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="secondary" className="text-xs capitalize">
                                    {discount.type}
                                  </Badge>
                                  <span>•</span>
                                  <span>{discount.value_type}</span>
                                </div>
                                {discount.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{discount.description}</p>
                                )}
                              </div>
                              <div className="text-right ml-3">
                                <p className="font-bold text-lg text-amber-700">
                                  {discount.value_type === 'Percentage' 
                                    ? `${discount.value}%`
                                    : `₱${Number(discount.value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                  }
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDiscount(discount)}
                                className="text-xs h-7"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleDiscountStatus(discount.id)}
                                className="text-xs h-7"
                              >
                                {discount.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDiscount(discount.id)}
                                className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Settings className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No discounts found</p>
                        <p className="text-xs">Add a new discount to get started</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Add/Edit Form */}
                <div className="w-2/5 flex flex-col">
                  <div className="p-6 border-b border-border bg-muted/20">
                    <h3 className="font-semibold text-lg mb-1">
                      {isEditingDiscount ? 'Edit Discount' : 'Add New Discount'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isEditingDiscount ? 'Update discount details below' : 'Create a new discount for a student'}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                      <Label>Discount Name *</Label>
                      <Input
                        placeholder="e.g., Academic Excellence Scholarship"
                        value={discountForm.name}
                        onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Category</Label>
                        <Select 
                          value={discountForm.discount_type} 
                          onValueChange={(v) => setDiscountForm({ ...discountForm, discount_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DISCOUNT_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Value Type *</Label>
                        <Select 
                          value={discountForm.value_type} 
                          onValueChange={(v) => setDiscountForm({ ...discountForm, value_type: v as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Percentage">Percentage (%)</SelectItem>
                            <SelectItem value="Fixed Amount">Fixed Amount (₱)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>{discountForm.value_type === 'Percentage' ? 'Percentage Value (%)' : 'Amount Value (₱)'} *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g., 10.00"
                        value={discountForm.value}
                        onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Additional notes..."
                        value={discountForm.description || ''}
                        onChange={(e) => setDiscountForm({ ...discountForm, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                          type="checkbox"
                          checked={discountForm.is_active}
                          onChange={(e) => setDiscountForm({ ...discountForm, is_active: e.target.checked })}
                          id="is_active_chk"
                          className="rounded"
                      />
                      <Label htmlFor="is_active_chk" className="font-normal cursor-pointer">Active</Label>
                    </div>
                  </div>

                  <div className="p-6 border-t border-border bg-muted/20">
                    <div className="flex gap-3">
                      {isEditingDiscount && (
                        <Button
                          variant="outline"
                          onClick={resetDiscountForm}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={handleSaveDiscount}
                        className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isEditingDiscount ? 'Update Discount' : 'Add Discount'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        
        {/* Discount Dialog */}
        {discountDialogPayment && (
          <DiscountDialog
            open={isDiscountDialogOpen}
            onOpenChange={setIsDiscountDialogOpen}
            payment={{
              ...discountDialogPayment,
              id: parseInt(discountDialogPayment.id),
              student_id: parseInt(discountDialogPayment.student_id),
              enrollment_id: discountDialogPayment.enrollment_id ? parseInt(discountDialogPayment.enrollment_id) : undefined,
            }}
            onDiscountsUpdated={() => {
              fetchData();
              setIsDiscountDialogOpen(false);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Payments;
