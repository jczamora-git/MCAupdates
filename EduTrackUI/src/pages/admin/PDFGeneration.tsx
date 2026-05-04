import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertMessage } from "@/components/AlertMessage";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_ENDPOINTS, apiGet, apiPostBlob } from "@/lib/api";
import { useManilaTime } from "@/hooks/useManilaTime";
import { Download, FileDown, Loader2, CalendarClock, RefreshCw } from "lucide-react";
import { EnrollmentReportTab } from "@/components/reports/EnrollmentReportTab";
import { PaymentReportTab } from "@/components/reports/PaymentReportTab";
import { PaymentPlanReportTab } from "@/components/reports/PaymentPlanReportTab";
import { UniformOrderReportTab } from "@/components/reports/UniformOrderReportTab";
import { StudentStatusReportTab } from "@/components/reports/StudentStatusReportTab";
import { StudentGradeReportTab } from "@/components/reports/StudentGradeReportTab";

type ReportType = "enrollment" | "payment" | "paymentPlan" | "uniformOrder" | "studentStatus" | "studentGrade";
type AutoFrequency = "today" | "weekly" | "monthly" | "all" | "custom";
type StudentGradeScope = "bulk" | "individual";
type StudentGradeStudentOption = { value: string; label: string; yearLevel: string };

type GenericRow = Record<string, string | number>;
const AUTO_CONFIG_STORAGE_KEY = "admin_reports_auto_config_v1";

const toCanonical = (value: any) => String(value ?? "").trim().toLowerCase();

const toYearLevelKey = (value: any) => {
  const raw = toCanonical(value);
  if (!raw) return "";
  const num = raw.match(/\d+/)?.[0] ?? "";
  if (num) return num;
  return raw.replace(/^grade\s*/i, "").trim();
};

const monthKey = (value: any): string => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(amount || 0);

const getSchoolYearStart = (schoolYear: any, submittedAt: any) => {
  const schoolYearText = String(schoolYear ?? "");
  const match = schoolYearText.match(/(\d{4})/);
  if (match) return match[1];

  const date = new Date(submittedAt);
  if (!Number.isNaN(date.getTime())) return String(date.getFullYear());

  return String(new Date().getFullYear());
};

const formatDateMMDDHHMM = (value: any) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "00000000";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}${day}${hour}${minute}`;
};

const formatEnrollmentDisplayId = (schoolYearStart: string, submittedAt: any, enrollmentId: string) =>
  `${schoolYearStart}-${formatDateMMDDHHMM(submittedAt)}${enrollmentId}`;

const isAutoFrequency = (value: any): value is AutoFrequency =>
  value === "today" || value === "weekly" || value === "monthly" || value === "all" || value === "custom";

const PDFGeneration = () => {
  const { user, isAuthenticated } = useAuth();
  const { toIsoDate, todayIsoManila, formatDateTimeDisplay } = useManilaTime();
  const navigate = useNavigate();
  const hasMountedFilterRefetch = useRef(false);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const [reportType, setReportType] = useState<ReportType>("enrollment");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [yearLevelFilter, setYearLevelFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [enrollmentTypeFilter, setEnrollmentTypeFilter] = useState("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");

  const [autoFrequency, setAutoFrequency] = useState<AutoFrequency>("today");
  const [generateFromDate, setGenerateFromDate] = useState("");
  const [generateToDate, setGenerateToDate] = useState("");
  const [paymentFeeTypeDraft, setPaymentFeeTypeDraft] = useState("all");
  const [uniformItemFilter, setUniformItemFilter] = useState("all");
  const [studentGradeScope, setStudentGradeScope] = useState<StudentGradeScope>("bulk");
  const [studentGradeBulkYearLevel, setStudentGradeBulkYearLevel] = useState("");
  const [studentGradeStudentFilter, setStudentGradeStudentFilter] = useState("");
  const [studentGradeStudentQuery, setStudentGradeStudentQuery] = useState("");
  const [showStudentGradeSuggestions, setShowStudentGradeSuggestions] = useState(false);
  const [studentGradeSubjectFilter, setStudentGradeSubjectFilter] = useState("all");

  const [students, setStudents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const [allInstallments, setAllInstallments] = useState<any[]>([]);
  const [uniformOrders, setUniformOrders] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [yearLevels, setYearLevels] = useState<any[]>([]);
  const [attendance] = useState<any[]>([]);
  const [finalGrades, setFinalGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4500);
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    try {
      const rawAuto = localStorage.getItem(AUTO_CONFIG_STORAGE_KEY);
      if (rawAuto) {
        const parsed = JSON.parse(rawAuto);
        if (isAutoFrequency(parsed?.frequency)) setAutoFrequency(parsed.frequency);
      }
    } catch {
      // ignore storage parse issues
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_CONFIG_STORAGE_KEY, JSON.stringify({ frequency: autoFrequency }));
    } catch {
      // ignore storage write issues
    }
  }, [autoFrequency]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchData();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") return;
    if (!hasMountedFilterRefetch.current) {
      hasMountedFilterRefetch.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      fetchData();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    reportType,
    fromDate,
    toDate,
    yearLevelFilter,
    sectionFilter,
    statusFilter,
    enrollmentTypeFilter,
    paymentTypeFilter,
    paymentFeeTypeDraft,
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        apiGet(API_ENDPOINTS.STUDENTS),
        apiGet(API_ENDPOINTS.ADMIN_ENROLLMENTS),
        apiGet(API_ENDPOINTS.PAYMENTS),
        apiGet(API_ENDPOINTS.PAYMENT_PLANS),
        apiGet(API_ENDPOINTS.UNIFORM_ORDERS),
        apiGet(API_ENDPOINTS.SECTIONS),
        apiGet(API_ENDPOINTS.YEAR_LEVELS),
        apiGet(API_ENDPOINTS.PAYMENT_PLAN_ALL_INSTALLMENTS),
        apiGet(API_ENDPOINTS.FINAL_GRADES),
        apiGet(API_ENDPOINTS.SUBJECTS),
      ]);

      const [studentsRes, enrollmentsRes, paymentsRes, plansRes, uniformRes, sectionsRes, yearLevelsRes, allInstallmentsRes, finalGradesRes, subjectsRes] = results;

      const normalize = (payload: any) => {
        if (!payload || payload.status === "rejected") return [];
        const value = payload.value;
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.subjects)) return value.subjects;
        if (Array.isArray(value?.students)) return value.students;
        if (Array.isArray(value?.enrollments)) return value.enrollments;
        if (Array.isArray(value?.payments)) return value.payments;
        if (Array.isArray(value?.sections)) return value.sections;
        if (Array.isArray(value?.year_levels)) return value.year_levels;
        if (Array.isArray(value?.records)) return value.records;
        return [];
      };

      setStudents(normalize(studentsRes));
      setEnrollments(normalize(enrollmentsRes));
      setPayments(normalize(paymentsRes));
      setPaymentPlans(normalize(plansRes));
      setAllInstallments(normalize(allInstallmentsRes));
      setUniformOrders(normalize(uniformRes));
      setSections(normalize(sectionsRes));
      setYearLevels(normalize(yearLevelsRes));
      setFinalGrades(normalize(finalGradesRes));
      setSubjects(normalize(subjectsRes));
    } catch (err: any) {
      showAlert("error", err?.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const studentsNormalized = useMemo(() => {
    return students.map((s) => ({
      id: String(s.id ?? s.student_id ?? s.user_id ?? ""),
      studentCode: String(s.student_id ?? s.studentId ?? ""),
      name: `${s.first_name ?? s.firstName ?? ""} ${s.last_name ?? s.lastName ?? ""}`.trim() || s.name || "Unknown",
      yearLevel: String(s.year_level ?? s.yearLevel ?? "Unknown"),
      sectionId: String(s.section_id ?? s.sectionId ?? ""),
      status: String(s.status ?? "active"),
      createdAt: s.created_at ?? s.createdAt ?? "",
      email: String(s.email ?? s.user_email ?? ""),
    }));
  }, [students]);

  const studentById = useMemo(() => {
    const map: Record<string, any> = {};
    studentsNormalized.forEach((s) => {
      map[s.id] = s;
      if (s.studentCode) map[s.studentCode] = s;
    });
    return map;
  }, [studentsNormalized]);

  const sectionNameById = useMemo(() => {
    const map: Record<string, string> = {};
    sections.forEach((section) => {
      map[String(section.id)] = String(section.name ?? section.section_name ?? `Section ${section.id}`);
    });
    return map;
  }, [sections]);

  const yearLevelNameById = useMemo(() => {
    const map: Record<string, string> = {};
    yearLevels.forEach((level: any) => {
      const id = String(level.id ?? level.year_level_id ?? "").trim();
      if (!id) return;
      map[id] = String(level.name ?? level.year_level ?? level.level ?? "").trim();
    });
    return map;
  }, [yearLevels]);

  const subjectById = useMemo(() => {
    const map: Record<string, { code: string; name: string }> = {};
    subjects.forEach((subject: any) => {
      const id = String(subject.id ?? subject.subject_id ?? "");
      if (!id) return;
      map[id] = {
        code: String(subject.course_code ?? subject.code ?? "").trim(),
        name: String(subject.course_name ?? subject.subject_name ?? subject.name ?? "").trim() || `Subject ${id}`,
      };
    });
    return map;
  }, [subjects]);

  const subjectsNormalized = useMemo(() => {
    return subjects
      .map((subject: any) => {
        const id = String(subject.id ?? subject.subject_id ?? "");
        if (!id) return null;
        const yearLevelId = String(subject.year_level_id ?? subject.yearLevelId ?? "").trim();
        const yearLevel = String(
          subject.year_level ??
          subject.yearLevel ??
          subject.level ??
          subject.grade_level ??
          subject.year_level_name ??
          yearLevelNameById[yearLevelId] ??
          ""
        ).trim();
        const code = String(subject.course_code ?? subject.code ?? "").trim();
        const name = String(subject.course_name ?? subject.subject_name ?? subject.name ?? "").trim() || `Subject ${id}`;
        return { id, yearLevel, code, name };
      })
      .filter((subject): subject is { id: string; yearLevel: string; code: string; name: string } => Boolean(subject));
  }, [subjects, yearLevelNameById]);

  const yearLevelOptions = useMemo(() => {
    const fromYearLevels = (yearLevels || []).map((y) => String(y.name ?? y.year_level ?? y.level ?? "")).filter(Boolean);
    const fromStudents = studentsNormalized.map((s) => s.yearLevel).filter(Boolean);
    return Array.from(new Set([...fromYearLevels, ...fromStudents])).sort((a, b) => a.localeCompare(b));
  }, [yearLevels, studentsNormalized]);

  const frequencyAnchorDate = useMemo(() => {
    // For periodic generation, anchor to the actual current date in PH timezone.
    if (autoFrequency === "today" || autoFrequency === "weekly" || autoFrequency === "monthly") {
      return todayIsoManila();
    }

    const collectDates = () => {
      if (reportType === "enrollment") {
        return enrollments
          .map((entry: any) => toIsoDate(entry.submitted_date ?? entry.submitted_at ?? entry.created_at ?? entry.enrollment_date ?? entry.updated_at))
          .filter(Boolean);
      }
      if (reportType === "payment") {
        return payments
          .map((entry: any) => toIsoDate(entry.payment_date ?? entry.paid_at ?? entry.created_at ?? entry.updated_at))
          .filter(Boolean);
      }
      if (reportType === "paymentPlan") {
        return paymentPlans
          .map((entry: any) => toIsoDate(entry.created_at ?? entry.updated_at))
          .filter(Boolean);
      }
      if (reportType === "uniformOrder") {
        return uniformOrders
          .map((entry: any) => toIsoDate(entry.payment_date ?? entry.created_at ?? entry.updated_at))
          .filter(Boolean);
      }
      return studentsNormalized
        .map((entry: any) => toIsoDate(entry.createdAt))
        .filter(Boolean);
    };

    const dates = collectDates().sort();
    return dates.length > 0 ? dates[dates.length - 1] : todayIsoManila();
  }, [autoFrequency, reportType, enrollments, payments, paymentPlans, uniformOrders, studentsNormalized]);

  const inComponentDateRange = (isoDate: string) => {
    if (!isoDate) return false;
    if (fromDate && isoDate < fromDate) return false;
    if (toDate && isoDate > toDate) return false;
    return true;
  };

  const inGenerateFrequencyRange = (isoDate: string) => {
    if (!isoDate) return false;

    if (autoFrequency === "all") return true;

    if (autoFrequency === "custom") {
      if (generateFromDate && isoDate < generateFromDate) return false;
      if (generateToDate && isoDate > generateToDate) return false;
      return true;
    }

    const anchor = new Date(`${frequencyAnchorDate}T00:00:00`);
    const freqStart = new Date(anchor);
    if (autoFrequency === "weekly") freqStart.setDate(anchor.getDate() - 6);
    if (autoFrequency === "monthly") freqStart.setDate(anchor.getDate() - 29);
    const freqStartIso = freqStart.toISOString().slice(0, 10);

    return isoDate >= freqStartIso && isoDate <= frequencyAnchorDate;
  };

  const enrollmentRows = useMemo(() => {
    const normalized = enrollments.map((entry: any) => {
      const studentId = String(entry.student_id ?? entry.studentId ?? entry.user_id ?? "");
      const student = studentById[studentId] || null;
      const submittedAt = entry.submitted_date ?? entry.submitted_at ?? entry.created_at ?? entry.enrollment_date ?? entry.updated_at ?? "";
      const date = toIsoDate(submittedAt);
      const yearLevel = String(entry.year_level ?? entry.grade_level ?? student?.yearLevel ?? "Unknown");
      const sectionId = String(entry.section_id ?? student?.sectionId ?? "");
      const status = String(entry.status ?? "pending");
      const studentName =
        String(entry.student_name ?? "").trim() ||
        `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim() ||
        student?.name ||
        "Unknown";

      return {
        enrollmentId: String(entry.id ?? ""),
        studentId,
        studentName,
        yearLevel,
        sectionId,
        status,
        date,
        submittedAt,
        schoolYearStart: getSchoolYearStart(entry.school_year ?? entry.schoolYear, submittedAt),
        enrollmentType: String(entry.enrollment_type ?? ""),
      };
    });

    return normalized.filter((row) => {
      const statusNorm = toCanonical(row.status);
      const searchNorm = toCanonical(searchQuery);
      const sectionName = sectionNameById[row.sectionId] ?? row.sectionId;

      const matchDate = inComponentDateRange(row.date);
      const matchYear = yearLevelFilter === "all" || toCanonical(row.yearLevel) === toCanonical(yearLevelFilter);
      const matchSection = sectionFilter === "all" || String(row.sectionId) === sectionFilter;
      const matchStatus = statusFilter === "all" || statusNorm === toCanonical(statusFilter);
      const matchEnrollType = enrollmentTypeFilter === "all" || toCanonical(row.enrollmentType) === toCanonical(enrollmentTypeFilter);
      const matchSearch =
        !searchNorm ||
        toCanonical(row.studentName).includes(searchNorm) ||
        toCanonical(row.studentId).includes(searchNorm) ||
        toCanonical(row.enrollmentId).includes(searchNorm) ||
        toCanonical(sectionName).includes(searchNorm);

      return matchDate && matchYear && matchSection && matchStatus && matchEnrollType && matchSearch;
    });
  }, [enrollments, studentById, sectionNameById, fromDate, toDate, yearLevelFilter, sectionFilter, statusFilter, enrollmentTypeFilter, searchQuery]);

  const paymentRows = useMemo(() => {
    const paymentNormalized = payments
      .filter((p: any) => {
        if (p.is_refund) return false;
        if (p.has_been_refunded) return false;
        const s = String(p.status ?? p.payment_status ?? "").toLowerCase();
        return s !== "rejected";
      })
      .map((p: any) => {
        const studentId = String(p.student_id ?? p.studentId ?? p.user_id ?? "");
        const s = String(p.status ?? p.payment_status ?? "").toLowerCase();
        const isCollected = s === "approved" || s === "verified";
        const amount = isCollected ? (Number(p.net_amount ?? p.amount ?? p.payment_amount ?? 0) || 0) : 0;
        const rawAmount = Number(p.net_amount ?? p.amount ?? p.payment_amount ?? 0) || 0;
        const paidDate = toIsoDate(p.payment_date ?? p.paid_at ?? p.created_at ?? p.updated_at);
        const status = String(p.status ?? p.payment_status ?? "unknown");
        const hasProof = Boolean(p.proof_path ?? p.proof_image ?? p.proof_url ?? p.gcash_proof_path);
        const overdue = Boolean(p.is_overdue) || Number(p.penalty_amount ?? p.penalty ?? 0) > 0;
        const paymentType = String(p.payment_type ?? "");
        const isPending = s === "pending";
        return { studentId, amount, rawAmount, paidDate, status, hasProof, overdue, paymentType, isCollected, isPending };
      });

    const byStudent: Record<string, any> = {};
    studentsNormalized.forEach((s) => {
      byStudent[s.id] = {
        studentId: s.id,
        studentCode: s.studentCode,
        studentName: s.name,
        yearLevel: s.yearLevel,
        sectionId: s.sectionId,
        totalPaid: 0,
        paymentCount: 0,
        proofCount: 0,
        overdueCount: 0,
        pendingCount: 0,
        latestPaymentDate: "",
      };
    });

    paymentNormalized.forEach((p) => {
      if (!inComponentDateRange(p.paidDate)) return;
      if (paymentTypeFilter !== "all" && toCanonical(p.paymentType) !== toCanonical(paymentTypeFilter)) return;
      if (paymentFeeTypeDraft !== "all") {
        const paymentTypeNorm = toCanonical(p.paymentType);
        const matchesFeeType =
          (paymentFeeTypeDraft === "tuition" && paymentTypeNorm.includes("tuition")) ||
          (paymentFeeTypeDraft === "misc" && paymentTypeNorm.includes("misc")) ||
          (paymentFeeTypeDraft === "uniform" && paymentTypeNorm.includes("uniform")) ||
          (paymentFeeTypeDraft === "other" && !paymentTypeNorm.includes("tuition") && !paymentTypeNorm.includes("misc") && !paymentTypeNorm.includes("uniform"));
        if (!matchesFeeType) return;
      }
      if (!byStudent[p.studentId]) {
        const student = studentById[p.studentId];
        byStudent[p.studentId] = {
          studentId: p.studentId,
          studentCode: student?.studentCode ?? "",
          studentName: student?.name ?? `Student ${p.studentId}`,
          yearLevel: student?.yearLevel ?? "Unknown",
          sectionId: student?.sectionId ?? "",
          totalPaid: 0,
          paymentCount: 0,
          proofCount: 0,
          overdueCount: 0,
          pendingCount: 0,
          latestPaymentDate: "",
        };
      }

      const rec = byStudent[p.studentId];
      rec.totalPaid += p.amount; // only Approved/Verified (pending amount is 0)
      rec.paymentCount += 1;
      if (p.hasProof) rec.proofCount += 1;
      if (p.overdue) rec.overdueCount += 1;
      if (p.isPending) rec.pendingCount += 1;
      if (!rec.latestPaymentDate || p.paidDate > rec.latestPaymentDate) {
        rec.latestPaymentDate = p.paidDate;
      }
    });

    const baseRows = Object.values(byStudent).map((r: any) => {
      const paymentStatus = r.totalPaid > 0 ? "paid" : "unpaid";
      return {
        ...r,
        paymentStatus,
      };
    });

    return baseRows.filter((row: any) => {
      const searchNorm = toCanonical(searchQuery);
      const sectionName = sectionNameById[row.sectionId] ?? row.sectionId;

      const matchYear = yearLevelFilter === "all" || toCanonical(row.yearLevel) === toCanonical(yearLevelFilter);
      const matchSection = sectionFilter === "all" || String(row.sectionId) === sectionFilter;

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "paid" && row.paymentStatus === "paid") ||
        (statusFilter === "unpaid" && row.paymentStatus === "unpaid") ||
        (statusFilter === "overdue" && row.overdueCount > 0) ||
        (statusFilter === "proof-missing" && row.paymentCount > 0 && row.proofCount === 0);

      const matchSearch =
        !searchNorm ||
        toCanonical(row.studentName).includes(searchNorm) ||
        toCanonical(row.studentCode).includes(searchNorm) ||
        toCanonical(sectionName).includes(searchNorm);

      return matchYear && matchSection && matchStatus && matchSearch;
    });
  }, [payments, studentsNormalized, studentById, fromDate, toDate, yearLevelFilter, sectionFilter, statusFilter, paymentTypeFilter, paymentFeeTypeDraft, searchQuery, sectionNameById]);

  const studentStatusRows = useMemo(() => {
    return studentsNormalized.filter((row) => {
      const searchNorm = toCanonical(searchQuery);
      const sectionName = sectionNameById[row.sectionId] ?? row.sectionId;

      const matchDate = !fromDate && !toDate ? true : inComponentDateRange(toIsoDate(row.createdAt));
      const matchYear = yearLevelFilter === "all" || toCanonical(row.yearLevel) === toCanonical(yearLevelFilter);
      const matchSection = sectionFilter === "all" || String(row.sectionId) === sectionFilter;
      const matchStatus = statusFilter === "all" || toCanonical(row.status) === toCanonical(statusFilter);
      const matchSearch =
        !searchNorm ||
        toCanonical(row.name).includes(searchNorm) ||
        toCanonical(row.studentCode).includes(searchNorm) ||
        toCanonical(row.email).includes(searchNorm) ||
        toCanonical(sectionName).includes(searchNorm);

      return matchDate && matchYear && matchSection && matchStatus && matchSearch;
    });
  }, [studentsNormalized, sectionNameById, fromDate, toDate, yearLevelFilter, sectionFilter, statusFilter, searchQuery]);

  const paymentPlanRows = useMemo(() => {
    return paymentPlans.filter((plan: any) => {
      const searchNorm = toCanonical(searchQuery);
      const date = toIsoDate(plan.created_at);
      const matchDate = inComponentDateRange(date);
      const matchStatus = statusFilter === "all" || toCanonical(plan.status) === toCanonical(statusFilter);
      const matchSearch =
        !searchNorm ||
        toCanonical(plan.student_name ?? "").includes(searchNorm) ||
        toCanonical(plan.student_number ?? "").includes(searchNorm) ||
        toCanonical(plan.academic_period ?? "").includes(searchNorm);
      return matchDate && matchStatus && matchSearch;
    });
  }, [paymentPlans, statusFilter, searchQuery, fromDate, toDate]);

  const uniformOrderRows = useMemo(() => {
    return uniformOrders.filter((order: any) => {
      const searchNorm = toCanonical(searchQuery);
      const date = toIsoDate(order.payment_date ?? order.created_at);
      const matchDate = inComponentDateRange(date);
      const matchStatus =
        statusFilter === "all" ||
        toCanonical(order.payment_status ?? "").includes(toCanonical(statusFilter));
      const matchSearch =
        !searchNorm ||
        toCanonical(`${order.first_name ?? ""} ${order.last_name ?? ""}`).includes(searchNorm) ||
        toCanonical(order.student_number ?? "").includes(searchNorm) ||
        toCanonical(order.item_name ?? "").includes(searchNorm) ||
        toCanonical(order.item_group ?? "").includes(searchNorm);
      return matchDate && matchStatus && matchSearch;
    });
  }, [uniformOrders, statusFilter, searchQuery, fromDate, toDate]);

  const uniformItemOptions = useMemo(() => {
    const items = Array.from(
      new Set(
        uniformOrderRows
          .map((row: any) => String(row.item_name ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["all", ...items];
  }, [uniformOrderRows]);

  // Student-grade analytics compiled from submitted final grades (per student + subject across quarters)
  const studentGradeRows = useMemo(() => {
    const getSeed = (value: string) =>
      value
        .split("")
        .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

    const normalizeQuarter = (value: any): "1st" | "2nd" | "3rd" | "4th" | null => {
      const q = toCanonical(value);
      if (q === "1st" || q === "1st quarter") return "1st";
      if (q === "2nd" || q === "2nd quarter" || q === "midterm") return "2nd";
      if (q === "3rd" || q === "3rd quarter") return "3rd";
      if (q === "4th" || q === "4th quarter" || q === "final") return "4th";
      return null;
    };

    const getBand = (finalGrade: number) => {
      if (finalGrade >= 90) return "Excellent";
      if (finalGrade >= 85) return "Very Good";
      if (finalGrade >= 80) return "Good";
      if (finalGrade >= 75) return "Fair";
      return "Needs Improvement";
    };

    type CompiledRow = {
      studentId: string;
      studentName: string;
      yearLevel: string;
      sectionId: string;
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      q1: number | null;
      q2: number | null;
      q3: number | null;
      q4: number | null;
      initial: number;
      final: number;
      band: string;
      remarks: string;
      latestDate: string;
    };

    const grouped = new Map<string, Omit<CompiledRow, "initial" | "final" | "band" | "remarks">>();

    finalGrades.forEach((entry: any) => {
      const studentId = String(entry.student_id ?? "");
      const subjectId = String(entry.subject_id ?? "");
      if (!studentId || !subjectId) return;

      const student = studentById[studentId];
      const quarter = normalizeQuarter(entry.quarter);
      if (!quarter) return;

      const gradeNumRaw = Number(entry.final_grade_num ?? entry.final_grade ?? NaN);
      if (!Number.isFinite(gradeNumRaw)) return;
      const gradeNum = Math.max(0, Math.min(100, gradeNumRaw));
      const date = toIsoDate(entry.submitted_at ?? entry.created_at ?? entry.updated_at);
      const subjectMeta = subjectById[subjectId] || { code: "", name: `Subject ${subjectId}` };

      const key = `${studentId}__${subjectId}`;
      const existing = grouped.get(key) ?? {
        studentId: student?.studentCode || studentId,
        studentName: student?.name || `Student ${studentId}`,
        yearLevel: student?.yearLevel || "Unknown",
        sectionId: student?.sectionId || String(entry.section_id ?? ""),
        subjectId,
        subjectCode: subjectMeta.code,
        subjectName: subjectMeta.name,
        q1: null,
        q2: null,
        q3: null,
        q4: null,
        latestDate: date,
      };

      if (quarter === "1st") existing.q1 = gradeNum;
      if (quarter === "2nd") existing.q2 = gradeNum;
      if (quarter === "3rd") existing.q3 = gradeNum;
      if (quarter === "4th") existing.q4 = gradeNum;
      if (date && (!existing.latestDate || date > existing.latestDate)) existing.latestDate = date;

      grouped.set(key, existing);
    });

    const compiledFromSubmissions = Array.from(grouped.values())
      .map((row) => {
        const quarterValues = [row.q1, row.q2, row.q3, row.q4].filter((value): value is number => Number.isFinite(value));
        const initial = quarterValues.length > 0
          ? Number((quarterValues.reduce((sum, value) => sum + value, 0) / quarterValues.length).toFixed(2))
          : 0;
        const final = Math.round(initial);
        const band = getBand(final);
        const remarks = final >= 75 ? "PASSED" : "FAILED";

        return {
          ...row,
          initial,
          final,
          band,
          remarks,
        };
      })
      .filter((row) => {
        const searchNorm = toCanonical(searchQuery);
        const sectionName = sectionNameById[row.sectionId] ?? row.sectionId;

        const matchYear = yearLevelFilter === "all" || toCanonical(row.yearLevel) === toCanonical(yearLevelFilter);
        const matchSection = sectionFilter === "all" || String(row.sectionId) === sectionFilter;
        const matchSearch =
          !searchNorm ||
          toCanonical(row.studentName).includes(searchNorm) ||
          toCanonical(row.studentId).includes(searchNorm) ||
          toCanonical(row.subjectCode).includes(searchNorm) ||
          toCanonical(row.subjectName).includes(searchNorm) ||
          toCanonical(sectionName).includes(searchNorm);

        if (!(matchYear && matchSection && matchSearch)) return false;

        if (statusFilter !== "all" && toCanonical(statusFilter) !== toCanonical(row.band)) return false;
        return true;
      });

    if (compiledFromSubmissions.length > 0) {
      return compiledFromSubmissions;
    }

    const subjectsByYearLevel = new Map<string, Array<{ id: string; code: string; name: string }>>();
    subjectsNormalized.forEach((subject) => {
      const levelKey = toYearLevelKey(subject.yearLevel);
      if (!levelKey) return;
      if (!subjectsByYearLevel.has(levelKey)) {
        subjectsByYearLevel.set(levelKey, []);
      }
      subjectsByYearLevel.get(levelKey)!.push({
        id: subject.id,
        code: subject.code,
        name: subject.name,
      });
    });

    return studentsNormalized
      .flatMap((student) => {
        const studentLevelKey = toYearLevelKey(student.yearLevel);
        const gradeSubjects = subjectsByYearLevel.get(studentLevelKey) ?? [];
        const effectiveSubjects = gradeSubjects.length > 0
          ? gradeSubjects
          : [{ id: `mock-gmrc-${studentLevelKey || "general"}`, code: "GMRC", name: "GMRC" }];

        return effectiveSubjects.map((subject, index) => {
          const seed = getSeed(`${student.id}-${student.studentCode}-${student.name}-${subject.id}-${index}`);
          const q1 = 75 + (seed % 26);
          const q2 = 72 + ((seed * 3) % 29);
          const q3 = 70 + ((seed * 5) % 31);
          const q4 = 74 + ((seed * 7) % 27);
          const initial = Number((((q1 + q2 + q3 + q4) / 4)).toFixed(2));
          const final = Math.round(initial);
          const band = getBand(final);

          return {
            studentId: student.studentCode || student.id,
            studentName: student.name,
            yearLevel: student.yearLevel,
            sectionId: student.sectionId,
            subjectId: subject.id,
            subjectCode: subject.code || "-",
            subjectName: subject.name,
            q1,
            q2,
            q3,
            q4,
            initial,
            final,
            band,
            remarks: final >= 75 ? "PASSED" : "FAILED",
            latestDate: toIsoDate(student.createdAt) || new Date().toISOString().slice(0, 10),
          };
        });
      })
      .filter((row) => {
        const searchNorm = toCanonical(searchQuery);
        const sectionName = sectionNameById[row.sectionId] ?? row.sectionId;

        const matchYear = yearLevelFilter === "all" || toCanonical(row.yearLevel) === toCanonical(yearLevelFilter);
        const matchSection = sectionFilter === "all" || String(row.sectionId) === sectionFilter;
        const matchSearch =
          !searchNorm ||
          toCanonical(row.studentName).includes(searchNorm) ||
          toCanonical(row.studentId).includes(searchNorm) ||
          toCanonical(row.subjectCode).includes(searchNorm) ||
          toCanonical(row.subjectName).includes(searchNorm) ||
          toCanonical(sectionName).includes(searchNorm);

        if (!(matchYear && matchSection && matchSearch)) return false;
        if (statusFilter !== "all" && toCanonical(statusFilter) !== toCanonical(row.band)) return false;
        return true;
      });
  }, [finalGrades, studentById, subjectById, sectionNameById, searchQuery, yearLevelFilter, sectionFilter, statusFilter, studentsNormalized, subjectsNormalized]);

  const studentGradeBandChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    studentGradeRows.forEach((row) => {
      buckets[row.band] = (buckets[row.band] || 0) + 1;
    });
    return Object.entries(buckets).map(([band, count]) => ({ band, count }));
  }, [studentGradeRows]);

  const studentGradeComponentAverageChart = useMemo(() => {
    if (studentGradeRows.length === 0) {
      return [
        { component: "Q1", average: 0 },
        { component: "Q2", average: 0 },
        { component: "Q3", average: 0 },
        { component: "Q4", average: 0 },
        { component: "Initial", average: 0 },
        { component: "Final", average: 0 },
      ];
    }

    const totals = studentGradeRows.reduce(
      (acc, row) => ({
        q1: acc.q1 + Number(row.q1 ?? 0),
        q2: acc.q2 + Number(row.q2 ?? 0),
        q3: acc.q3 + Number(row.q3 ?? 0),
        q4: acc.q4 + Number(row.q4 ?? 0),
        initial: acc.initial + row.initial,
        final: acc.final + row.final,
      }),
      { q1: 0, q2: 0, q3: 0, q4: 0, initial: 0, final: 0 }
    );

    const count = studentGradeRows.length;
    return [
      { component: "Q1", average: Number((totals.q1 / count).toFixed(2)) },
      { component: "Q2", average: Number((totals.q2 / count).toFixed(2)) },
      { component: "Q3", average: Number((totals.q3 / count).toFixed(2)) },
      { component: "Q4", average: Number((totals.q4 / count).toFixed(2)) },
      { component: "Initial", average: Number((totals.initial / count).toFixed(2)) },
      { component: "Final", average: Number((totals.final / count).toFixed(2)) },
    ];
  }, [studentGradeRows]);

  const studentGradeStudentOptions = useMemo<StudentGradeStudentOption[]>(() => {
    const searchNorm = toCanonical(searchQuery);
    return studentsNormalized
      .filter((student) => {
        const sectionName = sectionNameById[student.sectionId] ?? student.sectionId;
        const matchYear = yearLevelFilter === "all" || toCanonical(student.yearLevel) === toCanonical(yearLevelFilter);
        const matchSection = sectionFilter === "all" || String(student.sectionId) === sectionFilter;
        const matchSearch =
          !searchNorm ||
          toCanonical(student.name).includes(searchNorm) ||
          toCanonical(student.studentCode).includes(searchNorm) ||
          toCanonical(student.id).includes(searchNorm) ||
          toCanonical(sectionName).includes(searchNorm);
        return matchYear && matchSection && matchSearch;
      })
      .map((student) => ({
        value: String(student.studentCode || student.id),
        label: String(student.name || student.studentCode || student.id),
        yearLevel: String(student.yearLevel || "Unknown"),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [studentsNormalized, sectionNameById, searchQuery, yearLevelFilter, sectionFilter]);

  const selectedStudentGradeOption = useMemo(
    () => studentGradeStudentOptions.find((opt) => opt.value === studentGradeStudentFilter) ?? null,
    [studentGradeStudentOptions, studentGradeStudentFilter]
  );

  const resolvedStudentGradeYearLevel = useMemo(() => {
    if (studentGradeScope === "bulk") return studentGradeBulkYearLevel;
    return selectedStudentGradeOption?.yearLevel ?? "";
  }, [studentGradeScope, studentGradeBulkYearLevel, selectedStudentGradeOption]);

  const filteredStudentGradeSuggestions = useMemo(() => {
    const queryNorm = toCanonical(studentGradeStudentQuery);
    return studentGradeStudentOptions
      .filter((opt) => {
        if (!queryNorm) return true;
        return (
          toCanonical(opt.label).includes(queryNorm) ||
          toCanonical(opt.value).includes(queryNorm) ||
          toCanonical(opt.yearLevel).includes(queryNorm)
        );
      })
      .slice(0, 12);
  }, [studentGradeStudentOptions, studentGradeStudentQuery]);

  const studentGradeSubjectOptions = useMemo(() => {
    const targetYearLevel = toYearLevelKey(resolvedStudentGradeYearLevel);
    const map = new Map<string, { label: string; code: string }>();

    subjectsNormalized.forEach((subject) => {
      const subjectYearLevel = toYearLevelKey(subject.yearLevel);
      if (!targetYearLevel || subjectYearLevel !== targetYearLevel) return;
      map.set(subject.id, {
        label: subject.name,
        code: subject.code,
      });
    });

    if (map.size === 0) {
      studentGradeRows.forEach((row: any) => {
        const rowYearLevel = toYearLevelKey(row.yearLevel);
        if (!targetYearLevel || rowYearLevel !== targetYearLevel) return;
        const id = String(row.subjectId ?? "");
        if (!id || map.has(id)) return;
        map.set(id, {
          label: String(row.subjectName ?? id),
          code: String(row.subjectCode ?? "").trim(),
        });
      });
    }

    return Array.from(map.entries())
      .map(([value, meta]) => ({
        value,
        label: meta.code ? `${meta.code} - ${meta.label}` : meta.label,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [subjectsNormalized, studentGradeRows, resolvedStudentGradeYearLevel]);

  useEffect(() => {
    if (studentGradeScope !== "bulk") return;
    if (!studentGradeBulkYearLevel && yearLevelOptions.length > 0) {
      setStudentGradeBulkYearLevel(yearLevelOptions[0]);
    }
  }, [studentGradeScope, studentGradeBulkYearLevel, yearLevelOptions]);

  useEffect(() => {
    if (studentGradeScope !== "individual") return;
    if (!studentGradeStudentFilter) return;
    if (!studentGradeStudentOptions.some((opt) => opt.value === studentGradeStudentFilter)) {
      setStudentGradeStudentFilter("");
      setStudentGradeStudentQuery("");
    }
  }, [studentGradeScope, studentGradeStudentFilter, studentGradeStudentOptions]);

  useEffect(() => {
    if (studentGradeSubjectFilter === "all") return;
    if (!studentGradeSubjectOptions.some((opt) => opt.value === studentGradeSubjectFilter)) {
      setStudentGradeSubjectFilter("all");
    }
  }, [studentGradeSubjectFilter, studentGradeSubjectOptions]);

  const reportRows = useMemo(() => {
    if (reportType === "enrollment") {
      return enrollments
        .map((entry: any) => {
          const studentId = String(entry.student_id ?? entry.studentId ?? entry.user_id ?? "");
          const student = studentById[studentId] || null;
          const submittedAt = entry.submitted_date ?? entry.submitted_at ?? entry.created_at ?? entry.enrollment_date ?? entry.updated_at ?? "";
          const date = toIsoDate(submittedAt);
          const yearLevel = String(entry.year_level ?? entry.grade_level ?? student?.yearLevel ?? "Unknown");
          const status = String(entry.status ?? "pending");
          const studentName =
            String(entry.student_name ?? "").trim() ||
            `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim() ||
            student?.name ||
            "Unknown";

          return {
            enrollmentId: String(entry.id ?? ""),
            studentName,
            yearLevel,
            status,
            date,
            submittedAt,
            schoolYearStart: getSchoolYearStart(entry.school_year ?? entry.schoolYear, submittedAt),
          };
        })
        .filter((row) => inGenerateFrequencyRange(row.date))
        .map((row) => ({
          "Enrollment ID": formatEnrollmentDisplayId(row.schoolYearStart, row.submittedAt, row.enrollmentId),
          "Student Name": row.studentName,
          "Year Level": row.yearLevel,
          Status: row.status,
          "Date Submitted": formatDateTimeDisplay(row.submittedAt),
        }));
    }

    if (reportType === "payment") {
      const paymentNormalized = payments
        .filter((p: any) => {
          if (p.is_refund) return false;
          const s = String(p.status ?? p.payment_status ?? "").toLowerCase();
          return s !== "rejected";
        })
        .map((p: any) => {
          const studentId = String(p.student_id ?? p.studentId ?? p.user_id ?? "");
          const amount = Number(p.net_amount ?? p.amount ?? p.payment_amount ?? 0) || 0;
          const paidDate = toIsoDate(p.payment_date ?? p.paid_at ?? p.created_at ?? p.updated_at);
          const hasProof = Boolean(p.proof_path ?? p.proof_image ?? p.proof_url ?? p.gcash_proof_path);
          const overdue = Boolean(p.is_overdue) || Number(p.penalty_amount ?? p.penalty ?? 0) > 0;
          const paymentType = String(p.payment_type ?? "");
          return { studentId, amount, paidDate, hasProof, overdue, paymentType };
        });

      const byStudent: Record<string, any> = {};

      paymentNormalized.forEach((p) => {
        if (!inGenerateFrequencyRange(p.paidDate)) return;
        if (paymentFeeTypeDraft !== "all") {
          const paymentTypeNorm = toCanonical(p.paymentType);
          const matchesFeeType =
            (paymentFeeTypeDraft === "tuition" && paymentTypeNorm.includes("tuition")) ||
            (paymentFeeTypeDraft === "misc" && paymentTypeNorm.includes("misc")) ||
            (paymentFeeTypeDraft === "uniform" && paymentTypeNorm.includes("uniform")) ||
            (paymentFeeTypeDraft === "other" && !paymentTypeNorm.includes("tuition") && !paymentTypeNorm.includes("misc") && !paymentTypeNorm.includes("uniform"));
          if (!matchesFeeType) return;
        }

        if (!byStudent[p.studentId]) {
          const student = studentById[p.studentId];
          byStudent[p.studentId] = {
            studentId: p.studentId,
            studentCode: student?.studentCode ?? "",
            studentName: student?.name ?? `Student ${p.studentId}`,
            yearLevel: student?.yearLevel ?? "Unknown",
            totalPaid: 0,
            paymentCount: 0,
            proofCount: 0,
            overdueCount: 0,
            latestPaymentDate: "",
          };
        }

        const rec = byStudent[p.studentId];
        rec.totalPaid += p.amount;
        rec.paymentCount += 1;
        if (p.hasProof) rec.proofCount += 1;
        if (p.overdue) rec.overdueCount += 1;
        if (!rec.latestPaymentDate || p.paidDate > rec.latestPaymentDate) {
          rec.latestPaymentDate = p.paidDate;
        }
      });

      return Object.values(byStudent).map((r: any) => ({
        "Student ID": r.studentCode || r.studentId,
        "Student Name": r.studentName,
        "Year Level": r.yearLevel,
        "Total Paid": Number(r.totalPaid.toFixed(2)),
        "Payment Count": r.paymentCount,
        "Overdue Count": r.overdueCount,
        "Payment Status": r.totalPaid > 0 ? "paid" : "unpaid",
        "Latest Payment": r.latestPaymentDate || "-",
      }));
    }

    if (reportType === "paymentPlan") {
      return paymentPlans
        .filter((plan: any) => inGenerateFrequencyRange(toIsoDate(plan.created_at ?? plan.updated_at)))
        .map((r: any) => ({
          "Plan ID": r.id,
          "Student Name": r.student_name ?? "-",
          "Student No.": r.student_number ?? "-",
          "Academic Period": r.academic_period ?? "-",
          "Schedule Type": r.schedule_type ?? "-",
          "Total Tuition": Number(r.total_tuition ?? 0),
          "Total Paid": Number(r.total_paid ?? 0),
          "Balance": Number(r.balance ?? 0),
          "Installments": r.number_of_installments ?? "-",
          "Status": r.status ?? "-",
          "Created": toIsoDate(r.created_at) || "-",
        }));
    }
    if (reportType === "uniformOrder") {
      const itemFilterNorm = toCanonical(uniformItemFilter);
      return uniformOrders
        .filter((order: any) => {
          const inRange = inGenerateFrequencyRange(toIsoDate(order.payment_date ?? order.created_at ?? order.updated_at));
          if (!inRange) return false;
          if (uniformItemFilter === "all") return true;
          return toCanonical(order.item_name ?? "") === itemFilterNorm;
        })
        .map((r: any) => ({
          "Order ID": r.id,
          "Student Name": `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "-",
          "Student No.": r.student_number ?? "-",
          "Item": r.item_name ?? "-",
          "Group": r.item_group ?? "-",
          "Size": r.size ?? "-",
          "Qty": r.quantity ?? 1,
          "Amount": Number(r.total_amount ?? 0),
          "Payment Status": r.payment_status ?? "-",
          "Payment Method": r.payment_method ?? "-",
          "Receipt No.": r.receipt_number ?? "-",
          "Date": toIsoDate(r.payment_date ?? r.created_at) || "-",
        }));
    }
    if (reportType === "studentGrade") {
      return studentGradeRows
        .filter((row) => {
          if (studentGradeScope === "bulk") {
            if (!studentGradeBulkYearLevel) return false;
            return toCanonical(row.yearLevel) === toCanonical(studentGradeBulkYearLevel);
          }
          if (studentGradeStudentFilter) {
            return String(row.studentId) === String(studentGradeStudentFilter);
          }
          return false;
        })
        .filter((row) => {
          if (studentGradeSubjectFilter !== "all") {
            return String(row.subjectId) === String(studentGradeSubjectFilter);
          }
          return true;
        })
        .map((row) => ({
          "Student ID": row.studentId,
          "Student Name": row.studentName,
          "Year Level": row.yearLevel,
          "Subject Code": row.subjectCode || "-",
          "Subject": row.subjectName,
          "1st Quarter": row.q1 ?? "-",
          "2nd Quarter": row.q2 ?? "-",
          "3rd Quarter": row.q3 ?? "-",
          "4th Quarter": row.q4 ?? "-",
          "Initial Grade": row.initial,
          "Final Grade": row.final,
          "Remarks": row.remarks,
          "Performance Band": row.band,
        }));
    }
    return studentsNormalized
      .filter((r) => inGenerateFrequencyRange(toIsoDate(r.createdAt)))
      .map((r) => ({
        "Student ID": r.studentCode,
        "Student Name": r.name,
        Email: r.email,
        "Year Level": r.yearLevel,
        Section: sectionNameById[r.sectionId] ?? "-",
        Status: r.status,
        "Created Date": toIsoDate(r.createdAt) || "-",
      }));
  }, [reportType, enrollments, payments, paymentPlans, uniformOrders, studentsNormalized, sectionNameById, studentById, paymentFeeTypeDraft, uniformItemFilter, studentGradeRows, autoFrequency, frequencyAnchorDate, generateFromDate, generateToDate, studentGradeScope, studentGradeBulkYearLevel, studentGradeStudentFilter, studentGradeSubjectFilter]);

  const summaryCards = useMemo(() => {
    if (reportType === "enrollment") {
      const approved = enrollmentRows.filter((r) => toCanonical(r.status) === "approved").length;
      const pending = enrollmentRows.filter((r) => toCanonical(r.status) === "pending").length;
      const rejected = enrollmentRows.filter((r) => toCanonical(r.status) === "rejected").length;
      return [
        { label: "Total Enrollments", value: enrollmentRows.length.toString() },
        { label: "Approved", value: approved.toString() },
        { label: "Pending", value: pending.toString() },
        { label: "Rejected", value: rejected.toString() },
      ];
    }

    if (reportType === "payment") {
      const totalCollections = paymentRows.reduce((sum: number, r: any) => sum + Number(r.totalPaid || 0), 0);
      const paid = paymentRows.filter((r: any) => r.paymentStatus === "paid").length;
      const unpaid = paymentRows.filter((r: any) => r.paymentStatus === "unpaid").length;
      const pendingPayments = paymentRows.reduce((sum: number, r: any) => sum + Number(r.pendingCount || 0), 0);
      return [
        { label: "Total Collections", value: formatCurrency(totalCollections) },
        { label: "Paid Students", value: paid.toString() },
        { label: "Unpaid Students", value: unpaid.toString() },
        { label: "Pending Payments", value: pendingPayments.toString() },
      ];
    }

    if (reportType === "paymentPlan") {
      const today = new Date().toISOString().split('T')[0];
      const installsByPlan: Record<string, any[]> = {};
      allInstallments.forEach((inst: any) => {
        const key = String(inst.payment_plan_id);
        if (!installsByPlan[key]) installsByPlan[key] = [];
        installsByPlan[key].push(inst);
      });
      const getRealStatus = (r: any) => {
        const stored = String(r.status ?? '');
        if (stored === 'Completed' || stored === 'Cancelled') return stored;
        if (allInstallments.length > 0) {
          const planInsts = installsByPlan[String(r.id)] ?? [];
          const hasOverdue = planInsts.some(
            (i: any) => String(i.due_date) < today && i.status !== 'Paid'
          );
          return hasOverdue ? 'Overdue' : stored;
        }
        return stored;
      };
      const active = paymentPlanRows.filter((r: any) => getRealStatus(r) === 'Active').length;
      const overdue = paymentPlanRows.filter((r: any) => getRealStatus(r) === 'Overdue').length;
      const completed = paymentPlanRows.filter((r: any) => getRealStatus(r) === 'Completed').length;
      const totalBalance = paymentPlanRows.reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
      return [
        { label: "Total Plans", value: paymentPlanRows.length.toString() },
        { label: "Active", value: active.toString() },
        { label: "Overdue", value: overdue.toString() },
        { label: "Completed", value: completed.toString() },
        { label: "Total Balance", value: formatCurrency(totalBalance) },
      ];
    }
    if (reportType === "uniformOrder") {
      // Use payments table (same source as Payments page fee summary) for revenue accuracy
      const uniformRevenue = payments
        .filter((p: any) => {
          if (p.is_refund || p.has_been_refunded) return false;
          const s = toCanonical(p.status ?? p.payment_status ?? "");
          if (s !== "approved" && s !== "verified") return false;
          return toCanonical(p.payment_type ?? "") === "uniform";
        })
        .reduce((sum: number, p: any) => sum + Number(p.net_amount ?? p.amount ?? 0), 0);
      const approved = uniformOrderRows.filter((r: any) => toCanonical(r.payment_status ?? "") === "approved").length;
      const pending = uniformOrderRows.filter((r: any) => toCanonical(r.payment_status ?? "") === "pending").length;
      return [
        { label: "Total Orders", value: uniformOrderRows.length.toString() },
        { label: "Total Revenue", value: formatCurrency(uniformRevenue) },
        { label: "Approved", value: approved.toString() },
        { label: "Pending", value: pending.toString() },
      ];
    }
    if (reportType === "studentGrade") {
      const passers = studentGradeRows.filter((row) => row.final >= 75).length;
      const topBand = studentGradeRows.filter((row) => row.band === "Excellent").length;
      const avgFinal = studentGradeRows.length > 0
        ? Number((studentGradeRows.reduce((sum, row) => sum + row.final, 0) / studentGradeRows.length).toFixed(2))
        : 0;
      const avgInitial = studentGradeRows.length > 0
        ? Number((studentGradeRows.reduce((sum, row) => sum + row.initial, 0) / studentGradeRows.length).toFixed(2))
        : 0;

      return [
        { label: "Total Students", value: studentGradeRows.length.toString() },
        { label: "Passing", value: passers.toString() },
        { label: "Excellent", value: topBand.toString() },
        { label: "Avg Final", value: avgFinal.toString() },
        { label: "Avg Initial", value: avgInitial.toString() },
      ];
    }
    const active = studentStatusRows.filter((r) => toCanonical(r.status) === "active").length;
    const graduated = studentStatusRows.filter((r) => toCanonical(r.status) === "graduated").length;
    const transferDropout = studentStatusRows.filter((r) => {
      const status = toCanonical(r.status);
      return status === "transferred" || status === "dropout";
    }).length;

    return [
      { label: "Total Students", value: studentStatusRows.length.toString() },
      { label: "Active", value: active.toString() },
      { label: "Graduated", value: graduated.toString() },
      { label: "Transfer/Dropout", value: transferDropout.toString() },
    ];
  }, [reportType, enrollmentRows, paymentRows, studentStatusRows, paymentPlanRows, uniformOrderRows, payments, studentGradeRows]);

  const monthlyTrends = useMemo(() => {
    const enrollmentMonthly: Record<string, number> = {};
    enrollmentRows.forEach((row) => {
      const key = monthKey(row.date);
      enrollmentMonthly[key] = (enrollmentMonthly[key] || 0) + 1;
    });

    const paymentMonthly: Record<string, number> = {};
    payments
      .filter((p: any) => {
        if (p.is_refund) return false;
        if (p.has_been_refunded) return false;
        const s = String(p.status ?? p.payment_status ?? "").toLowerCase();
        if (s !== "approved" && s !== "verified") return false;
        if (paymentTypeFilter !== "all" && toCanonical(p.payment_type ?? "") !== toCanonical(paymentTypeFilter)) return false;
        const dateStr = p.payment_date ?? p.paid_at ?? p.created_at ?? "";
        if (!inComponentDateRange(dateStr)) return false;
        return true;
      })
      .forEach((p: any) => {
        const key = monthKey(p.payment_date ?? p.paid_at ?? p.created_at);
        const amount = Number(p.net_amount ?? p.amount ?? p.payment_amount ?? 0) || 0;
        paymentMonthly[key] = (paymentMonthly[key] || 0) + amount;
      });

    const attendanceMonthly: Record<string, number> = {};
    const absentMonthly: Record<string, number> = {};
    attendance.forEach((a: any) => {
      const key = monthKey(a.attendance_date ?? a.created_at ?? a.date);
      const status = toCanonical(a.status ?? a.attendance_status ?? "");
      if (status === "present") {
        attendanceMonthly[key] = (attendanceMonthly[key] || 0) + 1;
      }
      if (status === "absent") {
        absentMonthly[key] = (absentMonthly[key] || 0) + 1;
      }
    });

    const months = Array.from(
      new Set([...Object.keys(enrollmentMonthly), ...Object.keys(paymentMonthly), ...Object.keys(attendanceMonthly)])
    ).sort();

    return months.map((month) => ({
      month,
      enrollments: enrollmentMonthly[month] || 0,
      collections: Number((paymentMonthly[month] || 0).toFixed(2)),
      attendance: attendanceMonthly[month] || 0,
      absent: absentMonthly[month] || 0,
    }));
  }, [enrollmentRows, payments, attendance, paymentTypeFilter, fromDate, toDate]);

  const enrollmentStatusChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    enrollmentRows.forEach((row) => {
      const key = row.status || "unknown";
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [enrollmentRows]);

  const paymentStatusChart = useMemo(() => {
    const paid = paymentRows.filter((row: any) => row.paymentStatus === "paid").length;
    const unpaid = paymentRows.filter((row: any) => row.paymentStatus === "unpaid").length;
    const overdue = paymentRows.filter((row: any) => row.overdueCount > 0).length;
    return [
      { name: "Paid", value: paid },
      { name: "Unpaid", value: unpaid },
      { name: "Overdue", value: overdue },
    ];
  }, [paymentRows]);

  const studentStatusChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    studentStatusRows.forEach((row) => {
      const key = row.status || "unknown";
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets).map(([status, count]) => ({ status, count }));
  }, [studentStatusRows]);

  const gradeDistributionChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    studentStatusRows.forEach((row) => {
      const key = row.yearLevel || "Unknown";
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([grade, total]) => ({ grade, total }))
      .sort((a, b) => a.grade.localeCompare(b.grade));
  }, [studentStatusRows]);

  const paymentTypeChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    payments
      .filter((p: any) => {
        if (p.is_refund) return false;
        if (p.has_been_refunded) return false;
        const s = String(p.status ?? p.payment_status ?? "").toLowerCase();
        if (s !== "approved" && s !== "verified") return false;
        if (paymentTypeFilter !== "all" && toCanonical(p.payment_type ?? "") !== toCanonical(paymentTypeFilter)) return false;
        const dateStr = toIsoDate(p.payment_date ?? p.paid_at ?? p.created_at ?? "");
        if (!inComponentDateRange(dateStr)) return false;
        return true;
      })
      .forEach((p: any) => {
        const key = String(p.payment_type ?? "Other");
        buckets[key] = (buckets[key] || 0) + Number(p.net_amount ?? p.amount ?? 0);
      });
    return Object.entries(buckets).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  }, [payments, paymentTypeFilter, fromDate, toDate]);

  const paymentMethodChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    payments
      .filter((p: any) => {
        if (p.is_refund) return false;
        if (paymentTypeFilter !== "all" && toCanonical(p.payment_type ?? "") !== toCanonical(paymentTypeFilter)) return false;
        const dateStr = toIsoDate(p.payment_date ?? p.paid_at ?? p.created_at ?? "");
        if (!inComponentDateRange(dateStr)) return false;
        return true;
      })
      .forEach((p: any) => {
        const key = String(p.payment_method ?? "Other");
        buckets[key] = (buckets[key] || 0) + 1;
      });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [payments, paymentTypeFilter, fromDate, toDate]);

  const planStatusChart = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const installsByPlan: Record<string, any[]> = {};
    allInstallments.forEach((inst: any) => {
      const key = String(inst.payment_plan_id);
      if (!installsByPlan[key]) installsByPlan[key] = [];
      installsByPlan[key].push(inst);
    });
    const buckets: Record<string, number> = {};
    paymentPlans.forEach((p: any) => {
      const stored = String(p.status ?? 'Unknown');
      let key: string;
      if (stored === 'Completed' || stored === 'Cancelled') {
        key = stored;
      } else if (allInstallments.length > 0) {
        const planInsts = installsByPlan[String(p.id)] ?? [];
        const hasOverdue = planInsts.some(
          (i: any) => String(i.due_date) < today && i.status !== 'Paid'
        );
        key = hasOverdue ? 'Overdue' : stored;
      } else {
        key = stored;
      }
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [paymentPlans, allInstallments]);

  const scheduleTypeChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    paymentPlans.forEach((p: any) => {
      const key = String(p.schedule_type ?? "Unknown");
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [paymentPlans]);

  const uniformItemGroupChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    uniformOrders.forEach((o: any) => {
      const key = String(o.item_group ?? o.item_name ?? "Unknown");
      buckets[key] = (buckets[key] || 0) + Number(o.total_amount ?? 0);
    });
    return Object.entries(buckets)
      .map(([item, total]) => ({ item, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total);
  }, [uniformOrders]);

  const enrollmentTypeChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    enrollments.forEach((e: any) => {
      const key = String(e.enrollment_type ?? "Unknown");
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [enrollments]);

  const metadata = useMemo(() => {
    const filters: Record<string, string> = {
      reportType,
      frequency: reportType === "studentGrade" ? "N/A" : autoFrequency,
      generateFromDate: reportType === "studentGrade" ? "N/A" : (autoFrequency === "custom" ? (generateFromDate || "Any") : "N/A"),
      generateToDate: reportType === "studentGrade" ? "N/A" : (autoFrequency === "custom" ? (generateToDate || "Any") : "N/A"),
      paymentFeeType: reportType === "payment" ? paymentFeeTypeDraft : "N/A",
      studentGradeScope: reportType === "studentGrade" ? studentGradeScope : "N/A",
      studentGradeLevel: reportType === "studentGrade" && studentGradeScope === "bulk" ? (studentGradeBulkYearLevel || "N/A") : "N/A",
      studentGradeStudent: reportType === "studentGrade" && studentGradeScope === "individual" ? (selectedStudentGradeOption?.label || "N/A") : "N/A",
      studentGradeSubject:
        reportType === "studentGrade"
          ? (studentGradeSubjectFilter === "all"
            ? (resolvedStudentGradeYearLevel ? `All Subjects (${resolvedStudentGradeYearLevel})` : "All Subjects")
            : (studentGradeSubjectOptions.find((opt) => opt.value === studentGradeSubjectFilter)?.label || studentGradeSubjectFilter))
          : "N/A",
    };

    return {
      generatedBy: user?.email || user?.name || "Admin",
      generatedAt: new Date().toLocaleString(),
      filters,
    };
  }, [reportType, user, autoFrequency, paymentFeeTypeDraft, generateFromDate, generateToDate, studentGradeScope, studentGradeBulkYearLevel, selectedStudentGradeOption, resolvedStudentGradeYearLevel, studentGradeSubjectFilter, studentGradeSubjectOptions]);

  const statusOptions = useMemo(() => {
    if (reportType === "enrollment") {
      const statuses = Array.from(new Set(enrollmentRows.map((r) => toCanonical(r.status)).filter(Boolean))).sort();
      return ["all", ...statuses];
    }
    if (reportType === "payment") {
      return ["all", "paid", "unpaid", "overdue"];
    }
    if (reportType === "paymentPlan") {
      return ["all", "Active", "Completed", "Overdue", "Cancelled"];
    }
    if (reportType === "uniformOrder") {
      return ["all", "Approved", "Pending", "Rejected"];
    }
    if (reportType === "studentGrade") {
      return ["all", "Excellent", "Very Good", "Good", "Fair", "Needs Improvement"];
    }
    return ["all", "active", "inactive", "graduated", "transferred", "dropout"];
  }, [reportType, enrollmentRows]);

  const exportCsv = () => {
    if (reportRows.length === 0) {
      showAlert("error", "No rows to export.");
      return;
    }

    const headers = Object.keys(reportRows[0]);
    const lines = [headers.join(",")];

    reportRows.forEach((row) => {
      const values = headers.map((h) => {
        const value = String(row[h] ?? "").replace(/"/g, '""');
        return `"${value}"`;
      });
      lines.push(values.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showAlert("success", "CSV export completed.");
  };

  const openPrintFallback = () => {
    const headers = Object.keys(reportRows[0] || {});
    const rowsHtml = reportRows
      .map(
        (row) =>
          `<tr>${headers
            .map((h) => `<td style=\"border:1px solid #d0d6e2;padding:6px;\">${String(row[h] ?? "-")}</td>`)
            .join("")}</tr>`
      )
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showAlert("error", "Popup blocked. Please allow popups to export PDF.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Report Export</title>
        </head>
        <body style="font-family: 'Times New Roman', Times, serif; padding: 24px; color: #222;">
          <h2 style="margin:0 0 8px 0; text-transform: uppercase;">${reportTypeLabel}</h2>
          <p style="margin:0 0 4px 0;">Generated by: ${user?.email || user?.name || "Admin"}</p>
          <p style="margin:0 0 16px 0;">Generated at: ${new Date().toLocaleString()}</p>
          <h4>Detailed Records (${reportRows.length} rows)</h4>
          <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead><tr>${headers.map((h) => `<th style=\"border:1px solid #d0d6e2;padding:6px;background:#f0f2f6;\">${h}</th>`).join("")}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const exportPdf = async () => {
    if (reportRows.length === 0) {
      showAlert("error", "No rows to export.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        reportType,
        reportTypeLabel,
        generatedBy: user?.email || user?.name || "Admin",
        rows: reportRows,
        summary: summaryCards,
      };

      const blob = await apiPostBlob(API_ENDPOINTS.REPORTS_ADMIN_PDF, payload);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MCA_${reportType}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showAlert("success", "PDF export completed.");
    } catch (err: any) {
      showAlert("error", err?.message || "Failed to export PDF. Opening print fallback.");
      openPrintFallback();
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setYearLevelFilter("all");
    setSectionFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
    setEnrollmentTypeFilter("all");
    setPaymentTypeFilter("all");
    setUniformItemFilter("all");
    setStudentGradeScope("bulk");
    setStudentGradeBulkYearLevel("");
    setStudentGradeStudentFilter("");
    setStudentGradeStudentQuery("");
    setShowStudentGradeSuggestions(false);
    setStudentGradeSubjectFilter("all");
  };

  if (!isAuthenticated) return null;

  const reportTypeLabel =
    reportType === "enrollment" ? "Enrollment Summary" :
    reportType === "payment" ? "Payment Collection Summary" :
    reportType === "paymentPlan" ? "Payment Plans & Installments" :
    reportType === "uniformOrder" ? "Uniform Orders" :
    reportType === "studentGrade" ? "Student Quarterly Grades" :
    "Student Status Summary";

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6 min-h-screen">

        {/* ── Page Header ─────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Reports Center
            </h1>
            <p className="text-muted-foreground">Filterable preview, exports, trends &amp; insights.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="rounded-lg gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </div>

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

        {/* ── Report Type Tabs ─────────────────────────── */}
        <Tabs value={reportType} onValueChange={(v) => { setReportType(v as ReportType); setStatusFilter("all"); setUniformItemFilter("all"); }}>
          <TabsList className="flex-wrap h-auto gap-1 p-1 bg-muted/60">
            <TabsTrigger value="enrollment" className="text-xs sm:text-sm">Enrollment</TabsTrigger>
            <TabsTrigger value="payment" className="text-xs sm:text-sm">Payments</TabsTrigger>
            <TabsTrigger value="paymentPlan" className="text-xs sm:text-sm">Payment Plans</TabsTrigger>
            <TabsTrigger value="uniformOrder" className="text-xs sm:text-sm">Uniform Orders</TabsTrigger>
            <TabsTrigger value="studentGrade" className="text-xs sm:text-sm">Student Grades</TabsTrigger>
            <TabsTrigger value="studentStatus" className="text-xs sm:text-sm">Student Status</TabsTrigger>
          </TabsList>
        </Tabs>

        {reportType === "enrollment" && (
          <EnrollmentReportTab
            summaryCards={summaryCards}
            statusOptions={statusOptions}
            yearLevelOptions={yearLevelOptions}
            enrollmentTypeFilter={enrollmentTypeFilter}
            setEnrollmentTypeFilter={setEnrollmentTypeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            yearLevelFilter={yearLevelFilter}
            setYearLevelFilter={setYearLevelFilter}
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            clearFilters={clearFilters}
            monthlyTrends={monthlyTrends}
            enrollmentStatusChart={enrollmentStatusChart}
            enrollmentTypeChart={enrollmentTypeChart}
          />
        )}

        {reportType === "payment" && (
          <PaymentReportTab
            summaryCards={summaryCards}
            statusOptions={statusOptions}
            paymentTypeFilter={paymentTypeFilter}
            setPaymentTypeFilter={setPaymentTypeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            clearFilters={clearFilters}
            paymentStatusChart={paymentStatusChart}
            paymentTypeChart={paymentTypeChart}
            paymentMethodChart={paymentMethodChart}
            monthlyTrends={monthlyTrends}
          />
        )}

        {reportType === "paymentPlan" && (
          <PaymentPlanReportTab
            summaryCards={summaryCards}
            statusOptions={statusOptions}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            clearFilters={clearFilters}
            planStatusChart={planStatusChart}
            scheduleTypeChart={scheduleTypeChart}
          />
        )}

        {reportType === "uniformOrder" && (
          <UniformOrderReportTab
            summaryCards={summaryCards}
            statusOptions={statusOptions}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            fromDate={fromDate}
            toDate={toDate}
            setFromDate={setFromDate}
            setToDate={setToDate}
            clearFilters={clearFilters}
            uniformItemGroupChart={uniformItemGroupChart}
            paymentMethodChart={paymentMethodChart}
          />
        )}

        {reportType === "studentStatus" && (
          <StudentStatusReportTab
            summaryCards={summaryCards}
            statusOptions={statusOptions}
            yearLevelOptions={yearLevelOptions}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            yearLevelFilter={yearLevelFilter}
            setYearLevelFilter={setYearLevelFilter}
            clearFilters={clearFilters}
            studentStatusChart={studentStatusChart}
            gradeDistributionChart={gradeDistributionChart}
          />
        )}

        {reportType === "studentGrade" && (
          <StudentGradeReportTab
            summaryCards={summaryCards}
            statusOptions={statusOptions}
            yearLevelOptions={yearLevelOptions}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            yearLevelFilter={yearLevelFilter}
            setYearLevelFilter={setYearLevelFilter}
            clearFilters={clearFilters}
            gradeBandChart={studentGradeBandChart}
            componentAverageChart={studentGradeComponentAverageChart}
          />
        )}

        {/* ── Bottom Row: Table (3/4) + Sidebar (1/4) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start">

          {/* Preview Table */}
          <Card className="xl:col-span-3 rounded-2xl border shadow-sm overflow-hidden self-start">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b">
              <div>
                <p className="text-sm font-semibold">Preview Table</p>
                <p className="text-xs text-muted-foreground mt-0.5">{reportRows.length} row(s) · {reportTypeLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                {reportType === "payment" ? (
                  <Select value={paymentFeeTypeDraft} onValueChange={setPaymentFeeTypeDraft}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Fee Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fee Types</SelectItem>
                      <SelectItem value="tuition">Tuition</SelectItem>
                      <SelectItem value="misc">Miscellaneous</SelectItem>
                      <SelectItem value="uniform">Uniform</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                ) : reportType === "uniformOrder" ? (
                  <Select value={uniformItemFilter} onValueChange={setUniformItemFilter}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Uniform Item" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniformItemOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item === "all" ? "All Items" : item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Feature slot reserved</span>
                )}
              </div>
            </div>
            <div className="border-t h-[420px] overflow-x-auto overflow-y-auto">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading report data…</p>
                </div>
              ) : reportRows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for selected filters.</div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      {Object.keys(reportRows[0]).map((header) => (
                        <th key={header} className="text-left px-4 py-2.5 border-b font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {reportRows.slice(0, 250).map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/20 even:bg-muted/[0.15] transition-colors">
                        {Object.keys(reportRows[0]).map((header) => (
                          <td key={`${idx}-${header}`} className="px-4 py-2.5 whitespace-nowrap text-foreground/80">{String(row[header] ?? "-")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* Right Sidebar: Generate Reports */}
          <div className="space-y-5 self-start">
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="px-5 pt-5 pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  Generate Reports
                </CardTitle>
                <CardDescription className="text-xs">Generate periodic report files</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                  {reportType !== "studentGrade" && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Frequency</Label>
                      <Select value={autoFrequency} onValueChange={(value: AutoFrequency) => setAutoFrequency(value)}>
                        <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {reportType !== "studentGrade" && autoFrequency === "custom" && (
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">From Date</Label>
                      <input
                        type="date"
                        aria-label="Generate report from date"
                        title="Generate report from date"
                        value={generateFromDate}
                        onChange={(e) => setGenerateFromDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">To Date</Label>
                      <input
                        type="date"
                        aria-label="Generate report to date"
                        title="Generate report to date"
                        value={generateToDate}
                        onChange={(e) => setGenerateToDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
                {reportType === "studentGrade" && (
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Student Grade Scope</Label>
                      <RadioGroup
                        value={studentGradeScope}
                        onValueChange={(value: StudentGradeScope) => {
                          setStudentGradeScope(value);
                          setStudentGradeSubjectFilter("all");
                          if (value === "bulk") {
                            setStudentGradeStudentFilter("");
                            setStudentGradeStudentQuery("");
                            setShowStudentGradeSuggestions(false);
                          }
                        }}
                        className="grid grid-cols-2 gap-2"
                      >
                        <Label className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm cursor-pointer">
                          <RadioGroupItem value="bulk" id="student-grade-scope-bulk" />
                          Bulk
                        </Label>
                        <Label className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm cursor-pointer">
                          <RadioGroupItem value="individual" id="student-grade-scope-individual" />
                          Individual
                        </Label>
                      </RadioGroup>
                    </div>

                    {studentGradeScope === "bulk" && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Grade Level</Label>
                        <Select value={studentGradeBulkYearLevel} onValueChange={(value) => {
                          setStudentGradeBulkYearLevel(value);
                          setStudentGradeSubjectFilter("all");
                        }}>
                          <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select grade level" /></SelectTrigger>
                          <SelectContent>
                            {yearLevelOptions.map((level) => (
                              <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {studentGradeScope === "individual" && (
                      <div className="relative">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Student</Label>
                        <Input
                          placeholder="Search student by ID or name..."
                          value={studentGradeStudentQuery}
                          onChange={(e) => {
                            setStudentGradeStudentQuery(e.target.value);
                            setStudentGradeStudentFilter("");
                            setStudentGradeSubjectFilter("all");
                            setShowStudentGradeSuggestions(true);
                          }}
                          onFocus={() => setShowStudentGradeSuggestions(true)}
                          onBlur={() => {
                            setTimeout(() => setShowStudentGradeSuggestions(false), 200);
                          }}
                          className="h-9 text-sm"
                        />
                        {showStudentGradeSuggestions && filteredStudentGradeSuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredStudentGradeSuggestions.map((item) => (
                              <button
                                key={item.value}
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-muted border-b border-border/50 last:border-b-0"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setStudentGradeStudentFilter(item.value);
                                  setStudentGradeStudentQuery(`${item.label} (${item.value})`);
                                  setStudentGradeSubjectFilter("all");
                                  setShowStudentGradeSuggestions(false);
                                }}
                              >
                                <div className="text-sm font-medium">{item.label}</div>
                                <div className="text-xs text-muted-foreground">{item.value} • {item.yearLevel}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Subject</Label>
                      <Select value={studentGradeSubjectFilter} onValueChange={setStudentGradeSubjectFilter}>
                        <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select subject" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {resolvedStudentGradeYearLevel ? `All Subjects (${resolvedStudentGradeYearLevel})` : "All Subjects"}
                          </SelectItem>
                          {studentGradeSubjectOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs gap-1.5" onClick={exportCsv} disabled={reportRows.length === 0}>
                    <Download className="h-3.5 w-3.5" />CSV
                  </Button>
                  <Button size="sm" className="rounded-lg h-8 text-xs gap-1.5" onClick={exportPdf} disabled={reportRows.length === 0}>
                    <FileDown className="h-3.5 w-3.5" />PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default PDFGeneration;
