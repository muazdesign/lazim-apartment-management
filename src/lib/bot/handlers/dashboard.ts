import { Bot, InlineKeyboard } from "grammy";
import type { BotContext } from "../index";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";

export function setupDashboardHandler(bot: Bot<BotContext>) {
  const showDashboard = async (ctx: BotContext) => {
    if (!ctx.session.tenantId) {
      return ctx.reply("You are not registered in this property. Please contact management.");
    }

    // Reset state whenever they visit home
    ctx.session.state = null;
    ctx.session.data = {};

    // Fetch tenant, active lease, and invoices
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select(`
        full_name,
        leases (
          id,
          monthly_rent,
          end_date,
          payment_due_day,
          units ( unit_number )
        ),
        invoices (
          amount,
          amount_paid,
          status,
          due_date
        )
      `)
      .eq("id", ctx.session.tenantId)
      .eq("leases.status", "active")
      .single();

    if (!tenant) {
      return ctx.reply("Error fetching your information. Please contact support.");
    }

    const lease = tenant.leases?.[0] as any;
    let apartment = "N/A";
    let rent = 0;
    let leaseExpires = "N/A";
    
    if (lease) {
      apartment = lease.units?.unit_number || "N/A";
      rent = lease.monthly_rent || 0;
      leaseExpires = lease.end_date ? format(new Date(lease.end_date), "MMMM d, yyyy") : "N/A";
    }

    // Calculate Current Balance from outstanding invoices
    let currentBalance = 0;
    let nextDueDate = "N/A";

    if (tenant.invoices && tenant.invoices.length > 0) {
      const outstanding = tenant.invoices.filter((inv: any) => 
        ["sent", "partially_paid", "overdue"].includes(inv.status)
      );
      
      currentBalance = outstanding.reduce((sum: number, inv: any) => sum + (inv.amount - inv.amount_paid), 0);
      
      if (outstanding.length > 0) {
        // Sort to find nearest due date
        outstanding.sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        nextDueDate = format(new Date(outstanding[0].due_date), "MMMM d");
      }
    }

    const balanceText = currentBalance > 0 
      ? `${currentBalance.toLocaleString()} ETB ⚠️` 
      : `0 ETB ✅`;

    const text = 
      `Welcome, ${tenant.full_name.split(" ")[0]}\n\n` +
      `Apartment:\n${apartment}\n\n` +
      `Rent:\n${rent.toLocaleString()} ETB/month\n\n` +
      `Current Balance:\n${balanceText}\n\n` +
      `Next Due Date:\n${nextDueDate}\n\n` +
      `Lease Expires:\n${leaseExpires}`;

    const keyboard = new InlineKeyboard()
      .text("🏠 My Account", "account").text("💳 Payments", "payments").row()
      .text("📤 Upload Receipt", "upload_receipt").text("🔧 Maintenance", "maintenance").row()
      .text("📢 Announcements", "announcements").text("📄 Documents", "documents").row()
      .text("☎ Contact Management", "contact");

    // If it's a callback query, we can edit the message, else reply
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(text, { reply_markup: keyboard });
    }
  };

  bot.command("dashboard", showDashboard);
  bot.callbackQuery("home", showDashboard);

  // My Account handler
  bot.callbackQuery("account", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select(`
        full_name,
        phone,
        is_active,
        leases (
          monthly_rent,
          security_deposit,
          start_date,
          end_date,
          status,
          units ( unit_number )
        )
      `)
      .eq("id", ctx.session.tenantId)
      .eq("leases.status", "active")
      .single();

    if (!tenant) return ctx.answerCallbackQuery("Error fetching account.");

    const lease = tenant.leases?.[0] as any;
    
    const text = 
      `👤 **My Account**\n\n` +
      `Tenant Name: ${tenant.full_name}\n` +
      `Phone Number: ${tenant.phone || "N/A"}\n` +
      `Status: ${tenant.is_active ? "Active ✅" : "Inactive ❌"}\n\n` +
      `Apartment Number: ${lease?.units?.unit_number || "N/A"}\n` +
      `Monthly Rent: ${lease?.monthly_rent?.toLocaleString() || 0} ETB\n` +
      `Security Deposit: ${lease?.security_deposit?.toLocaleString() || 0} ETB\n` +
      `Lease Start Date: ${lease?.start_date ? format(new Date(lease.start_date), "MMM d, yyyy") : "N/A"}\n` +
      `Lease End Date: ${lease?.end_date ? format(new Date(lease.end_date), "MMM d, yyyy") : "N/A"}\n`;

    const keyboard = new InlineKeyboard().text("⬅ Back", "home").text("🏠 Home", "home");
    
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });
}
