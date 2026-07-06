"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Expense } from "@/lib/database.types";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButtons } from "@/components/shared/export-buttons";
import {
  ExpenseFormDialog,
  CATEGORY_LABELS,
} from "@/components/expenses/expense-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Sparkles, Trash2 } from "lucide-react";

export function ExpensesClient() {
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async (): Promise<Expense[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("incurred_on", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (expense: Expense) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Expense deleted.");
    },
    onError: () => toast.error("Could not delete the expense."),
  });

  const rows = expenses ?? [];
  const total = rows.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Everything you spend on the property — repairs, bills, and fees."
        actions={
          <>
            <ExportButtons
              spec={{
                title: "Expenses",
                fileName: `expenses-${new Date().toISOString().slice(0, 10)}`,
                rows,
                columns: [
                  { header: "Date", value: (e) => e.incurred_on },
                  { header: "Description", value: (e) => e.description },
                  {
                    header: "Category",
                    value: (e) => CATEGORY_LABELS[e.category] ?? e.category,
                  },
                  { header: "Vendor", value: (e) => e.vendor ?? "" },
                  { header: "Amount", value: (e) => e.amount },
                ],
                summary: [["Total expenses", formatMoney(total)]],
              }}
            />
            <ExpenseFormDialog
              trigger={
                <Button className="h-11 gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  Log expense
                </Button>
              }
            />
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-base text-muted-foreground">
              No expenses logged yet. Use “Log expense” to add the first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Date</TableHead>
                  <TableHead className="text-base">Description</TableHead>
                  <TableHead className="text-base">Category</TableHead>
                  <TableHead className="text-base">Amount</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-[15px]">
                      {formatDate(e.incurred_on)}
                    </TableCell>
                    <TableCell>
                      <p className="text-[15px]">{e.description}</p>
                      {e.vendor && (
                        <p className="text-sm text-muted-foreground">
                          Paid to {e.vendor}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="rounded-full font-medium">
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </Badge>
                        {e.ai_categorized && (
                          <span title="Categorized automatically by AI">
                            <Sparkles
                              className="h-3.5 w-3.5 text-violet-500"
                              aria-label="Categorized automatically by AI"
                            />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[15px] font-medium">
                      {formatMoney(e.amount)}
                    </TableCell>
                    <TableCell>
                      <ConfirmDialog
                        title="Delete this expense?"
                        description={`“${e.description}” (${formatMoney(e.amount)}) will be permanently removed from your records and from profit calculations. This cannot be undone.`}
                        confirmLabel="Yes, delete it"
                        onConfirm={() => remove.mutateAsync(e)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-red-600 hover:text-red-700"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
