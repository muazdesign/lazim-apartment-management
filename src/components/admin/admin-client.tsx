"use client";

import { useState } from "react";
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
import { UserPlus, UserX } from "lucide-react";

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
      </Tabs>
    </div>
  );
}
