"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Lease, Tenant } from "@/lib/database.types";
import { useCan } from "@/components/profile-context";
import { formatMoney, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButtons } from "@/components/shared/export-buttons";
import { TenantFormDialog } from "@/components/tenants/tenant-form-dialog";
import { LeaseFormDialog } from "@/components/tenants/lease-form-dialog";
import { LeaseManageDialog } from "@/components/tenants/lease-manage-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Home, KeyRound, Pencil, Search, UserPlus, UserX } from "lucide-react";

type LeaseWithUnit = Lease & { units: { unit_number: string } | null };
type TenantWithLeases = Tenant & { leases: LeaseWithUnit[] };

export function TenantsClient() {
  const canDo = useCan();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async (): Promise<TenantWithLeases[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tenants")
        .select("*, leases(*, units:unit_id(unit_number))")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const deactivate = useMutation({
    mutationFn: async (tenant: Tenant) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tenants")
        .update({ is_active: !tenant.is_active })
        .eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: (_, tenant) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(
        tenant.is_active
          ? `${tenant.full_name} was archived. Their history is kept.`
          : `${tenant.full_name} is active again.`
      );
    },
    onError: () => toast.error("Could not update the tenant. Please try again."),
  });

  const filtered = (tenants ?? []).filter((t) => {
    const q = search.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(q) ||
      (t.email ?? "").toLowerCase().includes(q) ||
      (t.phone ?? "").includes(q) ||
      t.leases.some((l) => l.units?.unit_number.toLowerCase().includes(q))
    );
  });

  const activeLease = (t: TenantWithLeases) =>
    t.leases.find((l) => l.status === "active");

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Everyone who rents from you, with their unit and lease."
        actions={
          <>
            <ExportButtons
              spec={{
                title: "Tenant List",
                fileName: `tenants-${new Date().toISOString().slice(0, 10)}`,
                rows: filtered,
                columns: [
                  { header: "Name", value: (t) => t.full_name },
                  { header: "Email", value: (t) => t.email ?? "" },
                  { header: "Phone", value: (t) => t.phone ?? "" },
                  {
                    header: "Unit",
                    value: (t) => activeLease(t)?.units?.unit_number ?? "—",
                  },
                  {
                    header: "Monthly rent",
                    value: (t) => activeLease(t)?.monthly_rent ?? "",
                  },
                  {
                    header: "Lease ends",
                    value: (t) => activeLease(t)?.end_date ?? "",
                  },
                  { header: "Status", value: (t) => (t.is_active ? "Active" : "Archived") },
                ],
              }}
            />
            {canDo("manageTenants") && (
              <TenantFormDialog
                trigger={
                  <Button className="h-11 gap-2">
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Add tenant
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search by name, phone, or unit…"
          className="h-11 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
              {search
                ? "No tenants match your search."
                : "No tenants yet. Use the “Add tenant” button to create the first one."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Tenant</TableHead>
                  <TableHead className="text-base">Contact</TableHead>
                  <TableHead className="text-base">Unit</TableHead>
                  <TableHead className="text-base">Lease</TableHead>
                  <TableHead className="text-base">Rent</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const lease = activeLease(t);
                  return (
                    <TableRow
                      key={t.id}
                      className={!t.is_active ? "opacity-50" : undefined}
                    >
                      <TableCell>
                        <p className="text-[15px] font-medium">{t.full_name}</p>
                        {!t.is_active && (
                          <p className="text-sm text-muted-foreground">Archived</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-[15px]">{t.phone ?? "—"}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.email ?? ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-[15px]">
                        {lease?.units ? `Unit ${lease.units.unit_number}` : "—"}
                      </TableCell>
                      <TableCell>
                        {lease ? (
                          <div className="space-y-1">
                            <StatusBadge status={lease.status} />
                            <p className="text-sm text-muted-foreground">
                              until {formatDate(lease.end_date)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No lease</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[15px]">
                        {lease ? formatMoney(lease.monthly_rent) : "—"}
                      </TableCell>
                      <TableCell>
                        {canDo("manageTenants") && (
                          <div className="flex justify-end gap-1">
                            <TenantFormDialog
                              tenant={t}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10"
                                  aria-label={`Edit ${t.full_name}`}
                                  title="Edit details"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              }
                            />
                            {!lease && t.is_active && (
                              <LeaseFormDialog
                                tenant={t}
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10"
                                    aria-label={`Assign a unit to ${t.full_name}`}
                                    title="Assign a unit"
                                  >
                                    <Home className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            )}
                            {lease && t.is_active && (
                              <LeaseManageDialog
                                lease={lease}
                                tenantName={t.full_name}
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10"
                                    aria-label={`Manage ${t.full_name}'s lease`}
                                    title="Manage lease (edit or end)"
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            )}
                            <ConfirmDialog
                              title={
                                t.is_active
                                  ? `Archive ${t.full_name}?`
                                  : `Restore ${t.full_name}?`
                              }
                              description={
                                t.is_active
                                  ? "The tenant will be hidden from day-to-day lists, but all their invoices and payment history will be kept. You can restore them at any time."
                                  : "The tenant will appear in your active lists again."
                              }
                              confirmLabel={
                                t.is_active ? "Yes, archive tenant" : "Yes, restore"
                              }
                              onConfirm={() => deactivate.mutateAsync(t)}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 text-red-600 hover:text-red-700"
                                  aria-label={
                                    t.is_active
                                      ? `Archive ${t.full_name}`
                                      : `Restore ${t.full_name}`
                                  }
                                  title={
                                    t.is_active ? "Archive tenant" : "Restore tenant"
                                  }
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
