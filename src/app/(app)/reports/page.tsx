import type { Metadata } from "next";
import { ReportsClient } from "@/components/reports/reports-client";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <ReportsClient />;
}
