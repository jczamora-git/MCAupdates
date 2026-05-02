import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  uniformItemGroupChart: any[];
  paymentMethodChart: any[];
};

export const UniformOrderReportTab = ({
  summaryCards,
  statusOptions,
  statusFilter,
  setStatusFilter,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  clearFilters,
  uniformItemGroupChart,
  paymentMethodChart,
}: Props) => {
  return (
    <>
      <ReportKpiGrid summaryCards={summaryCards} theme="violet" />

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
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters} className="h-10 w-full lg:w-[110px] lg:ml-auto">Reset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="rounded-2xl border shadow-sm md:col-span-2">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Item Group</CardTitle>
            <CardDescription className="text-xs">Uniform category revenue breakdown</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={uniformItemGroupChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="item" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[5, 5, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Payment Method</CardTitle>
            <CardDescription className="text-xs">How orders were paid</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentMethodChart} dataKey="count" nameKey="name" innerRadius={42} outerRadius={78} paddingAngle={3}>
                    {paymentMethodChart.map((_: any, index: number) => <Cell key={`uniform-pay-method-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ModernTooltip />} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
