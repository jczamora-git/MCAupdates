import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, ModernTooltip, ReportKpiGrid } from "./reportShared";

type Props = {
  summaryCards: { label: string; value: string }[];
  statusOptions: string[];
  yearLevelOptions: string[];
  enrollmentTypeFilter: string;
  setEnrollmentTypeFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  yearLevelFilter: string;
  setYearLevelFilter: (value: string) => void;
  fromDate: string;
  toDate: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  clearFilters: () => void;
  monthlyTrends: any[];
  enrollmentStatusChart: any[];
  enrollmentTypeChart: any[];
};

export const EnrollmentReportTab = ({
  summaryCards,
  statusOptions,
  yearLevelOptions,
  enrollmentTypeFilter,
  setEnrollmentTypeFilter,
  statusFilter,
  setStatusFilter,
  yearLevelFilter,
  setYearLevelFilter,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  clearFilters,
  monthlyTrends,
  enrollmentStatusChart,
  enrollmentTypeChart,
}: Props) => {
  const radialData = enrollmentTypeChart.map((item: any, i: number) => ({
    ...item,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <>
      <ReportKpiGrid summaryCards={summaryCards} theme="emerald" />

      {/* Filters */}
      <Card className="border-0 shadow-lg mb-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 flex-1">
              <Select value={enrollmentTypeFilter} onValueChange={setEnrollmentTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Enrollment Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {["New Student", "Returning Student", "Transferee", "Continuing Student"].map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>{status === "all" ? "All Status" : status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={yearLevelFilter} onValueChange={setYearLevelFilter}>
                <SelectTrigger><SelectValue placeholder="Year Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {yearLevelOptions.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters} className="h-10 w-full lg:w-[110px] lg:ml-auto">Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Row 1: Enrollment Trend (Area) + Enrollment Type (Radial) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Area Chart — Enrollment Trend */}
        <Card className="xl:col-span-2 rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Enrollment Trend
            </CardTitle>
            <CardDescription className="text-xs">Monthly enrollment volume over time</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrends} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ModernTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="enrollments"
                    name="Enrollments"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#enrollGrad)"
                    dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#3b82f6" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Radial Bar — Enrollment Type */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Enrollment Type</CardTitle>
            <CardDescription className="text-xs">New, returning, transferee &amp; continuing</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="20%"
                  outerRadius="88%"
                  barSize={16}
                  data={radialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: "hsl(var(--muted))" }}
                  />
                  <Tooltip content={<ModernTooltip />} />
                  <Legend
                    iconSize={8}
                    iconType="circle"
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: "10px", lineHeight: "20px" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Status Breakdown — full width */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle>
          <CardDescription className="text-xs">Enrollment count per approval stage</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-5">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={enrollmentStatusChart}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip content={<ModernTooltip />} />
                <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]} barSize={22}>
                  {enrollmentStatusChart.map((_: any, index: number) => (
                    <Cell key={`dist-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
