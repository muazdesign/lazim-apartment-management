import type { Metadata } from "next";
import { InvoicesClient } from "@/components/invoices/invoices-client";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return <InvoicesClient />;
}
