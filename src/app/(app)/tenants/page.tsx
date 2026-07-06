import type { Metadata } from "next";
import { TenantsClient } from "@/components/tenants/tenants-client";

export const metadata: Metadata = { title: "Tenants" };

export default function TenantsPage() {
  return <TenantsClient />;
}
