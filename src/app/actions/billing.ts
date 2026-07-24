"use server";

import { createClient } from "@/lib/supabase/server";
import { currentEthDate, toGregISO, ethMonthDays, toEth } from "@/lib/ethiopian-calendar";

export async function generateInvoicesAction() {
  const supabase = createClient();

  // 1. Fetch all active leases
  const { data: leases, error: leasesError } = await (await supabase)
    .from("leases")
    .select("id, tenant_id, monthly_rent, payment_due_day, start_date, end_date")
    .eq("status", "active");

  if (leasesError || !leases) {
    console.error("Failed to fetch leases:", leasesError);
    return { success: false, count: 0 };
  }

  let createdCount = 0;
  const currentDate = new Date().toISOString().split("T")[0];

  for (const lease of leases) {
    if (lease.start_date > currentDate || lease.end_date < currentDate) {
      continue;
    }

    // Find the most recent invoice for this lease to continue the cycle
    const { data: latestInvoice } = await (await supabase)
      .from("invoices")
      .select("period_start")
      .eq("lease_id", lease.id)
      .order("period_start", { ascending: false })
      .limit(1)
      .single();

    // If no invoice exists, the first cycle starts on the lease start_date.
    // Otherwise, it starts exactly 3 Ethiopian months after the latest invoice's period_start.
    
    let nextCycleGregorianStart = lease.start_date;
    
    if (latestInvoice) {
      const latestEth = toEth(latestInvoice.period_start);
      const nextCycle = addRentMonths(latestEth.month, latestEth.year, 3);
      let nextMonth = nextCycle.month;
      let nextYear = nextCycle.year;
      
      const daysInNextMonth = ethMonthDays(nextMonth, nextYear);
      // Keep the same day of the month, bounded by the month's length
      const actualStartDay = Math.min(latestEth.day, daysInNextMonth);
      nextCycleGregorianStart = toGregISO(nextYear, nextMonth, actualStartDay);
    }

    // Generate invoices up to the current date (to catch up on any missed cycles)
    while (nextCycleGregorianStart <= currentDate) {
      const cycleStartEth = toEth(nextCycleGregorianStart);
      
      // Calculate period end (3 months after cycle start, minus 1 day)
      const endCycle = addRentMonths(cycleStartEth.month, cycleStartEth.year, 3);
      let endMonth = endCycle.month;
      let endYear = endCycle.year;
      
      const daysInEndMonth = ethMonthDays(endMonth, endYear);
      const endDay = Math.min(cycleStartEth.day, daysInEndMonth);
      const nextCycleStartGregorian = toGregISO(endYear, endMonth, endDay);
      
      // Subtract 1 day for period end
      const periodEndObj = new Date(nextCycleStartGregorian);
      periodEndObj.setDate(periodEndObj.getDate() - 1);
      const periodEnd = periodEndObj.toISOString().split("T")[0];

      // Insert the 3-month invoice
      const { error: insertError } = await (await supabase)
        .from("invoices")
        .insert({
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          period_start: nextCycleGregorianStart,
          period_end: periodEnd,
          due_date: nextCycleGregorianStart, // Due at the start of the 3-month cycle
          amount: lease.monthly_rent * 3, // 3 months rent!
          status: "sent"
        });

      if (!insertError) {
        createdCount++;
      } else {
        console.error("Failed to insert invoice:", insertError);
        break; // Stop generating for this lease on error
      }

      // Advance to next cycle for the while loop
      nextCycleGregorianStart = nextCycleStartGregorian;
    }
  }

  return { success: true, count: createdCount };
}
