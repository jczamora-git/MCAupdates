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
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, ModernTooltip, ReportKpiGrid } from "./reportShared";

type Props = {
  summaryCards: { label: string; value: string }[];
  statusOptions: string[];
  paymentTypeFilter: string;
  setPaymentTypeFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  fromDate: string;
  toDate: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  clearFilters: () => void;
  paymentStatusChart: any[];
  paymentTypeChart: any[];
  paymentMethodChart: any[];
  monthlyTrends: any[];
};

export const PaymentReportTab = ({
  summaryCards,
  statusOptions,
  paymentTypeFilter,
  setPaymentTypeFilter,
  statusFilter,
  setStatusFilter,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  clearFilters,
  paymentStatusChart,
  paymentTypeChart,
  paymentMethodChart,
  monthlyTrends,
}: Props) => {
  const statusTotal = paymentStatusChart.reduce((sum: number, d: any) => sum + (d.value ?? 0), 0);

  const maxCount = Math.max(...paymentMethodChart.map((d: any) => d.count as number), 1);
  const radarMethodData = paymentMethodChart.map((item: any) => ({
    ...item,
    fullMark: maxCount,
  }));

  return (
    <>
      <ReportKpiGrid summaryCards={summaryCards} theme="sky" />

      {/* Filters */}
      <Card className="border-0 shadow-lg mb-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
              <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Payment Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {["Tuition Full Payment", "Tuition Installment", "Miscellaneous", "Contribution", "Event Fee", "Book", "Uniform", "Service Fee", "Other"].map((type) => (
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
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters} className="h-10 w-full lg:w-[110px] lg:ml-auto">Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Row 1: Collection Trend (Area) + Payment Status (Donut) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Area Chart — Collection Trend */}
        <Card className="xl:col-span-2 rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Collection Trend
            </CardTitle>
            <CardDescription className="text-xs">Monthly payment revenue over time</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrends} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="collectGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
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
                    width={44}
                    tickFormatter={(v) => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
                  />
                  <Tooltip content={<ModernTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="collections"
                    name="Collections (₱)"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    fill="url(#collectGrad)"
                    dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#22c55e" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Donut — Payment Status with center total */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Payment Status</CardTitle>
            <CardDescription className="text-xs">Paid vs unpaid vs overdue</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="relative h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStatusChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {paymentStatusChart.map((_: any, index: number) => (
                      <Cell key={`pay-status-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ModernTooltip />} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-7">
                <div className="text-center">
                  <p className="text-2xl font-bold leading-none text-foreground">{statusTotal}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Students</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Payment Type Horizontal Bar + Payment Method Radial */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Horizontal Bar — Payment Type Breakdown */}
        <Card className="xl:col-span-2 rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Payment Type Breakdown</CardTitle>
            <CardDescription className="text-xs">Revenue collected per payment category</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-5">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={paymentTypeChart}
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
                    tickFormatter={(v) => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="value" name="Revenue (₱)" radius={[0, 6, 6, 0]} barSize={20}>
                    {paymentTypeChart.map((_: any, index: number) => (
                      <Cell key={`pay-type-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Radar — Payment Method */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Payment Method</CardTitle>
            <CardDescription className="text-xs">Transaction count by preferred method</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-64">
              {radarMethodData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarMethodData}>
                    <defs>
                      <linearGradient id="radarMethodFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" gridType="polygon" />
                    <PolarAngleAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <PolarRadiusAxis tick={false} axisLine={false} tickLine={false} />
                    <Radar
                      name="Transactions"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#radarMethodFill)"
                      dot={{ r: 3.5, fill: "#3b82f6", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                    />
                    <Tooltip content={<ModernTooltip />} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
