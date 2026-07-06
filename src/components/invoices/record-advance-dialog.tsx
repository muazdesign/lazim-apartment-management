"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, endOfMonth, format } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, PaymentMethod } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock } from "lucide-react";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "card", label: "Card" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "other", label: "Other" },
];

type ActiveLease = {
  id: string;
  tenant_id: string;
  monthly_rent: number;
  payment_due_day: number;
  tenants: { full_name: string } | null;
  units: { unit_number: string } | null;
};

export function RecordAdvanceDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [leaseId, setLeaseId] = useState("");
  const [months, setMonths] = useState("3");
  const [startMonth, setStartMonth] = useState(format(new Date(), "yyyy-MM"));
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");

  const { data: leases } = useQuery({
    queryKey: ["active-leases"],
    enabled: open,
    queryFn: async (): Promise<ActiveLease[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leases")
        .select(
          "id, tenant_id, monthly_rent, payment_due_day, tenants:tenant_id(full_name), units:unit_id(unit_number)"
        )
        .eq("status", "active");
      if (error) throw error;
      return (data as unknown as ActiveLease[]).sort((a, b) =>
        (a.tenants?.full_name ?? "").localeCompare(b.tenants?.full_name ?? "")
      );
    },
  });

  const selectedLease = leases?.find((l) => l.id === leaseId);
  const monthCount = Math.max(0, Math.min(24, Number(months) || 0));

  // Which months will be covered, for the plain-language preview.
  const coveredMonths = useMemo(() => {
    if (!startMonth || monthCount < 1) return [];
    const [y, m] = startMonth.split("-").map(Number);
    const base = new Date(y, m - 1, 1);
    return Array.from({ length: monthCount }, (_, i) =>
      addMonths(base, i)
    );
  }, [startMonth, monthCount]);

  const leaseItems = (leases ?? []).map((l) => ({
    value: l.id,
    label: `${l.tenants?.full_name ?? "Tenant"}${
      l.units ? ` — Unit ${l.units.unit_number}` : ""
    }`,
  }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedLease) throw new Error("no lease");
      const supabase = createClient();
      let covered = 0;

      for (const monthDate of coveredMonths) {
        const periodStart = format(monthDate, "yyyy-MM-01");
        const periodEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
        const dueDate = format(
          new Date(
            monthDate.getFullYear(),
            monthDate.getMonth(),
            selectedLease.payment_due_day
          ),
          "yyyy-MM-dd"
        );

        // Reuse an existing invoice for this month, or create one.
        const { data: existing, error: findErr } = await supabase
          .from("invoices")
          .select("*")
          .eq("lease_id", selectedLease.id)
          .eq("period_start", periodStart)
          .maybeSingle();
        if (findErr) throw findErr;

        let invoice = existing as Invoice | null;
        if (!invoice) {
          const { data: created, error: insErr } = await supabase
            .from("invoices")
            .insert({
              lease_id: selectedLease.id,
              tenant_id: selectedLease.tenant_id,
              period_start: periodStart,
              period_end: periodEnd,
              due_date: dueDate,
              amount: selectedLease.monthly_rent,
              status: "sent",
            })
            .select("*")
            .single();
          if (insErr) throw insErr;
          invoice = created as Invoice;
        }

        // Only pay what's still owed — makes re-running safe (no double pay).
        const remaining = invoice.amount - invoice.amount_paid;
        if (invoice.status !== "void" && remaining > 0) {
          const { error: payErr } = await supabase.from("payments").insert({
            invoice_id: invoice.id,
            tenant_id: selectedLease.tenant_id,
            amount: remaining,
            method,
            reference: reference.trim() || `Advance payment (${monthCount} months)`,
          });
          if (payErr) throw payErr;
          covered += 1;
        }
      }
      return covered;
    },
    onSuccess: (covered) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success(
        covered === 0
          ? "Those months were already fully paid — nothing to change."
          : `Recorded advance payment. ${monthCount} month${
              monthCount === 1 ? "" : "s"
            } are now marked paid.`
      );
      setOpen(false);
      setLeaseId("");
      setReference("");
    },
    onError: () =>
      toast.error("Could not record the advance payment. Please try again."),
  });

  const estimatedTotal = (selectedLease?.monthly_rent ?? 0) * monthCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="h-11 gap-2" />
        }
      >
        <CalendarClock className="h-4 w-4" aria-hidden />
        Record advance payment
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Record an advance payment</DialogTitle>
          <DialogDescription className="text-base">
            For a tenant who paid several months up front. This creates each
            month&apos;s invoice and marks it paid in one step. It&apos;s safe to
            run again — already-paid months won&apos;t be charged twice.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedLease)
              return toast.error("Please choose a tenant first.");
            if (monthCount < 1)
              return toast.error("Please enter how many months were paid.");
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label className="text-base">Tenant</Label>
            <Select items={leaseItems} value={leaseId} onValueChange={(v) => setLeaseId(v ?? "")}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose a tenant with an active lease…" />
              </SelectTrigger>
              <SelectContent>
                {leaseItems.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
                {leases?.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No active leases yet. Assign a unit to a tenant first.
                  </p>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">How many months paid?</Label>
              <Input
                className="h-11"
                type="number"
                min="1"
                max="24"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Starting from</Label>
              <Input
                className="h-11"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">How was it paid?</Label>
              <Select items={METHODS} value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Reference (optional)</Label>
              <Input
                className="h-11"
                placeholder="e.g. bank slip no."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {selectedLease && coveredMonths.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-4 text-[15px]">
              <p className="font-medium">This will mark as paid:</p>
              <p className="mt-1 text-muted-foreground">
                {coveredMonths.map((d) => format(d, "MMM yyyy")).join(", ")}
              </p>
              <p className="mt-2">
                About{" "}
                <span className="font-semibold">
                  {formatMoney(estimatedTotal)}
                </span>{" "}
                total ({formatMoney(selectedLease.monthly_rent)} × {monthCount}).
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11" disabled={mutation.isPending}>
              {mutation.isPending ? "Recording…" : "Record advance payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
