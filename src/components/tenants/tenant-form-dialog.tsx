"use client";

import { useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tenant } from "@/lib/database.types";
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
import { Textarea } from "@/components/ui/textarea";

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  national_id: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  notes: "",
};

export function TenantFormDialog({
  tenant,
  trigger,
}: {
  tenant?: Tenant;
  trigger: ReactElement;
}) {
  const isEdit = Boolean(tenant);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(
        tenant
          ? {
              full_name: tenant.full_name,
              email: tenant.email ?? "",
              phone: tenant.phone ?? "",
              national_id: tenant.national_id ?? "",
              emergency_contact_name: tenant.emergency_contact_name ?? "",
              emergency_contact_phone: tenant.emergency_contact_phone ?? "",
              notes: tenant.notes ?? "",
            }
          : EMPTY
      );
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        national_id: form.national_id.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        notes: form.notes.trim() || null,
      };
      const { error } = isEdit
        ? await supabase.from("tenants").update(payload).eq("id", tenant!.id)
        : await supabase.from("tenants").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(isEdit ? "Tenant details saved." : "New tenant added.");
      setOpen(false);
    },
    onError: () =>
      toast.error("Something went wrong saving this tenant. Please try again."),
  });

  function set(field: keyof typeof EMPTY) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? "Edit tenant details" : "Add a new tenant"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEdit
              ? "Update the information below, then press Save."
              : "Fill in the tenant's details. Only the name is required."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.full_name.trim()) {
              toast.error("Please enter the tenant's full name.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-base">
              Full name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="full_name"
              required
              className="h-11"
              placeholder="e.g. Maria Santos"
              value={form.full_name}
              onChange={set("full_name")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">Email</Label>
              <Input
                id="email"
                type="email"
                className="h-11"
                placeholder="maria@example.com"
                value={form.email}
                onChange={set("email")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base">Phone</Label>
              <Input
                id="phone"
                className="h-11"
                placeholder="+1 555 000 0000"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="national_id" className="text-base">
              ID / passport number
            </Label>
            <Input
              id="national_id"
              className="h-11"
              value={form.national_id}
              onChange={set("national_id")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ec_name" className="text-base">
                Emergency contact
              </Label>
              <Input
                id="ec_name"
                className="h-11"
                placeholder="Name"
                value={form.emergency_contact_name}
                onChange={set("emergency_contact_name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ec_phone" className="text-base">
                Their phone
              </Label>
              <Input
                id="ec_phone"
                className="h-11"
                value={form.emergency_contact_phone}
                onChange={set("emergency_contact_phone")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Anything worth remembering about this tenant"
              value={form.notes}
              onChange={set("notes")}
            />
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
              {mutation.isPending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Add tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
