import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, ModernTooltip, ReportKpiGrid } from "./reportShared";

type Props = {
  summaryCards: { label: string; value: string }[];
  statusOptions: string[];
  yearLevelOptions: string[];
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  yearLevelFilter: string;
  setYearLevelFilter: (value: string) => void;
  clearFilters: () => void;
  gradeBandChart: any[];
  componentAverageChart: any[];
};

export const StudentGradeReportTab = ({
  summaryCards,
  statusOptions,
  yearLevelOptions,
  statusFilter,
  setStatusFilter,
  yearLevelFilter,
  setYearLevelFilter,
  clearFilters,
  gradeBandChart,
  componentAverageChart,
}: Props) => {
  return (
    <>
      <ReportKpiGrid summaryCards={summaryCards} theme="violet" />

      <Card className="border-0 shadow-lg mb-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Performance Band" /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>{status === "all" ? "All Bands" : status}</SelectItem>
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
            <CardTitle className="text-sm font-semibold">Performance Band Distribution</CardTitle>
            <CardDescription className="text-xs">Grouping by submitted final grade bands</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeBandChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="band" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="count" name="Students" radius={[5, 5, 0, 0]}>
                    {gradeBandChart.map((_: any, index: number) => (
                      <Cell key={`grade-band-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold">Component Averages</CardTitle>
            <CardDescription className="text-xs">Quarter averages and computed final grades</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={componentAverageChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="component" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} domain={[0, 100]} />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="average" name="Average" fill="#a855f7" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
