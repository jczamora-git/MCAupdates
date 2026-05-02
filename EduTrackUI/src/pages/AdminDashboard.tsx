import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, GraduationCap, Settings, TrendingUp, Calendar, Edit, Bell, FileText, Grid3x3, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";

import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const STATUS_COLORS: Record<string, string> = {
  Pending: "#3b82f6",
  "Under Review": "#8b5cf6",
  Incomplete: "#f59e0b",
  Verified: "#06b6d4",
  Approved: "#22c55e",
  Rejected: "#ef4444",
};

const toMonthKey = (value: any): string => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const DashboardTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-sm px-3 py-2 text-xs">
      {label !== undefined && <p className="font-medium mb-1">{label}</p>}
      {payload.map((entry: any, idx: number) => (
        <div key={`${entry.dataKey}-${idx}`} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{entry.name || entry.dataKey}</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const RadarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold mb-1">{payload[0]?.payload?.label ?? payload[0]?.payload?.name}</p>
      <p className="text-blue-500 font-bold">
        ₱{Number(payload[0]?.value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  
  // Fetch active academic period
  const { data: activePeriodData } = useQuery({
    queryKey: ['academic-period', 'active'],
    queryFn: () => apiGet(API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE),
  });
  
  const activePeriod = activePeriodData?.data;

  // Fetch active enrollment period
  const { data: activeEnrollmentData } = useQuery({
    queryKey: ['enrollment-period', 'active'],
    queryFn: () => apiGet(`${API_ENDPOINTS.ENROLLMENT_PERIODS}/active`),
  });
  
  const activeEnrollment = activeEnrollmentData?.data;

  // State for dashboard stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalTeachers: 0,
    activeTeachers: 0,
    totalSubjects: 0,
    totalSections: 0,
    totalAnnouncements: 0,
    totalConcerns: 0,
  });
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [recentTeachers, setRecentTeachers] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [uniformOrders, setUniformOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch students stats (active only)
        const studentsRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?status=active`);
        const studentsList = studentsRes.data ?? studentsRes.students ?? [];

        // Fetch teachers stats (active only)
        const teachersRes = await apiGet(`${API_ENDPOINTS.TEACHERS}?status=active`);
        const teachersList = teachersRes.data ?? teachersRes.teachers ?? [];

        // Fetch subjects
        const subjectsRes = await apiGet(API_ENDPOINTS.SUBJECTS).catch(() => ({ data: [] }));
        const subjectsList = subjectsRes.data ?? subjectsRes.subjects ?? [];

        // Fetch sections
        const sectionsRes = await apiGet(API_ENDPOINTS.SECTIONS).catch(() => ({ data: [] }));
        const sectionsList = sectionsRes.data ?? sectionsRes.sections ?? [];

        // Fetch announcements
        const announcementsRes = await apiGet(API_ENDPOINTS.ANNOUNCEMENTS).catch(() => ({ data: [] }));
        const announcementsList = announcementsRes.data ?? announcementsRes.announcements ?? [];

        // Fetch enrollments and payments for dashboard charts
        const enrollmentsRes = await apiGet(API_ENDPOINTS.ADMIN_ENROLLMENTS).catch(() => ({ data: [] }));
        const enrollmentsList = enrollmentsRes.data ?? enrollmentsRes.enrollments ?? [];

        const paymentsRes = await apiGet(API_ENDPOINTS.PAYMENTS).catch(() => ({ data: [] }));
        const paymentsList = paymentsRes.data ?? paymentsRes.payments ?? [];

        const uniformOrdersRes = await apiGet(API_ENDPOINTS.UNIFORM_ORDERS).catch(() => ({ data: [] }));
        const uniformOrdersList = uniformOrdersRes.data ?? uniformOrdersRes.orders ?? uniformOrdersRes.uniform_orders ?? [];

        // Fetch concern tickets (open + in-progress count)
        const concernsRes = await apiGet(API_ENDPOINTS.CONCERNS).catch(() => ({ data: [] }));
        const concernsList: any[] = Array.isArray(concernsRes?.data) ? concernsRes.data : [];
        const activeTickets = concernsList.filter((t: any) => {
          const s = String(t.status ?? "").toLowerCase();
          return s === "open" || s === "in progress";
        }).length;

        // Set stats
        setStats({
          totalStudents: Array.isArray(studentsList) ? studentsList.length : 0,
          activeStudents: Array.isArray(studentsList) ? studentsList.length : 0,
          totalTeachers: Array.isArray(teachersList) ? teachersList.length : 0,
          activeTeachers: Array.isArray(teachersList) ? teachersList.length : 0,
          totalSubjects: Array.isArray(subjectsList) ? subjectsList.length : 0,
          totalSections: Array.isArray(sectionsList) ? sectionsList.length : 0,
          totalAnnouncements: Array.isArray(announcementsList) ? announcementsList.length : 0,
          totalConcerns: activeTickets,
        });

        // Set recent users
        setRecentStudents(Array.isArray(studentsList) ? studentsList.slice(0, 5) : []);
        setRecentTeachers(Array.isArray(teachersList) ? teachersList.slice(0, 5) : []);
        setEnrollments(Array.isArray(enrollmentsList) ? enrollmentsList : []);
        setPayments(Array.isArray(paymentsList) ? paymentsList : []);
        setUniformOrders(Array.isArray(uniformOrdersList) ? uniformOrdersList : []);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Quick links for admin
  const quickLinks = [
    { name: "Students", href: "/admin/users/students", icon: Users, description: "Manage student accounts", count: stats.totalStudents },
    { name: "Teachers", href: "/admin/users/teachers", icon: GraduationCap, description: "Manage teacher accounts", count: stats.totalTeachers },
    { name: "Subjects", href: "/admin/users/subjects", icon: BookOpen, description: "Manage course subjects", count: stats.totalSubjects },
    { name: "Sections", href: "/admin/users/sections", icon: Grid3x3, description: "Manage class sections", count: stats.totalSections },
    { name: "Announcements", href: "/admin/announcements", icon: Bell, description: "System announcements", count: stats.totalAnnouncements },
    { name: "User Management", href: "/admin/users", icon: Settings, description: "All user accounts", count: null },
  ];

  const enrollmentTrendData = useMemo(() => {
    const buckets: Record<string, number> = {};
    enrollments.forEach((entry: any) => {
      const month = toMonthKey(entry.submitted_date ?? entry.submitted_at ?? entry.created_at ?? entry.updated_at);
      buckets[month] = (buckets[month] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [enrollments]);

  const enrollmentStatusChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    enrollments.forEach((entry: any) => {
      const status = String(entry.status ?? "Unknown");
      buckets[status] = (buckets[status] || 0) + 1;
    });

    const preferredOrder = ["Pending", "Under Review", "Incomplete", "Verified", "Approved", "Rejected"];
    const ordered = preferredOrder
      .filter((status) => buckets[status] !== undefined)
      .map((name) => ({ name, value: buckets[name] }));

    const extras = Object.entries(buckets)
      .filter(([name]) => !preferredOrder.includes(name))
      .map(([name, value]) => ({ name, value }));

    return [...ordered, ...extras];
  }, [enrollments]);

  const paymentTypeChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    payments
      .filter((payment: any) => {
        if (payment.is_refund) return false;
        if (payment.has_been_refunded) return false;
        const s = String(payment.status ?? "").toLowerCase();
        return s === "approved" || s === "verified";
      })
      .forEach((payment: any) => {
        const key = String(payment.payment_type ?? "Other");
        buckets[key] = (buckets[key] || 0) + Number(payment.net_amount ?? payment.amount ?? payment.amount_paid ?? 0);
      });

    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [payments]);

  const uniformItemGroupChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    uniformOrders.forEach((order: any) => {
      const key = String(order.item_group ?? order.item_name ?? "Other");
      const amount = Number(order.total_amount ?? order.amount ?? 0);
      if (!Number.isNaN(amount)) {
        buckets[key] = (buckets[key] || 0) + amount;
      }
    });

    return Object.entries(buckets)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        fullMark: Math.max(...Object.values(buckets).map((v) => Number(v)), 1),
      }));
  }, [uniformOrders]);

  const uniformRadarData = useMemo(
    () => uniformItemGroupChart.map((item) => ({ ...item, label: item.name })),
    [uniformItemGroupChart],
  );

  const enrollmentStatusTotal = useMemo(
    () => enrollmentStatusChart.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [enrollmentStatusChart],
  );

  const newStudentsCount = useMemo(
    () => enrollments.filter((e: any) => {
      const t = String(e.enrollment_type ?? "").toLowerCase();
      return t === "new student" || t === "new";
    }).length,
    [enrollments],
  );

  return (
    <DashboardLayout fullBleed>
      <div className="w-full px-4 py-8 space-y-6">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">Welcome, {user?.name}</h1>
                <p className="text-sm text-muted-foreground">Modern admin command center for academics, enrollment operations, and system monitoring.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/admin/reports">
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Reports
                  </Button>
                </Link>
                <Link to="/admin/users">
                  <Button size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Manage Users
                  </Button>
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className="rounded-lg bg-background/80 border border-border p-3">
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="text-2xl font-semibold leading-tight">{stats.totalStudents}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Active students</p>
              </div>
              <div className="rounded-lg bg-background/80 border border-border p-3">
                <p className="text-xs text-muted-foreground">Teachers</p>
                <p className="text-2xl font-semibold leading-tight">{stats.totalTeachers}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Active teachers</p>
              </div>
              <div className="rounded-lg bg-background/80 border border-border p-3">
                <p className="text-xs text-muted-foreground">Concerns</p>
                <p className="text-2xl font-semibold leading-tight">{stats.totalConcerns}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Open &amp; In Progress</p>
              </div>
              <div className="rounded-lg bg-background/80 border border-border p-3">
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="text-2xl font-semibold leading-tight">{uniformOrders.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Uniform orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Card className="xl:col-span-4 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Current Academic Period</CardTitle>
                </div>
                <Link to="/admin/academic-periods">
                  <Button variant="outline" size="sm" className="h-7 px-2">Manage</Button>
                </Link>
              </div>
              <CardDescription>Active grading period for the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activePeriod ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">School Year</span>
                    <span className="font-semibold text-primary">{activePeriod.school_year}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quarter</span>
                    <Badge className="text-xs">{activePeriod.quarter}</Badge>
                  </div>
                  <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                    {new Date(activePeriod.start_date).toLocaleDateString()} - {new Date(activePeriod.end_date).toLocaleDateString()}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No active academic period set.</p>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-base flex items-center gap-2">
                    Active Enrollment Period
                    {activeEnrollment && <Badge className="bg-green-600 text-white text-[10px]">Open</Badge>}
                  </CardTitle>
                </div>
                <Link to="/admin/enrollments">
                  <Button variant="outline" size="sm" className="h-7 px-2">Manage</Button>
                </Link>
              </div>
              <CardDescription>Students can enroll during this period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeEnrollment ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Period Name</span>
                    <span className="font-semibold text-green-700">{activeEnrollment.enrollment_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <Badge variant="secondary" className="text-xs">{activeEnrollment.enrollment_type}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Current Enrollees</span>
                    <span className="font-semibold">{activeEnrollment.current_enrollees || 0}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No open enrollment period.</p>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">Enrollment Management</CardTitle>
              </div>
              <CardDescription>Quick enrollment overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border bg-background/70 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Current Enrollees</p>
                  <p className="text-lg font-bold">{activeEnrollment?.current_enrollees || 0}</p>
                </div>
                <div className="rounded-md border border-border bg-background/70 p-2.5">
                  <p className="text-[11px] text-muted-foreground">New Students</p>
                  <p className="text-lg font-bold">{newStudentsCount}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/admin/enrollments">
                  <Button size="sm" className="w-full">Manage</Button>
                </Link>
                <Link to="/admin/enrollment-settings">
                  <Button variant="outline" size="sm" className="w-full">Setup</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Card className="xl:col-span-8 rounded-2xl border shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2">
              <CardTitle className="text-sm font-semibold">Enrollment Trend</CardTitle>
              <CardDescription className="text-xs">Monthly enrollment volume overview</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={enrollmentTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="enrollmentDashboardTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<DashboardTooltip />} />
                    <Area type="monotone" dataKey="value" name="Enrollments" stroke="#3b82f6" strokeWidth={2.5} fill="url(#enrollmentDashboardTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 rounded-2xl border shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2">
              <CardTitle className="text-sm font-semibold">Enrollment Status</CardTitle>
              <CardDescription className="text-xs">Distribution by current enrollment stage</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              <div className="relative h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={enrollmentStatusChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={92} paddingAngle={3}>
                      {enrollmentStatusChart.map((entry: any, idx: number) => <Cell key={`enrollment-status-${idx}`} fill={STATUS_COLORS[entry.name] ?? CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<DashboardTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-7">
                  <div className="text-center">
                    <p className="text-xl font-bold leading-none text-foreground">{enrollmentStatusTotal}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Card className="xl:col-span-2 border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Type Breakdown</CardTitle>
              <CardDescription>Revenue overview based on report payment categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentTypeChart} layout="vertical" margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => value >= 1000 ? `₱${(value / 1000).toFixed(0)}k` : `₱${value}`}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip content={<DashboardTooltip />} />
                    <Bar dataKey="value" name="Revenue" radius={[0, 6, 6, 0]} barSize={18}>
                      {paymentTypeChart.map((_: any, idx: number) => <Cell key={`payment-type-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-violet-500/5">
            <CardHeader className="px-5 pt-5 pb-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Revenue by Item Group</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Uniform category revenue breakdown</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold text-blue-600">
                    ₱{uniformItemGroupChart.reduce((s, i) => s + i.value, 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {uniformRadarData.length === 0 ? (
                <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <p className="text-xs">No uniform order data</p>
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={uniformRadarData} cx="50%" cy="50%" outerRadius="68%">
                      <defs>
                        <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.15} />
                        </linearGradient>
                      </defs>
                      <PolarGrid
                        stroke="hsl(var(--border))"
                        strokeDasharray="3 3"
                        gridType="polygon"
                      />
                      <PolarAngleAxis
                        dataKey="label"
                        tick={({ x, y, payload, cx, cy }: any) => {
                          const dx = x - cx;
                          const dy = y - cy;
                          const dist = Math.sqrt(dx * dx + dy * dy);
                          const nx = dist > 0 ? dx / dist : 0;
                          const ny = dist > 0 ? dy / dist : 0;
                          const px = x + nx * 6;
                          const py = y + ny * 6;
                          const words = String(payload.value).split(" ");
                          return (
                            <text x={px} y={py} textAnchor="middle" dominantBaseline="central" fill="hsl(var(--foreground))" fontSize={9.5} fontWeight={500}>
                              {words.map((word: string, i: number) => (
                                <tspan key={i} x={px} dy={i === 0 ? 0 : 11}>{word}</tspan>
                              ))}
                            </text>
                          );
                        }}
                      />
                      <PolarRadiusAxis tick={false} axisLine={false} tickLine={false} />
                      <Tooltip content={<RadarTooltip />} />
                      <Radar
                        name="Revenue"
                        dataKey="value"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill="url(#radarFill)"
                        dot={{ r: 3.5, fill: "#6366f1", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {(() => {
                const RADAR_LEGEND_COLORS = ["bg-indigo-400","bg-blue-400","bg-violet-400","bg-cyan-400","bg-purple-400"];
                return (
                  <div className="flex flex-wrap gap-1.5 mt-1 px-1">
                    {uniformItemGroupChart.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className={`inline-block w-2 h-2 rounded-full ${RADAR_LEGEND_COLORS[idx % RADAR_LEGEND_COLORS.length]}`} />
                        <span className="truncate max-w-[80px]">{item.name}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Recent Accounts — table layout */}
          <Card className="xl:col-span-8 border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Accounts</CardTitle>
              <CardDescription>Latest student and teacher records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-0 pb-4">
              {/* Students table */}
              <div>
                <div className="flex items-center justify-between px-6 pb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Students</p>
                  <Link to="/admin/users/students"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs">View All</Button></Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border bg-muted/40">
                        <th className="text-left px-6 py-2 text-xs font-semibold text-muted-foreground w-8">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Student ID</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Year Level</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5} className="px-6 py-4 text-xs text-muted-foreground">Loading...</td></tr>
                      ) : recentStudents.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-4 text-xs text-muted-foreground">No students found</td></tr>
                      ) : (
                        recentStudents.slice(0, 6).map((student: any, index: number) => (
                          <tr key={student.id ?? index} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-2.5 text-xs text-muted-foreground">{index + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium truncate max-w-[180px]">{student.first_name} {student.last_name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{student.email}</p>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{student.student_id ?? '—'}</td>
                            <td className="px-3 py-2.5 text-xs">{student.year_level ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <Badge
                                className={`text-[10px] border-0 ${
                                  String(student.status).toLowerCase() === 'active' ? 'bg-gradient-to-r from-primary to-accent text-white' :
                                  String(student.status).toLowerCase() === 'graduated' ? 'bg-blue-100 text-blue-700' :
                                  String(student.status).toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  String(student.status).toLowerCase() === 'transferred' ? 'bg-purple-100 text-purple-700' :
                                  String(student.status).toLowerCase() === 'dropout' ? 'bg-red-100 text-red-700' :
                                  'bg-muted text-muted-foreground'
                                }`}
                              >
                                {student.status ?? 'active'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Teachers table */}
              <div>
                <div className="flex items-center justify-between px-6 pb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teachers</p>
                  <Link to="/admin/users/teachers"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs">View All</Button></Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border bg-muted/40">
                        <th className="text-left px-6 py-2 text-xs font-semibold text-muted-foreground w-8">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Employee ID</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5} className="px-6 py-4 text-xs text-muted-foreground">Loading...</td></tr>
                      ) : recentTeachers.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-4 text-xs text-muted-foreground">No teachers found</td></tr>
                      ) : (
                        recentTeachers.slice(0, 6).map((teacher: any, index: number) => (
                          <tr key={teacher.id ?? index} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-2.5 text-xs text-muted-foreground">{index + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium truncate max-w-[180px]">{teacher.first_name} {teacher.last_name}</p>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{teacher.employee_id ?? '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[160px]">{teacher.email ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <Badge
                                className={`text-[10px] border-0 ${
                                  String(teacher.status).toLowerCase() === 'active'
                                    ? 'bg-gradient-to-r from-primary to-accent text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {teacher.status ?? 'active'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Management Shortcuts — right pane */}
          <Card className="xl:col-span-4 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Management Shortcuts</CardTitle>
              <CardDescription>Fast access to frequently used admin modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                {quickLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <Link key={index} to={link.href}>
                      <div className="p-3 border border-border rounded-lg hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer h-full">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-sm truncate">{link.name}</p>
                              {link.count !== null && <Badge variant="secondary" className="text-[10px]">{link.count}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground leading-4 mt-0.5">{link.description}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
