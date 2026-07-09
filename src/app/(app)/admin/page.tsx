import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { AdminClient } from "@/components/admin/admin-client";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile || !can(profile.role, "manageUsers")) redirect("/");
  return <AdminClient currentRole={profile.role} currentUserId={profile.id} />;
}
