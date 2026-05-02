import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, ModernTooltip, ReportKpiGrid } from "./reportShared";

type Props = {
  summaryCards: { label: string; value: string }[];
  statusOptions: string[];
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  fromDate: string;
  toDate: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  clearFilters: () => void;
  planStatusChart: any[];
  scheduleTypeChart: any[];
};

export const PaymentPlanReportTab = ({
  summaryCards,
  statusOptions,
  statusFilter,
  setStatusFilter,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  clearFilters,
  planStatusChart,
  scheduleTypeChart,
}: Props) => {
  const planTotal = planStatusChart.reduce((sum: number, d: any) => sum + (d.value ?? 0), 0);

  return (
    <>
      <ReportKpiGrid summaryCards={summaryCards} theme="amber" />

      {/* Filters */}
      <Card className="border-0 shadow-lg mb-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
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

      {/* Row 1: Plan Status Donut + Schedule Type Horizontal Bar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Donut — Plan Status with center total */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Plan Status</CardTitle>
            <CardDescription className="text-xs">Active, completed, overdue &amp; cancelled</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planStatusChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {planStatusChart.map((_: any, index: number) => (
                      <Cell key={`plan-status-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ModernTooltip />} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-7">
                <div className="text-center">
                  <p className="text-2xl font-bold leading-none text-foreground">{planTotal}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Horizontal Bar — Schedule Type */}
        <Card className="xl:col-span-2 rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Schedule Type</CardTitle>
            <CardDescription className="text-xs">Plans per payment schedule — monthly, quarterly, semestral &amp; more</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-5">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scheduleTypeChart}
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
                    width={96}
                  />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="value" name="Plans" radius={[0, 6, 6, 0]} barSize={24}>
                    {scheduleTypeChart.map((_: any, index: number) => (
                      <Cell key={`sched-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
