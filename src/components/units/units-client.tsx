"use client";

import { useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Unit, UnitStatus, UnitType } from "@/lib/database.types";
import { useCan } from "@/components/profile-context";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";

const STATUS_OPTIONS: { value: UnitStatus; label: string }[] = [
  { value: "vacant", label: "Vacant (ready to rent)" },
  { value: "occupied", label: "Occupied" },
  { value: "maintenance", label: "Under maintenance" },
  { value: "unavailable", label: "Unavailable" },
];

const TYPE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: "flat", label: "Flat / Apartment" },
  { value: "shop", label: "Shop" },
  { value: "warehouse", label: "Warehouse" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
];

const TYPE_LABELS: Record<UnitType, string> = {
  flat: "Flat",
  shop: "Shop",
  warehouse: "Warehouse",
  office: "Office",
  other: "Other",
};

function UnitFormDialog({
  unit,
  trigger,
}: {
  unit?: Unit;
  trigger: ReactElement;
}) {
  const isEdit = Boolean(unit);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    unit_number: "",
    unit_type: "flat" as UnitType,
    floor: "",
    bedrooms: "1",
    bathrooms: "1",
    size_sqm: "",
    monthly_rent: "",
    status: "vacant" as UnitStatus,
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(
        unit
          ? {
              unit_number: unit.unit_number,
              // Fall back to "flat" for rows created before the
              // unit_type column existed (pre-0004 databases).
              unit_type: unit.unit_type ?? "flat",
              floor: unit.floor?.toString() ?? "",
              bedrooms: String(unit.bedrooms),
              bathrooms: String(unit.bathrooms),
              size_sqm: unit.size_sqm?.toString() ?? "",
              monthly_rent: String(unit.monthly_rent),
              status: unit.status,
            }
          : {
              unit_number: "",
              unit_type: "flat",
              floor: "",
              bedrooms: "1",
              bathrooms: "1",
              size_sqm: "",
              monthly_rent: "",
              status: "vacant",
            }
      );
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const isFlat = form.unit_type === "flat";
      const payload = {
        unit_number: form.unit_number.trim(),
        unit_type: form.unit_type,
        floor: form.floor ? Number(form.floor) : null,
        // Bedrooms/bathrooms only make sense for flats.
        bedrooms: isFlat ? Number(form.bedrooms || 0) : 0,
        bathrooms: isFlat ? Number(form.bathrooms || 0) : 0,
        size_sqm: form.size_sqm ? Number(form.size_sqm) : null,
        monthly_rent: Number(form.monthly_rent || 0),
        status: form.status,
      };
      const { error } = isEdit
        ? await supabase.from("units").update(payload).eq("id", unit!.id)
        : await supabase.from("units").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success(isEdit ? "Unit updated." : "Unit added.");
      setOpen(false);
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("unit_number")
          ? "A unit with that number already exists."
          : e.message.includes("unit_type")
            ? "The database needs an update: please run the file supabase/migrations/0004_unit_types_and_tax_access.sql in the Supabase SQL Editor, then try again."
            : `Could not save the unit. (${e.message})`
      ),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? `Edit unit ${unit!.unit_number}` : "Add a new unit"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEdit
              ? "Change the details below, then press Save."
              : "Describe the unit. You can always edit it later."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.unit_number.trim())
              return toast.error("Please enter a unit number, e.g. 3B.");
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Unit number *</Label>
              <Input
                className="h-11"
                placeholder="e.g. 3B, Shop 2"
                value={form.unit_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit_number: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Property type</Label>
              <Select
                items={TYPE_OPTIONS}
                value={form.unit_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, unit_type: (v ?? "flat") as UnitType }))
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.unit_type === "flat" ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-base">Bedrooms</Label>
                <Input
                  className="h-11"
                  type="number"
                  min="0"
                  value={form.bedrooms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bedrooms: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Bathrooms</Label>
                <Input
                  className="h-11"
                  type="number"
                  min="0"
                  value={form.bathrooms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bathrooms: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Floor</Label>
                <Input
                  className="h-11"
                  type="number"
                  value={form.floor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, floor: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Size (m²)</Label>
                <Input
                  className="h-11"
                  type="number"
                  min="0"
                  value={form.size_sqm}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, size_sqm: e.target.value }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-base">Floor</Label>
                <Input
                  className="h-11"
                  type="number"
                  value={form.floor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, floor: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Size (m²)</Label>
                <Input
                  className="h-11"
                  type="number"
                  min="0"
                  value={form.size_sqm}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, size_sqm: e.target.value }))
                  }
                />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Standard monthly rent</Label>
              <Input
                className="h-11"
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_rent}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monthly_rent: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Status</Label>
              <Select
                items={STATUS_OPTIONS}
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as UnitStatus }))
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UnitsClient() {
  const canDo = useCan();
  const queryClient = useQueryClient();

  const { data: units, isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async (): Promise<Unit[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .order("unit_number");
      if (error) throw error;
      // Rows created before the unit_type column existed count as flats.
      return (data as Unit[]).map((u) => ({
        ...u,
        unit_type: u.unit_type ?? "flat",
      }));
    },
  });

  const remove = useMutation({
    mutationFn: async (unit: Unit) => {
      const supabase = createClient();
      const { error } = await supabase.from("units").delete().eq("id", unit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unit deleted.");
    },
    onError: (e: Error) =>
      toast.error(
        // Postgres blocks deleting a unit that still has leases/history.
        e.message.includes("foreign key") || e.message.includes("violates")
          ? "This unit has lease or payment history, so it can't be deleted. Set its status to “Unavailable” instead."
          : "Could not delete the unit. Please try again."
      ),
  });

  return (
    <div>
      <PageHeader
        title="Units"
        description="All your flats, shops, and other units, and whether they're rented."
        actions={
          canDo("manageUnits") && (
            <UnitFormDialog
              trigger={
                <Button className="h-11 gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  Add unit
                </Button>
              }
            />
          )
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
          ) : (units ?? []).length === 0 ? (
            <p className="p-10 text-center text-base text-muted-foreground">
              No units yet. Add your first unit to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Unit</TableHead>
                  <TableHead className="text-base">Layout</TableHead>
                  <TableHead className="text-base">Standard rent</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(units ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="text-[15px] font-medium">
                        {u.unit_type === "flat" ? "Unit " : ""}
                        {u.unit_number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {TYPE_LABELS[u.unit_type]}
                        {u.floor != null ? ` · Floor ${u.floor}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {u.unit_type === "flat"
                        ? `${u.bedrooms} bed · ${u.bathrooms} bath${
                            u.size_sqm ? ` · ${u.size_sqm} m²` : ""
                          }`
                        : u.size_sqm
                          ? `${u.size_sqm} m²`
                          : "—"}
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {formatMoney(u.monthly_rent)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell>
                      {canDo("manageUnits") && (
                        <div className="flex justify-end gap-1">
                          <UnitFormDialog
                            unit={u}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10"
                                aria-label={`Edit ${u.unit_number}`}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <ConfirmDialog
                            title={`Delete ${u.unit_number}?`}
                            description="This permanently removes the unit. It only works if the unit has never had a tenant or invoice — otherwise its history would be lost, so the system will keep it and ask you to mark it “Unavailable” instead."
                            confirmLabel="Yes, delete unit"
                            onConfirm={() => remove.mutateAsync(u)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-red-600 hover:text-red-700"
                                aria-label={`Delete ${u.unit_number}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
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
