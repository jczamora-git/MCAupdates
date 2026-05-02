import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  CheckCircle,
  Clock,
  Coins,
  Users,
  TrendingUp,
  Package,
  Loader2,
  Plus
} from "lucide-react";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";
import { SchoolServicePaymentModal } from "@/components/SchoolServicePaymentModal";
import { FeatureGate } from "@/components/FeatureGate";

type Student = {
  id: string;
  student_number: string;
  full_name: string;
  year_level: string;
  first_name: string;
  last_name: string;
};

type ServicePayment = {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  year_level: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  service_period_month: number;
  service_period_year: number;
  receipt_number: string;
  payment_for?: string;
};

type ServiceFee = {
  id: string;
  fee_name: string;
  amount: number;
  is_recurring: number | boolean;
  is_active: number | boolean;
  year_level?: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const YEAR_LEVELS = [
  "All Grades", "Nursery 1", "Nursery 2", "Kinder",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"
];

const SchoolServiceManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [servicePayments, setServicePayments] = useState<ServicePayment[]>([]);
  const [serviceFees, setServiceFees] = useState<ServiceFee[]>([]);
  const [serviceFeeAmount, setServiceFeeAmount] = useState<number>(1500);
  const [selectedServiceFeeId, setSelectedServiceFeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearLevelFilter, setYearLevelFilter] = useState<string>("All Grades");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // Payment dialog
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedPaymentMonth, setSelectedPaymentMonth] = useState<number>(new Date().getMonth() + 1);

  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
    } else {
      fetchData();
    }
  }, [isAuthenticated, user, navigate, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch academic periods to get available years
      const periodsRes = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS);
      if (periodsRes?.success || periodsRes?.periods) {
        const periods = periodsRes.data || periodsRes.periods || [];
        // Extract unique years from school_year field (e.g., "2025-2026" -> [2025, 2026])
        const yearsSet = new Set<number>();
        periods.forEach((period: any) => {
          if (period.school_year) {
            const yearParts = period.school_year.split('-');
            yearParts.forEach((yearStr: string) => {
              const year = parseInt(yearStr.trim());
              if (!isNaN(year)) yearsSet.add(year);
            });
          }
        });
        const years = Array.from(yearsSet).sort((a, b) => b - a); // Descending order
        setAvailableYears(years);
        
        // If selected year is not in available years, set to the first available year
        if (years.length > 0 && !years.includes(selectedYear)) {
          setSelectedYear(years[0]);
        }
      }

      // Fetch service fee list (recurring only)
      const feeRes = await apiGet(API_ENDPOINTS.SCHOOL_SERVICE_FEE_AMOUNT);
      if (feeRes?.success && feeRes.data) {
        const feeRows = Array.isArray(feeRes.data) ? feeRes.data : [feeRes.data];
        const recurringFees = feeRows.filter((fee: ServiceFee) =>
          (fee.is_recurring === 1 || fee.is_recurring === true) &&
          (fee.is_active === 1 || fee.is_active === true)
        );
        setServiceFees(recurringFees);
        if (!selectedServiceFeeId && recurringFees.length > 0) {
          setSelectedServiceFeeId(recurringFees[0].id);
        }
      }

      // Fetch students
      const studentsRes = await apiGet(API_ENDPOINTS.SCHOOL_SERVICE_STUDENTS);
      if (studentsRes?.success) {
        setStudents(studentsRes.data || []);
      }

      // Fetch service payments for the year
      const paymentsRes = await apiGet(`${API_ENDPOINTS.SCHOOL_SERVICE_PAYMENTS}?year=${selectedYear}`);
      if (paymentsRes?.success) {
        setServicePayments(paymentsRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showAlert('error', 'Failed to load service data');
    } finally {
      setLoading(false);
    }
  };

  const hasStudentPaidForMonth = (studentId: string, month: number): ServicePayment | undefined => {
    return servicePayments.find(
      p => p.student_id === studentId && 
           p.service_period_month === month && 
           p.service_period_year === selectedYear &&
           (p.status === 'Approved' || p.status === 'Verified')
    );
  };

  const handleOpenPaymentDialog = (student: Student, month: number) => {
    setSelectedStudent(student);
    setSelectedPaymentMonth(month);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    showAlert('success', 'Service fee payment recorded successfully');
    fetchData();
  };

  const handlePaymentError = (message: string) => {
    showAlert('error', message);
  };

  const selectedServiceFee = serviceFees.find(
    (fee) => String(fee.id) === String(selectedServiceFeeId)
  );

  const serviceFeeName = selectedServiceFee?.fee_name?.trim() || "";

  const monthlyComputedSummary = useMemo(() => {
    const matchesSelectedFee = (payment: ServicePayment) => {
      if (!serviceFeeName) return true;
      const paymentFeeName = String(payment.payment_for || '').split(' - ')[0]?.trim();
      return paymentFeeName === serviceFeeName;
    };

    const monthPayments = servicePayments.filter((payment) =>
      Number(payment.service_period_year) === Number(selectedYear) &&
      Number(payment.service_period_month) === Number(selectedMonth) &&
      matchesSelectedFee(payment)
    );

    const approved = monthPayments.filter((payment) => payment.status === 'Approved');
    const pending = monthPayments.filter((payment) => payment.status === 'Pending');

    const paidStudentIds = new Set(approved.map((payment) => String(payment.student_id)));
    const pendingStudentIds = new Set(pending.map((payment) => String(payment.student_id)));

    return {
      total_revenue: approved.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      paid_students: paidStudentIds.size,
      unpaid_students: pendingStudentIds.size,
    };
  }, [servicePayments, selectedYear, selectedMonth, serviceFeeName]);

  useEffect(() => {
    if (selectedServiceFee) {
      setServiceFeeAmount(Number(selectedServiceFee.amount));
    }
  }, [selectedServiceFee]);

  // Filter students: only show students with at least one service payment record
  const filteredStudents = students.filter(s => {
    // Filter by year level
    const matchesYearLevel = yearLevelFilter === "All Grades" || s.year_level === yearLevelFilter;
    
    // Only show students who have service payment records
    const hasServicePayment = servicePayments.some(p => p.student_id === s.id);
    
    return matchesYearLevel && hasServicePayment;
  });

  // Calculate yearly totals
  const yearlyTotalRevenue = servicePayments
    .filter(p => p.service_period_year === selectedYear && p.status === 'Approved')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const yearlyPaymentCount = servicePayments
    .filter(p => p.service_period_year === selectedYear && p.status === 'Approved')
    .length;

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading service data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <FeatureGate feature="payment" showComingSoon>
      <DashboardLayout>
        <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              School Service Management
            </h1>
            <p className="text-muted-foreground">Track monthly service fee payments per student</p>
          </div>
          <Button 
            onClick={() => setIsPaymentDialogOpen(true)} 
            className="bg-gradient-to-r from-blue-600 to-cyan-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Payment
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-semibold">
                    {MONTHS[selectedMonth - 1]} Revenue
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    ₱{monthlyComputedSummary.total_revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-semibold">Paid Students</p>
                  <p className="text-2xl font-bold text-green-700">
                    {monthlyComputedSummary.paid_students}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-semibold">Unpaid Students</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {monthlyComputedSummary.unpaid_students}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-200 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-semibold">Yearly Total</p>
                  <p className="text-2xl font-bold text-purple-700">
                    ₱{yearlyTotalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-purple-600">{yearlyPaymentCount} payments</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Service Fee</Label>
                <Select
                  value={selectedServiceFeeId || ""}
                  onValueChange={(v) => setSelectedServiceFeeId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select service fee" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceFees.length > 0 ? (
                      serviceFees.map((fee) => (
                        <SelectItem key={fee.id} value={fee.id}>
                          {fee.fee_name} - ₱{Number(fee.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-fees" disabled>
                        No recurring service fees configured
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Academic Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.length > 0 ? (
                      availableYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value={selectedYear.toString()}>
                        {selectedYear}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Year Level Filter</Label>
                <Select value={yearLevelFilter} onValueChange={setYearLevelFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_LEVELS.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>View Month Summary</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Tracking Table */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Service Fee Payment Tracking - {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold border-r sticky left-0 bg-muted/50 z-10">
                      Student
                    </th>
                    <th className="px-2 py-3 text-left font-semibold text-xs border-r">Year</th>
                    {MONTHS.map((month, index) => (
                      <th key={month} className="px-3 py-3 text-center font-semibold text-xs border-r">
                        {month.substring(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-12 w-12 text-muted-foreground/50" />
                          <p className="font-medium">No service fee payments recorded</p>
                          <p className="text-sm">Click "New Payment" to record the first service fee payment</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => (
                      <tr key={student.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 border-r sticky left-0 bg-white z-10">
                          <div>
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-xs text-muted-foreground">{student.student_number}</p>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-xs text-muted-foreground border-r">
                          {student.year_level}
                        </td>
                        {MONTHS.map((month, monthIndex) => {
                          const payment = hasStudentPaidForMonth(student.id, monthIndex + 1);
                          const feeLabel = payment?.payment_for?.split(' - ')[0];
                          return (
                            <td key={month} className="px-3 py-3 text-center border-r">
                              {payment ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                                    ✓ Paid
                                  </Badge>
                                  {feeLabel && (
                                    <span className="text-[10px] text-muted-foreground">{feeLabel}</span>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => handleOpenPaymentDialog(student, monthIndex + 1)}
                                >
                                  Pay
                                </Button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Modal */}
        <SchoolServicePaymentModal
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          students={students}
          serviceFeeAmount={serviceFeeAmount}
          serviceFees={serviceFees}
          selectedServiceFeeId={selectedServiceFeeId}
          onServiceFeeChange={setSelectedServiceFeeId}
          selectedYear={selectedYear}
          userId={user?.id}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          initialStudent={selectedStudent}
          initialMonth={selectedPaymentMonth}
        />

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        </div>
      </DashboardLayout>
    </FeatureGate>
  );
};

export default SchoolServiceManagement;
