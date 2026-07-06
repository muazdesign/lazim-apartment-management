"use client";

import { useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tenant, Unit } from "@/lib/database.types";
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

/** Assign a unit to a tenant by creating an active lease. */
export function LeaseFormDialog({
  tenant,
  trigger,
}: {
  tenant: Tenant;
  trigger: ReactElement;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [dueDay, setDueDay] = useState("1");

  const { data: vacantUnits } = useQuery({
    queryKey: ["units", "vacant"],
    enabled: open,
    queryFn: async (): Promise<Unit[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("status", "vacant")
        .order("unit_number");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("leases").insert({
        tenant_id: tenant.id,
        unit_id: unitId,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: Number(rent),
        security_deposit: Number(deposit || 0),
        payment_due_day: Number(dueDay),
        status: "active",
      });
      if (error) throw error;

      // Reflect occupancy on the unit right away.
      const { error: unitError } = await supabase
        .from("units")
        .update({ status: "occupied" })
        .eq("id", unitId);
      if (unitError) throw unitError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success(`${tenant.full_name} now has a unit assigned.`);
      setOpen(false);
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("one_active_lease_per_unit")
          ? "That unit already has an active lease."
          : "Could not create the lease. Please check the dates and try again."
      ),
  });

  const selectedUnit = vacantUnits?.find((u) => u.id === unitId);

  // Maps each unit id to a readable label so the closed dropdown shows
  // "Unit L201 — floor 2" instead of the raw id.
  const unitItems = (vacantUnits ?? []).map((u) => ({
    value: u.id,
    label: `Unit ${u.unit_number}${u.floor != null ? ` — floor ${u.floor}` : ""}`,
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Assign a unit to {tenant.full_name}
          </DialogTitle>
          <DialogDescription className="text-base">
            Pick an empty unit and set the lease terms. Rent invoices will be
            generated automatically every month.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!unitId) return toast.error("Please choose a unit.");
            if (!startDate || !endDate)
              return toast.error("Please set the lease start and end dates.");
            if (new Date(endDate) <= new Date(startDate))
              return toast.error("The end date must be after the start date.");
            if (!rent || Number(rent) <= 0)
              return toast.error("Please enter the monthly rent.");
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label className="text-base">Unit</Label>
            <Select
              items={unitItems}
              value={unitId}
              onValueChange={(v) => {
                setUnitId(v ?? "");
                const u = vacantUnits?.find((x) => x.id === v);
                if (u && !rent) setRent(String(u.monthly_rent));
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose an empty unit…" />
              </SelectTrigger>
              <SelectContent>
                {(vacantUnits ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    Unit {u.unit_number}
                    {u.floor != null ? ` — floor ${u.floor}` : ""}
                  </SelectItem>
                ))}
                {vacantUnits?.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No vacant units. Free one up under Units first.
                  </p>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start" className="text-base">Lease starts</Label>
              <Input
                id="start"
                type="date"
                className="h-11"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end" className="text-base">Lease ends</Label>
              <Input
                id="end"
                type="date"
                className="h-11"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rent" className="text-base">Monthly rent</Label>
              <Input
                id="rent"
                type="number"
                min="0"
                step="0.01"
                className="h-11"
                placeholder={
                  selectedUnit ? String(selectedUnit.monthly_rent) : "0.00"
                }
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit" className="text-base">Deposit</Label>
              <Input
                id="deposit"
                type="number"
                min="0"
                step="0.01"
                className="h-11"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDay" className="text-base">Rent due on day</Label>
              <Input
                id="dueDay"
                type="number"
                min="1"
                max="28"
                className="h-11"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
          </div>

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
              {mutation.isPending ? "Creating lease…" : "Create lease"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
