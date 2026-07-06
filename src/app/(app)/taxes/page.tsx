import type { Metadata } from "next";
import { TaxesClient } from "@/components/taxes/taxes-client";

export const metadata: Metadata = { title: "Yearly Taxes" };

export default function TaxesPage() {
  return <TaxesClient />;
}
