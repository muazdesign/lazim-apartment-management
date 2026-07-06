"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Payment } from "@/lib/database.types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButtons } from "@/components/shared/export-buttons";
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
import { Undo2 } from "lucide-react";

type PaymentRow = Payment & {
  tenants: { full_name: string } | null;
  invoices: { invoice_number: string } | null;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  check: "Check",
  card: "Card",
  mobile_money: "Mobile money",
  other: "Other",
};

export function PaymentsClient() {
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async (): Promise<PaymentRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .select(
          "*, tenants:tenant_id(full_name), invoices:invoice_id(invoice_number)"
        )
        .order("paid_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const voidPayment = useMutation({
    mutationFn: async (payment: Payment) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("payments")
        .update({ is_voided: true })
        .eq("id", payment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Payment reversed. The invoice balance was updated.");
    },
    onError: () => toast.error("Could not reverse the payment."),
  });

  const rows = payments ?? [];
  const total = rows
    .filter((p) => !p.is_voided)
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every payment ever received, newest first. Nothing here is ever deleted."
        actions={
          <ExportButtons
            spec={{
              title: "Payment Ledger",
              fileName: `payments-${new Date().toISOString().slice(0, 10)}`,
              rows: rows.filter((p) => !p.is_voided),
              columns: [
                { header: "Date", value: (p) => p.paid_at.slice(0, 10) },
                { header: "Tenant", value: (p) => p.tenants?.full_name ?? "" },
                {
                  header: "Invoice #",
                  value: (p) => p.invoices?.invoice_number ?? "",
                },
                { header: "Amount", value: (p) => p.amount },
                {
                  header: "Method",
                  value: (p) => METHOD_LABELS[p.method] ?? p.method,
                },
                { header: "Reference", value: (p) => p.reference ?? "" },
              ],
              summary: [["Total received", formatMoney(total)]],
            }}
          />
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
              No payments recorded yet. Record one from the Invoices page.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">When</TableHead>
                  <TableHead className="text-base">Tenant</TableHead>
                  <TableHead className="text-base">Invoice</TableHead>
                  <TableHead className="text-base">Amount</TableHead>
                  <TableHead className="text-base">Method</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow
                    key={p.id}
                    className={p.is_voided ? "opacity-50" : undefined}
                  >
                    <TableCell className="text-[15px]">
                      {formatDateTime(p.paid_at)}
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {p.tenants?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {p.invoices?.invoice_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-[15px] font-medium">
                        {formatMoney(p.amount)}
                      </span>
                      {p.is_voided && (
                        <Badge
                          variant="secondary"
                          className="ml-2 bg-red-50 text-red-700"
                        >
                          Reversed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {METHOD_LABELS[p.method] ?? p.method}
                      {p.reference && (
                        <p className="text-sm text-muted-foreground">
                          Ref: {p.reference}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {!p.is_voided && (
                        <ConfirmDialog
                          title="Reverse this payment?"
                          description={`This will remove ${formatMoney(p.amount)} from ${p.tenants?.full_name ?? "the tenant"}'s paid total and reopen the invoice balance. Use this if the payment was recorded by mistake or the transfer bounced. The record stays in the ledger, marked as reversed.`}
                          confirmLabel="Yes, reverse payment"
                          onConfirm={() => voidPayment.mutateAsync(p)}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-red-600 hover:text-red-700"
                              aria-label="Reverse payment"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                      )}
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
