import type { Metadata } from "next";
import { PaymentsClient } from "@/components/payments/payments-client";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return <PaymentsClient />;
}
