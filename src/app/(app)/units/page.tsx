import type { Metadata } from "next";
import { UnitsClient } from "@/components/units/units-client";

export const metadata: Metadata = { title: "Units" };

export default function UnitsPage() {
  return <UnitsClient />;
}
