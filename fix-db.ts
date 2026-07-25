import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { toEth, toGregISO, ethMonthDays } from "./src/lib/ethiopian-calendar";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // use service role for full access

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting DB migration to 3-month cycles...");
  
  // 1. Fetch all leases to get monthly rent and payment_due_day
  const { data: leases, error: leasesErr } = await supabase.from("leases").select("*");
  if (leasesErr) throw leasesErr;

  // 2. Fetch all invoices
  const { data: invoices, error: invErr } = await supabase.from("invoices").select("*");
  if (invErr) throw invErr;

  console.log(`Found ${invoices.length} invoices to process.`);

  for (const inv of invoices) {
    const lease = leases.find((l) => l.id === inv.lease_id);
    if (!lease) {
      console.warn(`Lease not found for invoice ${inv.id}, skipping.`);
      continue;
    }

    // Recalculate end date
    const startEth = toEth(inv.period_start);
    let endM = startEth.month + 3;
    let endY = startEth.year;
    if (endM > 12) {
      endM -= 12;
      endY += 1;
    }
    
    const maxDaysEnd = ethMonthDays(endM, endY);
    const safeEndDay = Math.min(lease.payment_due_day, maxDaysEnd);
    const periodEndGreg = toGregISO(endY, endM, safeEndDay);
    
    const periodEndObj = new Date(periodEndGreg);
    periodEndObj.setDate(periodEndObj.getDate() - 1);
    const newPeriodEnd = periodEndObj.toISOString().split("T")[0];

    const newAmount = lease.monthly_rent * 3;
    const newStatus = inv.amount_paid >= newAmount ? "paid" : (inv.status === "void" ? "void" : "sent");

    const { error: updateErr } = await supabase
      .from("invoices")
      .update({
        amount: newAmount,
        period_end: newPeriodEnd,
        status: newStatus,
      })
      .eq("id", inv.id);

    if (updateErr) {
      console.error(`Failed to update invoice ${inv.id}:`, updateErr);
    } else {
      console.log(`Updated invoice ${inv.id}: ${newPeriodEnd}, Br ${newAmount}, Status: ${newStatus}`);
    }
  }

  console.log("Migration complete!");
}

run().catch(console.error);
