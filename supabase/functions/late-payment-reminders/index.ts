// Supabase Edge Function: late-payment-reminders
//
// Run daily (Dashboard → Edge Functions → Schedules, e.g. cron "0 8 * * *"):
//   1. Marks unpaid invoices past their due date as overdue.
//   2. Queues + sends a friendly email reminder per overdue invoice
//      (skips tenants already reminded in the last 3 days).
//
// Secrets required:  supabase secrets set RESEND_API_KEY=...
// Uses the service-role key (available to Edge Functions automatically),
// so it bypasses RLS by design.

import { createClient } from "jsr:@supabase/supabase-js@2";

const REMINDER_COOLDOWN_DAYS = 3;

Deno.serve(async (req) => {
  // Only allow scheduled/authorized calls.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "∅")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Flag overdue invoices.
  const { data: flagged, error: flagError } = await supabase.rpc(
    "mark_overdue_invoices"
  );
  if (flagError) {
    return new Response(JSON.stringify({ error: flagError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Fetch overdue invoices with tenant contact info.
  const { data: overdue, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, due_date, amount, amount_paid, tenant_id, tenants:tenant_id(full_name, email)"
    )
    .eq("status", "overdue");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cooldown = new Date();
  cooldown.setDate(cooldown.getDate() - REMINDER_COOLDOWN_DAYS);

  let sent = 0;
  let skipped = 0;

  for (const inv of overdue ?? []) {
    const tenant = inv.tenants as unknown as {
      full_name: string;
      email: string | null;
    } | null;

    if (!tenant?.email) {
      skipped++;
      continue;
    }

    // Skip if we reminded them recently.
    const { data: recent } = await supabase
      .from("payment_reminders")
      .select("id")
      .eq("invoice_id", inv.id)
      .eq("status", "sent")
      .gte("sent_at", cooldown.toISOString())
      .limit(1);
    if (recent && recent.length > 0) {
      skipped++;
      continue;
    }

    const owed = Number(inv.amount) - Number(inv.amount_paid);
    const message =
      `Dear ${tenant.full_name},\n\n` +
      `This is a friendly reminder that invoice ${inv.invoice_number} ` +
      `for ${owed.toFixed(2)} was due on ${inv.due_date} and is still unpaid.\n\n` +
      `If you have already paid, please disregard this message.\n\n` +
      `Thank you,\nProperty Management`;

    // Queue the reminder record first for auditability.
    const { data: reminder } = await supabase
      .from("payment_reminders")
      .insert({
        invoice_id: inv.id,
        tenant_id: inv.tenant_id,
        channel: "email",
        status: "queued",
        message,
      })
      .select("id")
      .single();

    // Send via Resend (swap for any provider).
    let ok = false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("REMINDER_FROM_EMAIL") ?? "reminders@example.com",
          to: tenant.email,
          subject: `Rent reminder — invoice ${inv.invoice_number}`,
          text: message,
        }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }

    if (reminder) {
      await supabase
        .from("payment_reminders")
        .update({
          status: ok ? "sent" : "failed",
          sent_at: ok ? new Date().toISOString() : null,
        })
        .eq("id", reminder.id);
    }

    if (ok) sent++;
    else skipped++;
  }

  return new Response(
    JSON.stringify({ newly_overdue: flagged, reminders_sent: sent, skipped }),
    { headers: { "Content-Type": "application/json" } }
  );
});
