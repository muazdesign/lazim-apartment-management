"use client";

import React, { useEffect, useState, Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, Payment, InvoiceStatus } from "@/lib/database.types";
import { useCan } from "@/components/profile-context";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButtons } from "@/components/shared/export-buttons";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { RecordAdvanceDialog } from "@/components/invoices/record-advance-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Ban, RefreshCw, Wallet, Undo2, ChevronDown, ChevronUp } from "lucide-react";
import { generateInvoicesAction } from "@/app/actions/billing";
import { PendingReceipts } from "@/components/payments/pending-receipts";

type InvoiceWithTenant = Invoice & {
  tenants: { full_name: string } | null;
  leases: { units: { unit_number: string } | null } | null;
  payments: Payment[];
};

export function InvoicesClient() {
  const canDo = useCan();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("open");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Auto-generate invoices on mount
  useEffect(() => {
    if (!canDo("createInvoices")) return;
    generateInvoicesAction().then((res) => {
      if (res.success && res.count > 0) {
        toast.success(`Generated ${res.count} new invoices for this cycle.`);
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      }
    });
  }, [canDo, queryClient]);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<InvoiceWithTenant[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "*, tenants:tenant_id(full_name), leases:lease_id(units:unit_id(unit_number)), payments(*)"
        )
        .order("due_date", { ascending: false });
      if (error) throw error;
      
      // Sort payments by date descending
      return (data || []).map(inv => ({
        ...inv,
        payments: (inv.payments || []).sort((a: Payment, b: Payment) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      })) as unknown as InvoiceWithTenant[];
    },
  });

  const voidInvoice = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("invoices")
        .update({ status: "void" satisfies InvoiceStatus })
        .eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice cancelled.");
    },
    onError: () => toast.error("Could not cancel the invoice."),
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Payment reversed. The invoice balance was updated.");
    },
    onError: () => toast.error("Could not reverse the payment."),
  });

  const filtered = (invoices ?? []).filter((i) => {
    switch (filter) {
      case "open":
        return ["sent", "partially_paid", "overdue", "draft"].includes(i.status);
      case "paid":
        return i.status === "paid";
      case "void":
        return i.status === "void";
      default:
        return true;
    }
  });

  const toggleExpand = (id: string) => {
    setExpandedInvoice(expandedInvoice === id ? null : id);
  };

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Manage tenant invoices, receipts, and payment ledger in one place."
        actions={
          <>
            <ExportButtons
              spec={{
                title: "Invoices",
                fileName: `billing-${new Date().toISOString().slice(0, 10)}`,
                rows: filtered,
                columns: [
                  { header: "Invoice #", value: (i) => i.invoice_number },
                  { header: "Tenant", value: (i) => i.tenants?.full_name ?? "" },
                  { header: "Unit", value: (i) => i.leases?.units?.unit_number ?? "" },
                  { header: "Period", value: (i) => `${i.period_start} to ${i.period_end}` },
                  { header: "Amount", value: (i) => i.amount },
                  { header: "Paid", value: (i) => i.amount_paid },
                  { header: "Status", value: (i) => i.status },
                ],
                summary: [
                  [
                    "Total outstanding",
                    formatMoney(
                      filtered
                        .filter((i) => i.status !== "void")
                        .reduce((s, i) => s + (i.amount - i.amount_paid), 0)
                    ),
                  ],
                ],
              }}
            />
            {canDo("recordPayments") && <RecordAdvanceDialog />}
          </>
        }
      />

      <Tabs defaultValue="invoices" className="mb-4 space-y-4">
        <TabsList className="h-11">
          <TabsTrigger value="invoices" className="h-9 px-4 text-[15px]">Invoices & Ledger</TabsTrigger>
          <TabsTrigger value="receipts" className="h-9 px-4 text-[15px]">Pending Telegram Receipts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="receipts" className="m-0">
           <PendingReceipts />
        </TabsContent>

        <TabsContent value="invoices" className="m-0">
          <div className="flex gap-2 mb-4">
            <Button variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")} size="sm">Outstanding</Button>
            <Button variant={filter === "paid" ? "default" : "outline"} onClick={() => setFilter("paid")} size="sm">Paid</Button>
            <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} size="sm">All</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-10 text-center text-base text-muted-foreground">
                  No invoices found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Tenant & Unit</TableHead>
                      <TableHead className="text-base">Coverage Period</TableHead>
                      <TableHead className="text-base">Amount</TableHead>
                      <TableHead className="text-base">Status</TableHead>
                      <TableHead className="text-right text-base pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv) => (
                      <React.Fragment key={inv.id}>
                        <TableRow 
                          className={`cursor-pointer hover:bg-muted/50 transition-colors ${expandedInvoice === inv.id ? "bg-muted/30" : ""}`}
                          onClick={() => toggleExpand(inv.id)}
                        >
                          <TableCell>
                            <p className="text-[15px]">{inv.tenants?.full_name ?? "—"}</p>
                            <p className="text-sm text-muted-foreground">
                              {inv.leases?.units ? `Unit ${inv.leases.units.unit_number}` : ""}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-[15px] font-medium">
                              {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-[15px] font-medium">{formatMoney(inv.amount)}</p>
                            {inv.amount_paid > 0 && inv.status !== "paid" && (
                              <p className="text-sm text-muted-foreground">{formatMoney(inv.amount_paid)} paid</p>
                            )}
                          </TableCell>
                          <TableCell><StatusBadge status={inv.status} /></TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {canDo("manageInvoices") && inv.status !== "void" && inv.status !== "paid" && (
                              <div className="flex justify-end gap-1">
                                {canDo("recordPayments") && (
                                  <RecordPaymentDialog
                                    invoice={inv}
                                    tenantName={inv.tenants?.full_name ?? "Tenant"}
                                    trigger={
                                      <Button variant="ghost" size="icon" className="h-10 w-10 text-green-700 hover:text-green-800 hover:bg-green-100/50" title="Record payment">
                                        <Wallet className="h-4 w-4" />
                                      </Button>
                                    }
                                  />
                                )}
                                <ConfirmDialog
                                  title={`Cancel pending payment for ${inv.tenants?.full_name ?? "Tenant"}?`}
                                  description="This will safely cancel this payment request."
                                  confirmLabel="Yes, cancel it"
                                  onConfirm={() => voidInvoice.mutateAsync(inv)}
                                  trigger={
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-100/50" title="Cancel payment request">
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  }
                                />
                              </div>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* EXPANDED PAYMENTS ROW */}
                        {expandedInvoice === inv.id && (
                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={7} className="p-0 border-b">
                              <div className="pl-14 pr-6 py-4">
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                  <Wallet className="h-4 w-4" /> Payment Ledger
                                </h4>
                                {inv.payments.length === 0 ? (
                                  <p className="text-sm text-muted-foreground italic">No payments recorded for this invoice yet.</p>
                                ) : (
                                  <div className="rounded-md border bg-background">
                                    <Table>
                                      <TableHeader className="bg-muted/50">
                                        <TableRow>
                                          <TableHead className="h-8 text-xs">Date</TableHead>
                                          <TableHead className="h-8 text-xs">Amount</TableHead>
                                          <TableHead className="h-8 text-xs">Method</TableHead>
                                          <TableHead className="h-8 w-[100px]"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {inv.payments.map((p) => (
                                          <TableRow key={p.id} className={p.is_voided ? "opacity-50" : ""}>
                                            <TableCell className="py-2 text-sm">{formatDateTime(p.paid_at)}</TableCell>
                                            <TableCell className="py-2 text-sm font-medium">
                                              {formatMoney(p.amount)}
                                              {p.is_voided && <Badge variant="secondary" className="ml-2 bg-red-50 text-red-700 text-[10px]">Void</Badge>}
                                            </TableCell>
                                            <TableCell className="py-2 text-sm capitalize">{p.method.replace('_', ' ')}</TableCell>
                                            <TableCell className="py-2 text-right">
                                              {!p.is_voided && canDo("recordPayments") && (
                                                <ConfirmDialog
                                                  title="Reverse payment?"
                                                  description={`Reverse ${formatMoney(p.amount)}? The balance will reopen.`}
                                                  confirmLabel="Yes, reverse"
                                                  onConfirm={() => voidPayment.mutateAsync(p)}
                                                  trigger={
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600">
                                                      <Undo2 className="h-3 w-3" />
                                                    </Button>
                                                  }
                                                />
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
