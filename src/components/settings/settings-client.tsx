"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-context";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/permissions";

export function SettingsClient() {
  const profile = useProfile();
  const queryClient = useQueryClient();
  
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone || "");
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfile = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone || null })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated successfully.");
      // Hard reload to reflect changes in the server-rendered profile context (sidebar, etc.)
      window.location.reload();
    },
    onError: () => toast.error("Could not update profile. Please try again."),
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (signInError) throw new Error("Incorrect current password.");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message || "Could not update password. Please try again."),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <PageHeader
        title="Settings"
        description="Manage your account profile and security."
      />

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription className="text-base">
            Update your name and contact details. Your email and role are managed by the administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!fullName.trim()) return toast.error("Name cannot be empty.");
              updateProfile.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-base">Full name</Label>
                <Input
                  className="h-11"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Phone number</Label>
                <Input
                  className="h-11"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-base text-muted-foreground">Email address</Label>
                <Input className="h-11" value={profile.email} disabled />
              </div>
              <div className="space-y-2">
                <Label className="text-base text-muted-foreground">Role</Label>
                <Input className="h-11" value={ROLE_LABELS[profile.role]} disabled />
              </div>
            </div>

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription className="text-base">
            Choose a strong password with at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              if (!currentPassword) return toast.error("Please enter your current password.");
              if (newPassword.length < 8) return toast.error("New password must be at least 8 characters.");
              if (newPassword !== confirmPassword) return toast.error("New passwords do not match.");
              updatePassword.mutate();
            }}
          >
            <div className="space-y-2">
              <Label className="text-base">Current password</Label>
              <Input
                type="password"
                className="h-11"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">New password</Label>
              <Input
                type="password"
                className="h-11"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Confirm new password</Label>
              <Input
                type="password"
                className="h-11"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={updatePassword.isPending}>
              {updatePassword.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
