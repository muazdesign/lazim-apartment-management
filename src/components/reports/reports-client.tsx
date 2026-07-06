"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ExportButtons } from "@/components/shared/export-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MonthRow {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}

export function ReportsClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const { data: rows, isLoading } = useQuery({
    queryKey: ["profit-report", year],
    queryFn: async (): Promise<MonthRow[]> => {
      const supabase = createClient();
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;

      const [paymentsRes, expensesRes] = await Promise.all([
        supabase
          .from("payments")
          .select("amount, paid_at")
          .eq("is_voided", false)
          .gte("paid_at", from)
          .lte("paid_at", `${to}T23:59:59`),
        supabase
          .from("expenses")
          .select("amount, incurred_on")
          .gte("incurred_on", from)
          .lte("incurred_on", to),
      ]);
      if (paymentsRes.error) throw paymentsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const months: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(Number(year), i, 1).toLocaleString("en-US", {
          month: "long",
        }),
        income: 0,
        expenses: 0,
        profit: 0,
      }));

      for (const p of paymentsRes.data as { amount: number; paid_at: string }[]) {
        months[new Date(p.paid_at).getMonth()].income += p.amount;
      }
      for (const e of expensesRes.data as {
        amount: number;
        incurred_on: string;
      }[]) {
        months[new Date(e.incurred_on).getMonth()].expenses += e.amount;
      }
      for (const m of months) m.profit = m.income - m.expenses;
      return months;
    },
  });

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expenses: acc.expenses + r.expenses,
      profit: acc.profit + r.profit,
    }),
    { income: 0, expenses: 0, profit: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Download your numbers as Excel or PDF with one click."
        actions={
          <ExportButtons
            spec={{
              title: `Profit & Loss ${year}`,
              fileName: `profit-and-loss-${year}`,
              rows: rows ?? [],
              columns: [
                { header: "Month", value: (r) => r.month },
                { header: "Income", value: (r) => r.income },
                { header: "Expenses", value: (r) => r.expenses },
                { header: "Profit", value: (r) => r.profit },
              ],
              summary: [
                ["Total income", formatMoney(totals.income)],
                ["Total expenses", formatMoney(totals.expenses)],
                ["Net profit", formatMoney(totals.profit)],
              ],
            }}
          />
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Profit &amp; loss by month</CardTitle>
            <CardDescription className="text-base">
              Rent received minus expenses, month by month.
            </CardDescription>
          </div>
          <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
            <SelectTrigger className="h-11 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Month</TableHead>
                  <TableHead className="text-right text-base">Income</TableHead>
                  <TableHead className="text-right text-base">Expenses</TableHead>
                  <TableHead className="text-right text-base">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="text-[15px] font-medium">
                      {r.month}
                    </TableCell>
                    <TableCell className="text-right text-[15px] text-green-700">
                      {r.income ? formatMoney(r.income) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-[15px] text-red-700">
                      {r.expenses ? formatMoney(r.expenses) : "—"}
                    </TableCell>
                    <TableCell
                      className={
                        r.profit < 0
                          ? "text-right text-[15px] font-semibold text-red-600"
                          : "text-right text-[15px] font-semibold"
                      }
                    >
                      {r.income || r.expenses ? formatMoney(r.profit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted font-semibold">
                  <TableCell className="text-[15px]">Year total</TableCell>
                  <TableCell className="text-right text-[15px] text-green-700">
                    {formatMoney(totals.income)}
                  </TableCell>
                  <TableCell className="text-right text-[15px] text-red-700">
                    {formatMoney(totals.expenses)}
                  </TableCell>
                  <TableCell
                    className={
                      totals.profit < 0
                        ? "text-right text-[15px] text-red-600"
                        : "text-right text-[15px]"
                    }
                  >
                    {formatMoney(totals.profit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
