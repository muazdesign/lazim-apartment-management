"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog, Profile, UserRole } from "@/lib/database.types";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  UserPlus,
  UserX,
  Users,
  Building2,
  FileKey2,
  Wallet,
  FileText,
  UserCog,
  Calculator,
  ScrollText,
  Trash2,
  AlertTriangle,
  TriangleAlert,
} from "lucide-react";

function NewUserDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("secretary");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(`Account created for ${email}.`);
      setOpen(false);
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("secretary");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-11 gap-2" />}>
        <UserPlus className="h-4 w-4" aria-hidden />
        Add staff account
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Add a staff account</DialogTitle>
          <DialogDescription className="text-base">
            The person can sign in right away with the password you set here.
            Ask them to change it after their first login.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length < 8)
              return toast.error("The password needs at least 8 characters.");
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label className="text-base">Full name</Label>
            <Input
              className="h-11"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Email</Label>
            <Input
              className="h-11"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Temporary password</Label>
            <Input
              className="h-11"
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Role</Label>
            <Select
              items={ROLE_LABELS}
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="secretary">
                  Secretary — day-to-day tasks, no financial totals
                </SelectItem>
                <SelectItem value="manager">
                  Manager — full operations and financials
                </SelectItem>
                <SelectItem value="tech_admin">
                  Tech Admin — everything, including system settings
                </SelectItem>
              </SelectContent>
            </Select>
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
              {mutation.isPending ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  DATA WIPE CATEGORY DEFINITIONS                                     */
/* ------------------------------------------------------------------ */

interface WipeCategory {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  tables: string[]; // tables to count
}

const WIPE_CATEGORIES: WipeCategory[] = [
  {
    key: "tenants",
    label: "Tenants",
    description:
      "All tenant records and their linked leases, invoices, and payments",
    icon: <Users className="h-5 w-5" />,
    tables: ["tenants"],
  },
  {
    key: "units",
    label: "Units",
    description:
      "All apartment, shop, and other unit records (leases must go too)",
    icon: <Building2 className="h-5 w-5" />,
    tables: ["units"],
  },
  {
    key: "leases",
    label: "Leases",
    description: "All lease agreements plus their invoices and payments",
    icon: <FileKey2 className="h-5 w-5" />,
    tables: ["leases"],
  },
  {
    key: "finance",
    label: "Finance",
    description: "Invoices, payments, expenses, and payment reminders",
    icon: <Wallet className="h-5 w-5" />,
    tables: ["invoices", "payments", "expenses"],
  },
  {
    key: "documents",
    label: "Documents",
    description: "All uploaded files and their metadata",
    icon: <FileText className="h-5 w-5" />,
    tables: ["documents"],
  },
  {
    key: "staff",
    label: "Staff accounts",
    description:
      "All staff profiles except your own account (so you stay logged in)",
    icon: <UserCog className="h-5 w-5" />,
    tables: ["profiles"],
  },
  {
    key: "tax",
    label: "Tax data",
    description: "Tax parameters and computed yearly filings",
    icon: <Calculator className="h-5 w-5" />,
    tables: ["tax_parameters", "tax_filings"],
  },
  {
    key: "audit_logs",
    label: "Audit logs",
    description: "System activity history",
    icon: <ScrollText className="h-5 w-5" />,
    tables: ["audit_logs"],
  },
];

/* ------------------------------------------------------------------ */
/*  DATA MANAGEMENT TAB                                                */
/* ------------------------------------------------------------------ */

function DataWipeTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Fetch row counts for every category
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["data-wipe-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const supabase = createClient();
      const result: Record<string, number> = {};

      const tablesToCount = [
        "tenants",
        "units",
        "leases",
        "invoices",
        "payments",
        "expenses",
        "documents",
        "profiles",
        "tax_parameters",
        "tax_filings",
        "audit_logs",
      ];

      await Promise.all(
        tablesToCount.map(async (table) => {
          const { count } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });
          result[table] = count ?? 0;
        })
      );

      return result;
    },
  });

  const wipeMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const res = await fetch("/api/admin/data-wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Wipe failed");
      return data;
    },
    onSuccess: (data) => {
      const totalDeleted = Object.values(
        data.deleted as Record<string, number>
      ).reduce((a: number, b: number) => a + b, 0);
      toast.success(
        `Wipe complete — ${totalDeleted.toLocaleString()} record${totalDeleted !== 1 ? "s" : ""} deleted.`
      );
      setSelected(new Set());
      setConfirmOpen(false);
      setConfirmText("");
      // Refresh everything
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCategory = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === WIPE_CATEGORIES.length) return new Set();
      return new Set(WIPE_CATEGORIES.map((c) => c.key));
    });
  }, []);

  const allSelected = selected.size === WIPE_CATEGORIES.length;

  const getCategoryCount = (cat: WipeCategory): number => {
    if (!counts) return 0;
    return cat.tables.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
  };

  const totalSelected = WIPE_CATEGORIES.filter((c) =>
    selected.has(c.key)
  ).reduce((sum, c) => sum + getCategoryCount(c), 0);

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="text-[15px] font-semibold text-red-800">
            Danger zone — permanent data deletion
          </p>
          <p className="mt-1 text-sm text-red-700">
            Deleting data here is <strong>irreversible</strong>. This is not the
            same as archiving — rows are permanently removed from the database.
            Only use this to start fresh or clean up test data.
          </p>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {WIPE_CATEGORIES.map((cat) => {
          const checked = selected.has(cat.key);
          const count = getCategoryCount(cat);
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => toggleCategory(cat.key)}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-all ${
                checked
                  ? "border-red-300 bg-red-50/80 ring-2 ring-red-200"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  checked
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-muted-foreground/40"
                }`}
              >
                {checked && (
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>

              {/* Icon + text */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={checked ? "text-red-700" : "text-muted-foreground"}
                  >
                    {cat.icon}
                  </span>
                  <span className="text-[15px] font-medium">{cat.label}</span>
                  {countsLoading ? (
                    <Skeleton className="h-5 w-10 rounded-full" />
                  ) : (
                    <Badge
                      variant="secondary"
                      className="rounded-full tabular-nums"
                    >
                      {count.toLocaleString()} row{count !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {cat.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Select all + Delete button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-muted-foreground/30 p-4">
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <div
            className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
              allSelected
                ? "border-red-600 bg-red-600 text-white"
                : "border-muted-foreground/40"
            }`}
          >
            {allSelected && (
              <svg
                className="h-3 w-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </div>
          {allSelected ? "Deselect all" : "Wipe everything"}
        </button>

        <Dialog
          open={confirmOpen}
          onOpenChange={(v) => {
            setConfirmOpen(v);
            if (!v) setConfirmText("");
          }}
        >
          <DialogTrigger
            render={
              <Button
                className="h-11 gap-2 bg-red-600 text-white hover:bg-red-700"
                disabled={selected.size === 0}
              />
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete selected data
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-red-700">
                <TriangleAlert className="h-5 w-5" />
                Confirm permanent deletion
              </DialogTitle>
              <DialogDescription className="text-base">
                You are about to <strong>permanently delete</strong> data from
                the following categories. This cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Selected categories summary */}
              <div className="rounded-md border bg-muted/50 p-3">
                <ul className="space-y-1">
                  {WIPE_CATEGORIES.filter((c) => selected.has(c.key)).map(
                    (cat) => (
                      <li
                        key={cat.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="text-red-600">{cat.icon}</span>
                        <span className="font-medium">{cat.label}</span>
                        <span className="text-muted-foreground">
                          — {getCategoryCount(cat).toLocaleString()} row
                          {getCategoryCount(cat) !== 1 ? "s" : ""}
                        </span>
                      </li>
                    )
                  )}
                </ul>
                <div className="mt-2 border-t pt-2 text-sm font-semibold">
                  Total: {totalSelected.toLocaleString()} record
                  {totalSelected !== 1 ? "s" : ""} will be deleted
                </div>
              </div>

              {/* Type DELETE to confirm */}
              <div className="space-y-2">
                <Label className="text-base">
                  Type{" "}
                  <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-sm font-bold text-red-700">
                    DELETE
                  </span>{" "}
                  to confirm
                </Label>
                <Input
                  className="h-11 font-mono"
                  placeholder="Type DELETE here…"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
                disabled={wipeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="h-11 bg-red-600 text-white hover:bg-red-700"
                disabled={
                  confirmText !== "DELETE" || wipeMutation.isPending
                }
                onClick={() => {
                  const cats = allSelected
                    ? ["all"]
                    : Array.from(selected);
                  wipeMutation.mutate(cats);
                }}
              >
                {wipeMutation.isPending
                  ? "Deleting…"
                  : "Permanently delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export function AdminClient() {
  const queryClient = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async (): Promise<AuditLog[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (patch: {
      id: string;
      role?: UserRole;
      is_active?: boolean;
    }) => {
      const supabase = createClient();
      const { id, ...rest } = patch;
      const { error } = await supabase
        .from("profiles")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Account updated.");
    },
    onError: () => toast.error("Could not update the account."),
  });

  return (
    <div>
      <PageHeader
        title="Administration"
        description="Manage staff accounts and review everything that has happened in the system."
      />

      <Tabs defaultValue="users">
        <TabsList className="mb-4 h-11">
          <TabsTrigger value="users" className="h-9 px-4 text-[15px]">
            Staff accounts
          </TabsTrigger>
          <TabsTrigger value="logs" className="h-9 px-4 text-[15px]">
            System activity log
          </TabsTrigger>
          <TabsTrigger value="data" className="h-9 gap-1.5 px-4 text-[15px]">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Data management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="mb-4 flex justify-end">
            <NewUserDialog />
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Person</TableHead>
                      <TableHead className="text-base">Role</TableHead>
                      <TableHead className="text-base">Status</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(profiles ?? []).map((p) => (
                      <TableRow
                        key={p.id}
                        className={!p.is_active ? "opacity-50" : undefined}
                      >
                        <TableCell>
                          <p className="text-[15px] font-medium">
                            {p.full_name || "(no name)"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {p.email}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Select
                            items={ROLE_LABELS}
                            value={p.role}
                            onValueChange={(v) =>
                              updateProfile.mutate({
                                id: p.id,
                                role: v as UserRole,
                              })
                            }
                          >
                            <SelectTrigger className="h-10 w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                Object.entries(ROLE_LABELS) as [
                                  UserRole,
                                  string,
                                ][]
                              ).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              p.is_active
                                ? "rounded-full bg-green-50 text-green-700"
                                : "rounded-full bg-muted text-muted-foreground"
                            }
                          >
                            {p.is_active ? "Active" : "Deactivated"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ConfirmDialog
                            title={
                              p.is_active
                                ? `Deactivate ${p.full_name || p.email}?`
                                : `Reactivate ${p.full_name || p.email}?`
                            }
                            description={
                              p.is_active
                                ? "They will be signed out and unable to log in until reactivated. No data is lost."
                                : "They will be able to sign in again."
                            }
                            confirmLabel={
                              p.is_active ? "Yes, deactivate" : "Yes, reactivate"
                            }
                            onConfirm={() =>
                              updateProfile.mutateAsync({
                                id: p.id,
                                is_active: !p.is_active,
                              })
                            }
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-red-600 hover:text-red-700"
                                aria-label={
                                  p.is_active
                                    ? "Deactivate account"
                                    : "Reactivate account"
                                }
                              >
                                <UserX className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="space-y-3 p-6">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">When</TableHead>
                      <TableHead className="text-base">Action</TableHead>
                      <TableHead className="text-base">Table</TableHead>
                      <TableHead className="text-base">Record</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logs ?? []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-[15px]">
                          {formatDateTime(l.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              l.action === "DELETE"
                                ? "rounded-full bg-red-50 text-red-700"
                                : l.action === "INSERT"
                                  ? "rounded-full bg-green-50 text-green-700"
                                  : "rounded-full bg-blue-50 text-blue-700"
                            }
                          >
                            {l.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[15px]">
                          {l.table_name}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {l.record_id?.slice(0, 8) ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <DataWipeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
