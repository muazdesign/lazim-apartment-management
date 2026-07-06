"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, InvoiceStatus } from "@/lib/database.types";
import { useCan } from "@/components/profile-context";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButtons } from "@/components/shared/export-buttons";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { RecordAdvanceDialog } from "@/components/invoices/record-advance-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Ban, RefreshCw, Wallet } from "lucide-react";

type InvoiceWithTenant = Invoice & {
  tenants: { full_name: string } | null;
  leases: { units: { unit_number: string } | null } | null;
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Needs payment" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

export function InvoicesClient() {
  const canDo = useCan();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("open");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<InvoiceWithTenant[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "*, tenants:tenant_id(full_name), leases:lease_id(units:unit_id(unit_number))"
        )
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("generate_monthly_invoices");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(
        count === 0
          ? "All rent invoices for this month already exist — nothing new to create."
          : `Created ${count} rent invoice${count === 1 ? "" : "s"} for this month.`
      );
    },
    onError: () =>
      toast.error("Could not generate invoices. Please try again."),
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

  const filtered = (invoices ?? []).filter((i) => {
    switch (filter) {
      case "open":
        return ["sent", "partially_paid", "overdue", "draft"].includes(i.status);
      case "overdue":
        return i.status === "overdue";
      case "paid":
        return i.status === "paid";
      default:
        return true;
    }
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Monthly rent bills for every tenant. Overdue ones show in red."
        actions={
          <>
            <ExportButtons
              spec={{
                title: "Invoices",
                fileName: `invoices-${new Date().toISOString().slice(0, 10)}`,
                rows: filtered,
                columns: [
                  { header: "Invoice #", value: (i) => i.invoice_number },
                  { header: "Tenant", value: (i) => i.tenants?.full_name ?? "" },
                  {
                    header: "Unit",
                    value: (i) => i.leases?.units?.unit_number ?? "",
                  },
                  { header: "Period start", value: (i) => i.period_start },
                  { header: "Due date", value: (i) => i.due_date },
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
            {canDo("createInvoices") && (
              <Button
                className="h-11 gap-2"
                disabled={generate.isPending}
                onClick={() => generate.mutate()}
              >
                <RefreshCw
                  className={
                    generate.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"
                  }
                  aria-hidden
                />
                {generate.isPending
                  ? "Creating…"
                  : "Create this month's invoices"}
              </Button>
            )}
          </>
        }
      />

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="h-11">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="h-9 px-4 text-[15px]">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
              {filter === "overdue"
                ? "Great news — nothing is overdue."
                : "No invoices here yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Invoice</TableHead>
                  <TableHead className="text-base">Tenant</TableHead>
                  <TableHead className="text-base">Due date</TableHead>
                  <TableHead className="text-base">Amount</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <p className="text-[15px] font-medium">{inv.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(inv.period_start)} –{" "}
                        {formatDate(inv.period_end)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[15px]">{inv.tenants?.full_name ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {inv.leases?.units
                          ? `Unit ${inv.leases.units.unit_number}`
                          : ""}
                      </p>
                    </TableCell>
                    <TableCell
                      className={
                        inv.status === "overdue"
                          ? "text-[15px] font-medium text-red-600"
                          : "text-[15px]"
                      }
                    >
                      {formatDate(inv.due_date)}
                    </TableCell>
                    <TableCell>
                      <p className="text-[15px] font-medium">
                        {formatMoney(inv.amount)}
                      </p>
                      {inv.amount_paid > 0 && inv.status !== "paid" && (
                        <p className="text-sm text-muted-foreground">
                          {formatMoney(inv.amount_paid)} received
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>
                      {canDo("manageInvoices") &&
                        inv.status !== "void" &&
                        inv.status !== "paid" && (
                          <div className="flex justify-end gap-1">
                            {canDo("recordPayments") && (
                              <RecordPaymentDialog
                                invoice={inv}
                                tenantName={inv.tenants?.full_name ?? "Tenant"}
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 text-green-700 hover:text-green-800"
                                    aria-label={`Record payment for ${inv.invoice_number}`}
                                    title="Record payment"
                                  >
                                    <Wallet className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            )}
                            <ConfirmDialog
                              title={`Cancel invoice ${inv.invoice_number}?`}
                              description="The invoice will be marked as void and no longer count toward what the tenant owes. This is the safe way to remove a mistaken invoice — nothing is deleted."
                              confirmLabel="Yes, cancel invoice"
                              onConfirm={() => voidInvoice.mutateAsync(inv)}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 text-red-600 hover:text-red-700"
                                  aria-label={`Cancel invoice ${inv.invoice_number}`}
                                  title="Cancel invoice"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
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
