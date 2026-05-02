import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, BadgeCheck, BarChart3, CalendarClock, CheckCircle, Clock, DollarSign, GraduationCap, ShoppingBag, UserCheck, UserX, Users, Wallet } from "lucide-react";

export const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export const ModernTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-xl shadow-lg p-3 text-xs min-w-[170px]">
      {label !== undefined && <p className="font-semibold text-sm mb-2">{label}</p>}
      {payload.map((entry: any, index: number) => (
        <div key={`${entry.dataKey}-${index}`} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary/70" />
            {entry.name || entry.dataKey}
          </span>
          <span className="font-medium text-foreground">{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

type SummaryCard = { label: string; value: string };

type KpiTheme = "emerald" | "sky" | "amber" | "violet" | "rose";

const colorTokens = [
  { gradient: "from-blue-50 to-blue-100", iconBg: "bg-blue-200", labelCls: "text-blue-600", valueCls: "text-blue-700", iconCls: "text-blue-600" },
  { gradient: "from-green-50 to-green-100", iconBg: "bg-green-200", labelCls: "text-green-600", valueCls: "text-green-700", iconCls: "text-green-600" },
  { gradient: "from-yellow-50 to-yellow-100", iconBg: "bg-yellow-200", labelCls: "text-yellow-600", valueCls: "text-yellow-700", iconCls: "text-yellow-600" },
  { gradient: "from-red-50 to-red-100", iconBg: "bg-red-200", labelCls: "text-red-600", valueCls: "text-red-700", iconCls: "text-red-600" },
  { gradient: "from-purple-50 to-purple-100", iconBg: "bg-purple-200", labelCls: "text-purple-600", valueCls: "text-purple-700", iconCls: "text-purple-600" },
  { gradient: "from-indigo-50 to-indigo-100", iconBg: "bg-indigo-200", labelCls: "text-indigo-600", valueCls: "text-indigo-700", iconCls: "text-indigo-600" },
];

const getIconByLabel = (label: string) => {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("revenue") || normalizedLabel.includes("collection") || normalizedLabel.includes("balance")) return Wallet;
  if (normalizedLabel.includes("total orders") || normalizedLabel.includes("order")) return ShoppingBag;
  if (normalizedLabel.includes("total plans") || normalizedLabel.includes("plan")) return CalendarClock;
  if (normalizedLabel.includes("approved") || normalizedLabel.includes("completed") || normalizedLabel.includes("verified")) return BadgeCheck;
  if (normalizedLabel.includes("paid") || normalizedLabel.includes("active")) return UserCheck;
  if (normalizedLabel.includes("unpaid") || normalizedLabel.includes("inactive") || normalizedLabel.includes("rejected")) return UserX;
  if (normalizedLabel.includes("pending") || normalizedLabel.includes("overdue")) return Clock;
  if (normalizedLabel.includes("graduated")) return GraduationCap;
  if (normalizedLabel.includes("student") || normalizedLabel.includes("enrollment")) return Users;
  if (normalizedLabel.includes("dropout") || normalizedLabel.includes("transfer")) return AlertTriangle;

  return BarChart3;
};

export const ReportKpiGrid = ({ summaryCards, theme: _theme }: { summaryCards: SummaryCard[]; theme: KpiTheme }) => {
  return (
    <div className={`grid gap-4 mb-4 grid-cols-2 ${summaryCards.length <= 4 ? "md:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-5"}`}>
      {summaryCards.map((card, idx) => {
        const Icon = getIconByLabel(card.label);
        const colors = colorTokens[idx % colorTokens.length];
        return (
          <Card key={card.label} className={`border-0 shadow-lg bg-gradient-to-br ${colors.gradient}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold ${colors.labelCls}`}>{card.label}</p>
                  <p className={`text-2xl font-bold ${colors.valueCls}`}>{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colors.iconBg}`}>
                  <Icon className={`h-6 w-6 ${colors.iconCls}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
