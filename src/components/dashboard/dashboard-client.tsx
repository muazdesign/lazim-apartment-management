"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useProfile, useCan } from "@/components/profile-context";
import type { DashboardMetrics } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Home,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon
          className={
            tone === "bad"
              ? "h-5 w-5 text-red-500"
              : tone === "good"
                ? "h-5 w-5 text-green-600"
                : "h-5 w-5 text-muted-foreground"
          }
          aria-hidden
        />
      </CardHeader>
      <CardContent>
        <p
          className={
            tone === "bad"
              ? "text-2xl font-bold text-red-600"
              : "text-2xl font-bold"
          }
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardClient() {
  const profile = useProfile();
  const canDo = useCan();
  const showFinancials = canDo("viewFinancialDashboard");

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    enabled: showFinancials,
    queryFn: async (): Promise<DashboardMetrics> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_metrics", {
        p_months: 6,
      });
      if (error) throw error;
      return data as DashboardMetrics;
    },
  });

  // Secretary view: counts only, no money.
  const { data: basics } = useQuery({
    queryKey: ["dashboard-basics"],
    enabled: !showFinancials,
    queryFn: async () => {
      const supabase = createClient();
      const [tenants, units, occupied] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("units").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "occupied"),
      ]);
      return {
        tenants: tenants.count ?? 0,
        units: units.count ?? 0,
        occupied: occupied.count ?? 0,
      };
    },
  });

  const firstName = profile.full_name.split(" ")[0] || "there";

  if (!showFinancials) {
    return (
      <div>
        <PageHeader
          title={`Hello, ${firstName}`}
          description="Here's a quick overview. Use the menu on the left to get around."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Active tenants"
            value={String(basics?.tenants ?? "…")}
            icon={Users}
          />
          <StatCard
            title="Units occupied"
            value={basics ? `${basics.occupied} of ${basics.units}` : "…"}
            icon={Home}
          />
          <Card className="flex flex-col justify-center">
            <CardContent className="space-y-2 pt-6">
              <p className="font-medium">Common tasks</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="h-11 justify-start"
                  render={<Link href="/invoices" />}
                >
                  Create an invoice
                </Button>
                <Button
                  variant="outline"
                  className="h-11 justify-start"
                  render={<Link href="/documents" />}
                >
                  Upload a document
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const monthly =
    metrics?.monthly.map((m) => ({
      ...m,
      label: m.month.slice(5) + "/" + m.month.slice(2, 4),
      profit: m.income - m.expenses,
    })) ?? [];

  const thisMonth = monthly.at(-1);
  const occupancyPct = metrics
    ? metrics.occupancy.total > 0
      ? Math.round((metrics.occupancy.occupied / metrics.occupancy.total) * 100)
      : 0
    : 0;

  return (
    <div>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Here's how the property is doing this month."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Profit this month"
              value={formatMoney(thisMonth?.profit)}
              hint={`Income ${formatMoney(thisMonth?.income)} − expenses ${formatMoney(thisMonth?.expenses)}`}
              icon={TrendingUp}
              tone={(thisMonth?.profit ?? 0) >= 0 ? "good" : "bad"}
            />
            <StatCard
              title="Money still owed to you"
              value={formatMoney(metrics?.outstanding)}
              hint="Unpaid rent across all invoices"
              icon={Wallet}
            />
            <StatCard
              title="Overdue invoices"
              value={String(metrics?.overdue_count ?? 0)}
              hint={
                (metrics?.overdue_count ?? 0) > 0
                  ? "These tenants are late — check Invoices"
                  : "Everyone is up to date"
              }
              icon={AlertTriangle}
              tone={(metrics?.overdue_count ?? 0) > 0 ? "bad" : "good"}
            />
            <StatCard
              title="Occupancy"
              value={`${occupancyPct}%`}
              hint={`${metrics?.occupancy.occupied ?? 0} of ${metrics?.occupancy.total ?? 0} units occupied`}
              icon={Home}
            />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Income vs. expenses — last 6 months</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={13} />
                  <YAxis
                    fontSize={13}
                    tickFormatter={(v: number) => formatMoney(v)}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
