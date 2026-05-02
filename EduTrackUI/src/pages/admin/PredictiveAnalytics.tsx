import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  Area, AreaChart, Cell, ComposedChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Coins, RefreshCw,
  AlertCircle, CheckCircle2, Activity, BarChart2,
} from "lucide-react";

const PREDICTIVE_API_URL = import.meta.env.VITE_PREDICTIVE_API_URL || "http://localhost:5001";

const GRADE_COLUMNS = [
  "Nursery 1", "Nursery 2", "Kinder",
  "Grade 1", "Grade 2", "Grade 3",
  "Grade 4", "Grade 5", "Grade 6",
];

const GRADE_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa",
  "#3b82f6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899",
];

type ApiStatus = "checking" | "online" | "offline";
type HistoricalRow = {
  Year: number; "Nursery 1": number; "Nursery 2": number; Kinder: number;
  "Grade 1": number; "Grade 2": number; "Grade 3": number;
  "Grade 4": number; "Grade 5": number; "Grade 6": number;
  TotalOverall: number; Total_Payment: number;
};
type ForecastPoint = { year: number; prediction: number; lower_bound: number; upper_bound: number };
type GradeForecast = { grade: string; base_year: number; forecast: ForecastPoint[] };
type AllForecast = { base_year: number; forecast_years: number; forecasts: Record<string, ForecastPoint[]> };
type PaymentForecast = { base_year: number; forecast: ForecastPoint[] };
type TrendItem = { grade: string; trend: "increasing" | "decreasing"; slope: number; avg_growth_rate: number; current_value: number; start_value: number };
type Metrics = { enrollment: Record<string, { MAE: number; RMSE: number }>; payment: { MAE: number; RMSE: number } };

const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(val);

const toNum = (value: unknown, fallback = 0) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeHistoricalRows = (rows: unknown): HistoricalRow[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      Year: toNum(row.Year),
      "Nursery 1": toNum(row["Nursery 1"]),
      "Nursery 2": toNum(row["Nursery 2"]),
      Kinder: toNum(row.Kinder),
      "Grade 1": toNum(row["Grade 1"]),
      "Grade 2": toNum(row["Grade 2"]),
      "Grade 3": toNum(row["Grade 3"]),
      "Grade 4": toNum(row["Grade 4"]),
      "Grade 5": toNum(row["Grade 5"]),
      "Grade 6": toNum(row["Grade 6"]),
      TotalOverall: toNum(row.TotalOverall),
      Total_Payment: toNum(row.Total_Payment),
    }))
    .sort((a, b) => a.Year - b.Year);
};

// Custom tooltip  enrollment
const EnrollmentTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-sm mb-2 text-foreground">SY {label}{Number(label) + 1}</p>
      {payload.map((p: any) => {
        if (p.value == null) return null;
        const labels: Record<string, string> = { actual: "Actual", predicted: "Forecast", upper: "Upper 95%", lower: "Lower 95%" };
        const colors: Record<string, string> = { actual: "#6366f1", predicted: "#f59e0b", upper: "#a5b4fc", lower: "#a5b4fc" };
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[p.dataKey] ?? p.color }} />
              <span className="text-muted-foreground">{labels[p.dataKey] ?? p.dataKey}</span>
            </span>
            <span className="font-medium text-foreground">{Math.round(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
};

// Custom tooltip  payment
const PaymentTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-sm mb-2">SY {label}{Number(label) + 1}</p>
      {payload.map((p: any) => {
        if (p.value == null) return null;
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground">{p.dataKey === "actual" ? "Actual Revenue" : "Forecast"}</span>
            </span>
            <span className="font-medium">{formatPeso(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
};

// Custom tooltip  grade bar
const GradeBarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-background border border-border rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-sm mb-1">{d?.fullGrade}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Forecast</span>
        <span className="font-medium">{d?.forecast} students</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Range</span>
        <span>{d?.lower}  {d?.upper}</span>
      </div>
    </div>
  );
};

// Custom X-axis tick with colored dot for grade bar chart
const GradeXTick = ({ x, y, payload, index }: any) => (
  <g transform={`translate(${x},${y})`}>
    <circle r={6} fill={GRADE_COLORS[index % GRADE_COLORS.length]} cy={-10} />
    <text x={0} y={8} textAnchor="middle" fontSize={10} fill="#94a3b8">
      {payload.value}
    </text>
  </g>
);

const PredictiveAnalytics = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [historical, setHistorical] = useState<HistoricalRow[]>([]);
  const [allForecast, setAllForecast] = useState<AllForecast | null>(null);
  const [gradeForecast, setGradeForecast] = useState<GradeForecast | null>(null);
  const [paymentForecast, setPaymentForecast] = useState<PaymentForecast | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedGrade, setSelectedGrade] = useState("TotalOverall");
  const [forecastYears, setForecastYears] = useState("5");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${PREDICTIVE_API_URL}/`);
        if (!active) return;
        setApiStatus(res.ok ? "online" : "offline");
      } catch { if (!active) return; setApiStatus("offline"); }
    };
    check();
    return () => { active = false; };
  }, []);

  const loadAll = useCallback(async () => {
    if (apiStatus !== "online") return;
    setIsLoading(true); setError(null);
    try {
      const [histRes, allFcRes, payFcRes, trendsRes, metricsRes] = await Promise.all([
        fetch(`${PREDICTIVE_API_URL}/api/historical`),
        fetch(`${PREDICTIVE_API_URL}/api/forecast/all?years=${forecastYears}`),
        fetch(`${PREDICTIVE_API_URL}/api/payment/forecast?years=${forecastYears}`),
        fetch(`${PREDICTIVE_API_URL}/api/analysis/trends`),
        fetch(`${PREDICTIVE_API_URL}/api/metrics`),
      ]);
      if (histRes.ok) {
        const d = await histRes.json();
        setHistorical(normalizeHistoricalRows(d.data));
      }
      if (allFcRes.ok) { const d = await allFcRes.json(); setAllForecast(d); }
      if (payFcRes.ok) { const d = await payFcRes.json(); setPaymentForecast(d); }
      if (trendsRes.ok) { const d = await trendsRes.json(); setTrends(d.trends ?? []); }
      if (metricsRes.ok) { const d = await metricsRes.json(); setMetrics(d.metrics ?? null); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, [apiStatus, forecastYears]);

  const loadGradeForecast = useCallback(async () => {
    if (apiStatus !== "online") return;
    try {
      const res = await fetch(`${PREDICTIVE_API_URL}/api/forecast?grade=${encodeURIComponent(selectedGrade)}&years=${forecastYears}`);
      if (res.ok) { const d = await res.json(); setGradeForecast(d); }
    } catch { /* non-critical */ }
  }, [apiStatus, selectedGrade, forecastYears]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadGradeForecast(); }, [loadGradeForecast]);

  const combinedChartData = (() => {
    const histPoints = historical.map((row) => ({
      year: row.Year,
      actual: row[selectedGrade as keyof HistoricalRow] as number,
      predicted: undefined as number | undefined,
      lower: undefined as number | undefined,
      upper: undefined as number | undefined,
    }));
    const fcPoints = (gradeForecast?.forecast ?? []).map((f) => ({
      year: f.year,
      actual: undefined as number | undefined,
      predicted: f.prediction,
      lower: f.lower_bound,
      upper: f.upper_bound,
    }));
    return [...histPoints, ...fcPoints];
  })();

  const paymentChartData = (() => {
    const histPoints = historical.map((row) => ({
      year: row.Year,
      actual: row.Total_Payment,
      predicted: undefined as number | undefined,
      lower: undefined as number | undefined,
      upper: undefined as number | undefined,
    }));
    const fcPoints = (paymentForecast?.forecast ?? []).map((f) => ({
      year: f.year,
      actual: undefined as number | undefined,
      predicted: f.prediction,
      lower: f.lower_bound,
      upper: f.upper_bound,
    }));
    return [...histPoints, ...fcPoints];
  })();

  const gradeBarData = (() => {
    if (!allForecast) return [];
    return GRADE_COLUMNS.map((grade) => {
      const fc = allForecast.forecasts[grade];
      return {
        grade: grade.replace("Nursery ", "N.").replace("Grade ", "G"),
        fullGrade: grade,
        forecast: fc?.[0]?.prediction ?? 0,
        lower: fc?.[0]?.lower_bound ?? 0,
        upper: fc?.[0]?.upper_bound ?? 0,
      };
    });
  })();

  const multiYearData = (() => {
    if (!allForecast) return [];
    const allYears = new Set<number>();
    Object.values(allForecast.forecasts).forEach(fc => fc.forEach(f => allYears.add(f.year)));
    return Array.from(allYears).sort().map(year => {
      const row: Record<string, any> = { year };
      GRADE_COLUMNS.forEach(grade => {
        const fc = allForecast.forecasts[grade];
        const pt = fc?.find(f => f.year === year);
        row[grade] = pt?.prediction ?? null;
      });
      return row;
    });
  })();

  const totalTrend = trends.find((t) => t.grade === "Total Overall");
  const latestHistorical = historical[historical.length - 1];
  const firstForecast = allForecast?.forecasts?.["TotalOverall"]?.[0];
  const enrollmentDelta = firstForecast && latestHistorical
    ? firstForecast.prediction - latestHistorical.TotalOverall : null;
  const paymentNextYear = paymentForecast?.forecast?.[0];
  const paymentDelta = paymentNextYear && latestHistorical
    ? paymentNextYear.prediction - latestHistorical.Total_Payment : null;

  const empty = (msg: string) => (
    <div className="flex flex-col items-center justify-center h-[280px] gap-2 text-muted-foreground">
      <BarChart2 className="h-8 w-8 opacity-30" />
      <p className="text-sm">{msg}</p>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Predictive Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Enrollment &amp; payment forecasting powered by Facebook Prophet time-series models
            </p>
          </div>
          <div className="flex items-center gap-3">
            {apiStatus === "checking" && (
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <Activity className="h-3 w-3 animate-pulse text-amber-500" />
                Connecting
              </Badge>
            )}
            {apiStatus === "online" && (
              <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                API Online
              </Badge>
            )}
            {apiStatus === "offline" && (
              <Badge variant="destructive" className="gap-1.5 px-3 py-1">
                <AlertCircle className="h-3 w-3" />
                API Offline
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={loadAll}
              disabled={isLoading || apiStatus !== "online"}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Offline callout */}
        {apiStatus === "offline" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Predictive Analytics server is offline</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start it with:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  cd ML/Predictive_Analytics/api &amp;&amp; python app.py
                </code>
                {" "}(port 5001)
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Current Enrollment
              </CardDescription>
              <CardTitle className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {latestHistorical?.TotalOverall ?? ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                SY {latestHistorical?.Year ?? ""}{latestHistorical ? latestHistorical.Year + 1 : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Next Year Forecast
              </CardDescription>
              <CardTitle className="text-4xl font-extrabold text-amber-600 dark:text-amber-400">
                {firstForecast?.prediction ?? ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              {enrollmentDelta !== null && (
                <Badge variant="outline"
                  className={enrollmentDelta >= 0
                    ? "text-emerald-700 bg-emerald-500/10 border-emerald-200"
                    : "text-rose-700 bg-rose-500/10 border-rose-200"}>
                  {enrollmentDelta >= 0 ? "+" : ""}{enrollmentDelta} students
                </Badge>
              )}
              {firstForecast && (
                <span className="text-xs text-muted-foreground">
                  {Math.round((firstForecast.upper_bound - firstForecast.lower_bound) / 2)} CI
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${totalTrend?.trend === "increasing" ? "from-emerald-500/5" : "from-rose-500/5"} to-transparent`} />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Enrollment Trend
              </CardDescription>
              <CardTitle className={`text-2xl font-extrabold flex items-center gap-2 ${totalTrend?.trend === "increasing" ? "text-emerald-600" : "text-rose-600"}`}>
                {totalTrend ? (
                  <>
                    {totalTrend.trend === "increasing"
                      ? <TrendingUp className="h-6 w-6" />
                      : <TrendingDown className="h-6 w-6" />}
                    {totalTrend.avg_growth_rate > 0 ? "+" : ""}{totalTrend.avg_growth_rate}% / yr
                  </>
                ) : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Average annual growth rate</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" /> Current Revenue
              </CardDescription>
              <CardTitle className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {latestHistorical ? formatPeso(latestHistorical.Total_Payment) : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              {paymentDelta !== null && (
                <Badge variant="outline"
                  className={paymentDelta >= 0
                    ? "text-emerald-700 bg-emerald-500/10 border-emerald-200"
                    : "text-rose-700 bg-rose-500/10 border-rose-200"}>
                  {paymentDelta >= 0 ? "+" : ""}{formatPeso(paymentDelta)} next yr
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center p-3 rounded-xl bg-muted/40 border border-border/60">
          <span className="text-sm font-medium text-muted-foreground">View settings:</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Grade:</span>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TotalOverall">Total Overall</SelectItem>
                {GRADE_COLUMNS.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Forecast window:</span>
            <Select value={forecastYears} onValueChange={setForecastYears}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} years</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="enrollment">
          <TabsList className="flex-wrap h-auto gap-1 p-1 bg-muted/60">
            <TabsTrigger value="enrollment" className="text-xs sm:text-sm"> Enrollment Forecast</TabsTrigger>
            <TabsTrigger value="grade-breakdown" className="text-xs sm:text-sm"> Grade Breakdown</TabsTrigger>
            <TabsTrigger value="payment" className="text-xs sm:text-sm"> Payment Forecast</TabsTrigger>
            <TabsTrigger value="historical" className="text-xs sm:text-sm"> Historical Data</TabsTrigger>
            <TabsTrigger value="metrics" className="text-xs sm:text-sm"> Model Metrics</TabsTrigger>
          </TabsList>

          {/* ENROLLMENT FORECAST */}
          <TabsContent value="enrollment" className="pt-4 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedGrade === "TotalOverall" ? "Total Enrollment" : selectedGrade} Forecast
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Solid line = historical  Dashed = Prophet forecast  Shaded band = 95% confidence interval
                    </CardDescription>
                  </div>
                  {gradeForecast && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      Base year: {gradeForecast.base_year}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {combinedChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={combinedChartData} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="ciAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip content={<EnrollmentTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                        formatter={(v) =>
                          v === "actual" ? "Actual" :
                          v === "predicted" ? "Forecast" :
                          v === "upper" ? "Upper 95%" : "Lower 95%"
                        }
                      />
                      {latestHistorical && (
                        <ReferenceLine
                          x={latestHistorical.Year}
                          stroke="#94a3b8"
                          strokeDasharray="5 4"
                          strokeWidth={1.5}
                          label={{ value: " Now", position: "top", fontSize: 10, fill: "#94a3b8" }}
                        />
                      )}
                      {/* CI upper fill */}
                      <Area
                        type="monotone"
                        dataKey="upper"
                        stroke="none"
                        fill="url(#ciAreaGrad)"
                        connectNulls
                        legendType="none"
                        activeDot={false}
                        dot={false}
                        isAnimationActive={false}
                      />
                      {/* CI lower boundary line */}
                      <Line
                        type="monotone"
                        dataKey="lower"
                        stroke="#a5b4fc"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls
                        activeDot={false}
                      />
                      {/* Actual with area fill */}
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#actualGrad)"
                        dot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 7, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                        connectNulls
                      />
                      {/* Forecast dashed */}
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="8 4"
                        dot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 7, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : empty(apiStatus === "offline" ? "API offline  start the Flask server" : "Loading data")}

                {/* Forecast detail cards */}
                {gradeForecast && gradeForecast.forecast.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detailed Forecast</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {gradeForecast.forecast.map((row, i) => (
                        <div key={row.year}
                          className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center hover:bg-muted/60 transition-colors">
                          <p className="text-xs text-muted-foreground mb-1">SY {row.year}{row.year + 1}</p>
                          <p className="text-2xl font-bold text-foreground">{row.prediction}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {row.lower_bound}  {row.upper_bound}
                          </p>
                          {i > 0 && gradeForecast.forecast[i - 1] && (
                            <Badge variant="outline"
                              className={`mt-2 text-[10px] px-1.5 py-0 ${row.prediction >= gradeForecast.forecast[i - 1].prediction
                                ? "text-emerald-700 bg-emerald-500/10 border-emerald-200"
                                : "text-rose-700 bg-rose-500/10 border-rose-200"}`}>
                              {row.prediction >= gradeForecast.forecast[i - 1].prediction ? "+" : ""}
                              {row.prediction - gradeForecast.forecast[i - 1].prediction}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GRADE BREAKDOWN */}
          <TabsContent value="grade-breakdown" className="pt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Next-Year Forecast by Grade</CardTitle>
                  <CardDescription>
                    Predicted enrollment for SY {allForecast?.base_year ? allForecast.base_year + 1 : ""}{allForecast?.base_year ? allForecast.base_year + 2 : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {gradeBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gradeBarData} margin={{ top: 16, right: 16, left: 0, bottom: 24 }} barCategoryGap="30%">
                        <defs>
                          {GRADE_COLORS.map((color, i) => (
                            <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={color} stopOpacity={1} />
                              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                        <XAxis dataKey="grade" tick={<GradeXTick />} axisLine={false} tickLine={false} interval={0} height={40} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip content={<GradeBarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                        <Bar dataKey="forecast" name="Forecast" radius={[6, 6, 0, 0]}>
                          {gradeBarData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#barGrad${index % GRADE_COLORS.length})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Grade-Level Trends</CardTitle>
                  <CardDescription>Average annual growth rate per grade level</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {trends.filter(t => t.grade !== "Total Overall" && t.grade !== "Total_Payment").length > 0 ? (
                    trends
                      .filter(t => t.grade !== "Total Overall" && t.grade !== "Total_Payment")
                      .map((t, i) => {
                        const pct = Math.abs(t.avg_growth_rate);
                        const barW = Math.min((pct / 30) * 100, 100);
                        return (
                          <div key={t.grade}>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: GRADE_COLORS[i % GRADE_COLORS.length] }} />
                              <span className="text-sm flex-1 font-medium">{t.grade}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{t.current_value} students</span>
                              <span className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${t.trend === "increasing" ? "text-emerald-600" : "text-rose-600"}`}>
                                {t.trend === "increasing"
                                  ? <TrendingUp className="h-3 w-3" />
                                  : <TrendingDown className="h-3 w-3" />}
                                {t.avg_growth_rate > 0 ? "+" : ""}{t.avg_growth_rate}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${barW}%`,
                                  backgroundColor: t.trend === "increasing"
                                    ? GRADE_COLORS[i % GRADE_COLORS.length]
                                    : "#f43f5e",
                                }} />
                            </div>
                          </div>
                        );
                      })
                  ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">All Grades  Forecast Trend ({forecastYears}-Year)</CardTitle>
                  <CardDescription>Projected enrollment per grade level across the forecast window</CardDescription>
                </CardHeader>
                <CardContent>
                  {multiYearData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={multiYearData} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {GRADE_COLUMNS.map((grade, i) => (
                          <Line key={grade} type="monotone" dataKey={grade} stroke={GRADE_COLORS[i]} strokeWidth={2}
                            dot={{ r: 3, fill: GRADE_COLORS[i], strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: GRADE_COLORS[i], stroke: "#fff", strokeWidth: 1.5 }}
                            connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : historical.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={historical} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="Year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {GRADE_COLUMNS.map((grade, i) => (
                          <Line key={grade} type="monotone" dataKey={grade} stroke={GRADE_COLORS[i]} strokeWidth={2}
                            dot={{ r: 3, fill: GRADE_COLORS[i], strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: GRADE_COLORS[i], stroke: "#fff", strokeWidth: 1.5 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PAYMENT FORECAST */}
          <TabsContent value="payment" className="pt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payment Revenue Forecast</CardTitle>
                  <CardDescription className="mt-1">
                    Historical revenue (solid green) + Prophet forecast (dashed gold) with confidence band
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={360}>
                      <ComposedChart data={paymentChartData} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
                        <defs>
                          <linearGradient id="payActualGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="payFcGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="payCIGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.1} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false} tickLine={false} width={60}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<PaymentTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                          formatter={(v) => v === "actual" ? "Actual Revenue" : v === "predicted" ? "Forecast" : v === "upper" ? "Upper 95%" : "Lower 95%"}
                        />
                        {latestHistorical && (
                          <ReferenceLine
                            x={latestHistorical.Year}
                            stroke="#94a3b8"
                            strokeDasharray="5 4"
                            strokeWidth={1.5}
                            label={{ value: " Now", position: "top", fontSize: 10, fill: "#94a3b8" }}
                          />
                        )}
                        <Area type="monotone" dataKey="upper" stroke="none" fill="url(#payCIGrad)" connectNulls dot={false} activeDot={false} legendType="none" isAnimationActive={false} />
                        <Line type="monotone" dataKey="lower" stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls activeDot={false} />
                        <Area type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} fill="url(#payActualGrad)"
                          dot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                          activeDot={{ r: 7, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} connectNulls />
                        <Area type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="8 4"
                          fill="url(#payFcGrad)"
                          dot={{ r: 5, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
                          activeDot={{ r: 7, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Revenue Forecast</CardTitle>
                  <CardDescription>Next {forecastYears} years</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentForecast && paymentForecast.forecast.length > 0 ? (
                    paymentForecast.forecast.map((row, i) => {
                      const prev = i === 0 ? latestHistorical?.Total_Payment : paymentForecast.forecast[i - 1].prediction;
                      const delta = prev ? row.prediction - prev : null;
                      return (
                        <div key={row.year} className="rounded-xl border border-border/60 bg-muted/30 p-3 hover:bg-muted/60 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-muted-foreground">SY {row.year}{row.year + 1}</span>
                            {delta !== null && (
                              <Badge variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${delta >= 0 ? "text-emerald-700 bg-emerald-500/10 border-emerald-200" : "text-rose-700 bg-rose-500/10 border-rose-200"}`}>
                                {delta >= 0 ? "+" : ""}{formatPeso(delta)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-lg font-bold">{formatPeso(row.prediction)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatPeso(row.lower_bound)}  {formatPeso(row.upper_bound)}
                          </p>
                        </div>
                      );
                    })
                  ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* HISTORICAL DATA */}
          <TabsContent value="historical" className="pt-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Historical Enrollment Data</CardTitle>
                <CardDescription>Training data used to fit the Prophet models</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {historical.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 font-semibold text-muted-foreground whitespace-nowrap pr-4">Year</th>
                        {GRADE_COLUMNS.map((g, i) => (
                          <th key={g} className="text-right py-3 font-semibold text-muted-foreground whitespace-nowrap px-2">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GRADE_COLORS[i] }} />
                              {g}
                            </span>
                          </th>
                        ))}
                        <th className="text-right py-3 font-semibold text-muted-foreground px-2 whitespace-nowrap">Total</th>
                        <th className="text-right py-3 font-semibold text-muted-foreground px-2 whitespace-nowrap">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historical.map((row, ri) => {
                        const prevRow = ri > 0 ? historical[ri - 1] : null;
                        const delta = prevRow ? row.TotalOverall - prevRow.TotalOverall : null;
                        return (
                          <tr key={row.Year}
                            className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${ri === historical.length - 1 ? "bg-primary/5 font-medium" : ""}`}>
                            <td className="py-3 font-semibold pr-4">
                              <span>SY {row.Year}</span>
                              {ri === historical.length - 1 && (
                                <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/20">Latest</Badge>
                              )}
                            </td>
                            {GRADE_COLUMNS.map((g) => (
                              <td key={g} className="text-right py-3 px-2 tabular-nums">
                                {row[g as keyof HistoricalRow] as number}
                              </td>
                            ))}
                            <td className="text-right py-3 px-2 font-bold tabular-nums">
                              {row.TotalOverall}
                              {delta !== null && (
                                <span className={`ml-1.5 text-[10px] ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                                  ({delta > 0 ? "+" : ""}{delta})
                                </span>
                              )}
                            </td>
                            <td className="text-right py-3 px-2 tabular-nums">{formatPeso(row.Total_Payment)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MODEL METRICS */}
          <TabsContent value="metrics" className="pt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Enrollment Model Performance</CardTitle>
                  <CardDescription>MAE &amp; RMSE per grade  lower is better</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics?.enrollment ? (
                    <div className="space-y-3">
                      {Object.entries(metrics.enrollment).map(([grade, m]) => {
                        const quality = m.RMSE < 1 ? "Excellent" : m.RMSE < 2 ? "Very Good" : m.RMSE < 3 ? "Good" : "Fair";
                        const qColor = m.RMSE < 1 ? "#10b981" : m.RMSE < 2 ? "#3b82f6" : m.RMSE < 3 ? "#f59e0b" : "#ef4444";
                        const barW = Math.min((m.RMSE / 5) * 100, 100);
                        return (
                          <div key={grade} className="rounded-lg border border-border/50 bg-muted/20 p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{grade}</span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: qColor + "20", color: qColor }}>
                                {quality}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                              <span>MAE: <strong className="text-foreground">{m.MAE.toFixed(2)}</strong></span>
                              <span>RMSE: <strong className="text-foreground">{m.RMSE.toFixed(2)}</strong></span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${barW}%`, backgroundColor: qColor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payment Model Performance</CardTitle>
                  <CardDescription>Revenue prediction accuracy (Philippine Peso)</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics?.payment ? (
                    <div className="space-y-5">
                      {[
                        { label: "Mean Absolute Error (MAE)", value: metrics.payment.MAE, desc: "Average prediction error per year" },
                        { label: "Root Mean Squared Error (RMSE)", value: metrics.payment.RMSE, desc: "Penalizes larger errors more heavily" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                          <p className="text-3xl font-extrabold text-foreground">{formatPeso(item.value)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                        </div>
                      ))}
                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm">
                        <p className="font-semibold mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          Interpretation
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          On average the payment forecast is off by{" "}
                          <strong className="text-foreground">{formatPeso(metrics.payment.MAE)}</strong> per school year.
                          Given current revenue of{" "}
                          <strong className="text-foreground">{latestHistorical ? formatPeso(latestHistorical.Total_Payment) : ""}</strong>,
                          this is an error rate of{" "}
                          <strong className="text-foreground">
                            {latestHistorical
                              ? ((metrics.payment.MAE / latestHistorical.Total_Payment) * 100).toFixed(1)
                              : ""}%
                          </strong>{" "} considered{" "}
                          <strong className="text-emerald-600">
                            {latestHistorical && ((metrics.payment.MAE / latestHistorical.Total_Payment) * 100) < 10 ? "excellent" : "acceptable"}
                          </strong>.
                        </p>
                      </div>
                    </div>
                  ) : empty(apiStatus === "offline" ? "API offline" : "Loading")}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PredictiveAnalytics;
