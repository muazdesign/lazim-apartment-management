import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { AdminClient } from "@/components/admin/admin-client";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminPage() {
  const profile = await getProfile();
  if (profile?.role !== "tech_admin") redirect("/");
  return <AdminClient />;
}
