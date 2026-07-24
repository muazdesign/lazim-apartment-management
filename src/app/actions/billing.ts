"use server";

import { createClient } from "@/lib/supabase/server";
import { currentEthDate, toGregISO, ethMonthDays } from "@/lib/ethiopian-calendar";

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
  const currentEth = currentEthDate();
  const currentDate = new Date().toISOString().split("T")[0];

  for (const lease of leases) {
    // If the lease hasn't started yet or has already ended, skip
    if (lease.start_date > currentDate || lease.end_date < currentDate) {
      continue;
    }

    // Determine the billing period based on the Ethiopian calendar
    // The period starts on `payment_due_day` of the current Ethiopian month.
    // If today is before the payment_due_day, maybe the current cycle started last month.
    // To keep it simple and match the old logic (which generated the *current* month's invoice):
    
    let cycleMonth = currentEth.month;
    let cycleYear = currentEth.year;

    // If we are currently before the due day, the active cycle actually started last month
    if (currentEth.day < lease.payment_due_day) {
      cycleMonth -= 1;
      if (cycleMonth < 1) {
        cycleMonth = 13;
        cycleYear -= 1;
      }
    }

    // Period Start: Gregorian date of (cycleYear, cycleMonth, payment_due_day)
    // Handle edge cases if payment_due_day > days in the cycle month (e.g., Pagume has 5/6 days)
    const daysInMonth = ethMonthDays(cycleMonth, cycleYear);
    const actualStartDay = Math.min(lease.payment_due_day, daysInMonth);
    const periodStart = toGregISO(cycleYear, cycleMonth, actualStartDay);

    // Period End: Next month's due day minus 1 day
    let nextMonth = cycleMonth + 1;
    let nextYear = cycleYear;
    if (nextMonth > 13) {
      nextMonth = 1;
      nextYear += 1;
    }
    
    // To get the exact end day, we just subtract 1 day from the next cycle's start date
    // or calculate the number of days in the current cycle. For simplicity, we just use 30 days (or length of month)
    const daysInNextMonth = ethMonthDays(nextMonth, nextYear);
    const nextStartDay = Math.min(lease.payment_due_day, daysInNextMonth);
    const nextCycleStart = toGregISO(nextYear, nextMonth, nextStartDay);
    
    // Subtract 1 day from nextCycleStart
    const periodEndObj = new Date(nextCycleStart);
    periodEndObj.setDate(periodEndObj.getDate() - 1);
    const periodEnd = periodEndObj.toISOString().split("T")[0];

    const dueDate = periodStart; // Due on the first day of the cycle

    // 2. Check if invoice already exists for this exact period start
    const { data: existing } = await (await supabase)
      .from("invoices")
      .select("id")
      .eq("lease_id", lease.id)
      .eq("period_start", periodStart)
      .single();

    if (!existing) {
      // 3. Create invoice
      const { error: insertError } = await (await supabase)
        .from("invoices")
        .insert({
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          period_start: periodStart,
          period_end: periodEnd,
          due_date: dueDate,
          amount: lease.monthly_rent,
          status: "sent"
        });
      
      if (!insertError) {
        createdCount++;
      }
    }
  }

  return { success: true, count: createdCount };
}
