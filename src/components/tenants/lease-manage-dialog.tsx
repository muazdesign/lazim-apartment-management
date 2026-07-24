"use client";

import { useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Lease } from "@/lib/database.types";
import { formatDate, formatMoney } from "@/lib/format";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LogOut } from "lucide-react";
import { EthiopianDatePicker } from "@/components/ui/ethiopian-date-picker";
import { LeaseDocumentDialog } from "./lease-document-dialog";

type LeaseWithUnit = Lease & { units: { unit_number: string } | null };

/**
 * Edit the terms of an active lease, or end it (tenant moved out).
 * Ending a lease frees the unit and keeps all past invoices/payments.
 */
export function LeaseManageDialog({
  lease,
  tenantName,
  trigger,
}: {
  lease: LeaseWithUnit;
  tenantName: string;
  trigger: ReactElement;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rent, setRent] = useState(String(lease.monthly_rent));
  const [endDate, setEndDate] = useState(lease.end_date);
  const [dueDay, setDueDay] = useState(String(lease.payment_due_day));

  const unitLabel = lease.units ? `Unit ${lease.units.unit_number}` : "the unit";

  const save = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("leases")
        .update({
          monthly_rent: Number(rent),
          end_date: endDate,
          payment_due_day: Number(dueDay),
        })
        .eq("id", lease.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Lease updated.");
      setOpen(false);
    },
    onError: () => toast.error("Could not update the lease. Please try again."),
  });

  const endLease = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("leases")
        .update({ status: "terminated" })
        .eq("id", lease.id);
      if (error) throw error;

      // Free the unit so it can be rented again.
      const { error: unitError } = await supabase
        .from("units")
        .update({ status: "vacant" })
        .eq("id", lease.unit_id);
      if (unitError) throw unitError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success(`Lease ended. ${unitLabel} is now vacant.`);
      setOpen(false);
    },
    onError: () => toast.error("Could not end the lease. Please try again."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Manage lease</DialogTitle>
          <DialogDescription className="text-base">
            {tenantName} — {unitLabel}, {formatMoney(lease.monthly_rent)} / month
            until {formatDate(lease.end_date)}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end pt-2 pb-4 border-b border-border mb-4">
          <LeaseDocumentDialog lease={{ id: lease.id }} />
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rent || Number(rent) <= 0)
              return toast.error("Please enter the monthly rent.");
            if (new Date(endDate) <= new Date(lease.start_date))
              return toast.error(
                "The end date must be after the lease start date."
              );
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Monthly rent</Label>
              <Input
                className="h-11"
                type="number"
                min="0"
                step="0.01"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Rent due on day</Label>
              <Input
                className="h-11"
                type="number"
                min="1"
                max="30"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <EthiopianDatePicker
                label="Lease ends"
                value={endDate}
                onChange={setEndDate}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>

        <div className="mt-2 rounded-lg border border-red-100 bg-red-50/50 p-4">
          <p className="font-medium">End this lease</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this when the tenant moves out. {unitLabel} becomes vacant and
            available to rent again. All past invoices and payments are kept.
          </p>
          <ConfirmDialog
            title={`End ${tenantName}'s lease?`}
            description={`${unitLabel} will be marked vacant and can be assigned to someone else. This does not delete any invoices or payment history — it simply frees up the unit.`}
            confirmLabel="Yes, end the lease"
            onConfirm={() => endLease.mutateAsync()}
            trigger={
              <Button
                variant="outline"
                className="mt-3 h-11 gap-2 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                End lease (tenant moved out)
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
