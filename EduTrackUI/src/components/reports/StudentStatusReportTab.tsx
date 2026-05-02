import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ModernTooltip, ReportKpiGrid } from "./reportShared";

type Props = {
  summaryCards: { label: string; value: string }[];
  statusOptions: string[];
  yearLevelOptions: string[];
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  yearLevelFilter: string;
  setYearLevelFilter: (value: string) => void;
  clearFilters: () => void;
  studentStatusChart: any[];
  gradeDistributionChart: any[];
};

export const StudentStatusReportTab = ({
  summaryCards,
  statusOptions,
  yearLevelOptions,
  statusFilter,
  setStatusFilter,
  yearLevelFilter,
  setYearLevelFilter,
  clearFilters,
  studentStatusChart,
  gradeDistributionChart,
}: Props) => {
  return (
    <>
      <ReportKpiGrid summaryCards={summaryCards} theme="rose" />

      <Card className="border-0 shadow-lg mb-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
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
            </div>
            <Button variant="outline" onClick={clearFilters} className="h-10 w-full lg:w-[110px] lg:ml-auto">Reset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Student Status</CardTitle>
            <CardDescription className="text-xs">Active, inactive, graduated & other</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentStatusChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[5, 5, 0, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Grade-Level Population</CardTitle>
            <CardDescription className="text-xs">Students by year/grade level</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gradeDistributionChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="grade" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ModernTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#06b6d4" fill="#06b6d420" strokeWidth={2} name="Students" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
