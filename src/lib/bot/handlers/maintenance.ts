import { Bot, InlineKeyboard } from "grammy";
import type { BotContext } from "../index";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";

export function setupMaintenanceHandler(bot: Bot<BotContext>) {
  // --- MAINTENANCE DASHBOARD ---
  bot.callbackQuery("maintenance", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    const text = "🔧 **Maintenance**\n\nPlease select the category of your issue:";
    
    const keyboard = new InlineKeyboard()
      .text("🚿 Plumbing", "maint_plumbing").text("💡 Electrical", "maint_electrical").row()
      .text("🚪 Doors & Locks", "maint_doors_locks").text("🚰 Water", "maint_water").row()
      .text("🌐 Internet", "maint_internet").text("🧹 Cleaning", "maint_cleaning").row()
      .text("❓ Other", "maint_other").row()
      .text("📋 View My Tickets", "maint_list").row()
      .text("⬅ Back", "home").text("🏠 Home", "home");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // --- MY TICKETS ---
  bot.callbackQuery("maint_list", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    const { data: tickets } = await supabaseAdmin
      .from("maintenance_tickets")
      .select("id, category, status, created_at")
      .eq("tenant_id", ctx.session.tenantId)
      .order("created_at", { ascending: false })
      .limit(5);

    let text = "📋 **My Recent Tickets**\n\n";

    if (tickets && tickets.length > 0) {
      tickets.forEach((ticket) => {
        const date = format(new Date(ticket.created_at), "MMM d");
        // Emojis for status
        let statusEmoji = "⏳";
        if (ticket.status === "assigned") statusEmoji = "👷";
        if (ticket.status === "in_progress") statusEmoji = "🔧";
        if (ticket.status === "completed") statusEmoji = "✅";
        
        text += `${statusEmoji} **${ticket.category.toUpperCase()}** (${date})\nStatus: ${ticket.status.replace("_", " ")}\n\n`;
      });
    } else {
      text += "You have no maintenance tickets.";
    }

    const keyboard = new InlineKeyboard().text("⬅ Back", "maintenance").text("🏠 Home", "home");
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // --- NEW TICKET CATEGORY SELECT ---
  bot.callbackQuery(/^maint_(plumbing|electrical|doors_locks|water|internet|cleaning|other)$/, async (ctx) => {
    const category = ctx.match[1];
    ctx.session.state = "maint_desc";
    ctx.session.data = { category };

    const text = `You selected **${category.replace("_", " & ")}**.\n\nPlease briefly describe the issue:`;
    const keyboard = new InlineKeyboard().text("❌ Cancel", "maintenance");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Handle Description Text
  bot.on("message:text", async (ctx, next) => {
    if (ctx.session.state === "maint_desc") {
      ctx.session.data.description = ctx.message.text;
      ctx.session.state = "maint_photo";

      const text = "Description saved. 📝\n\nPlease upload a photo of the issue, or tap Skip.";
      const keyboard = new InlineKeyboard()
        .text("⏭ Skip Photo", "maint_submit")
        .row()
        .text("❌ Cancel", "maintenance");

      return ctx.reply(text, { reply_markup: keyboard });
    }
    await next();
  });

  // Handle Photo or Submit
  const submitTicket = async (ctx: BotContext, fileId?: string) => {
    try {
      const { category, description } = ctx.session.data;
      let photoUrl = null;

      // Upload photo to Supabase if provided
      if (fileId) {
        const file = await ctx.api.getFile(fileId);
        const filePath = file.file_path;
        if (filePath) {
          const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
          const response = await fetch(url);
          const blob = await response.blob();
          
          const fileName = `${ctx.session.tenantId}-maint-${Date.now()}.jpg`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from("receipts") // Using same bucket for now, or could create 'maintenance'
            .upload(fileName, blob, { contentType: "image/jpeg" });
          
          if (!uploadError) {
            const { data } = supabaseAdmin.storage.from("receipts").getPublicUrl(fileName);
            photoUrl = data.publicUrl;
          }
        }
      }

      // Fetch unit_id from active lease
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select(`leases ( unit_id )`)
        .eq("id", ctx.session.tenantId)
        .eq("leases.status", "active")
        .single();
      
      const unitId = tenant?.leases?.[0]?.unit_id || null;

      // Insert Ticket
      const { data: inserted, error } = await supabaseAdmin.from("maintenance_tickets").insert({
        tenant_id: ctx.session.tenantId,
        unit_id: unitId,
        category,
        description,
        photo_url: photoUrl,
        status: "pending"
      }).select("id").single();

      if (error) throw error;

      ctx.session.state = null;
      ctx.session.data = {};

      const text = `Ticket submitted successfully. ✅\n\nManagement has been notified. You can track its status in the Maintenance menu.`;
      const keyboard = new InlineKeyboard().text("📋 View My Tickets", "maint_list").text("🏠 Home", "home");

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { reply_markup: keyboard });
      } else {
        await ctx.reply(text, { reply_markup: keyboard });
      }
    } catch (error) {
      console.error("Maintenance submit error:", error);
      const text = "Sorry, an error occurred while submitting your ticket. Please try again.";
      const keyboard = new InlineKeyboard().text("🏠 Home", "home");
      if (ctx.callbackQuery) {
         await ctx.editMessageText(text, { reply_markup: keyboard });
      } else {
         await ctx.reply(text, { reply_markup: keyboard });
      }
    }
  };

  // Skip photo callback
  bot.callbackQuery("maint_submit", async (ctx) => {
    if (ctx.session.state !== "maint_photo") return ctx.answerCallbackQuery("Invalid state.");
    await submitTicket(ctx);
    await ctx.answerCallbackQuery();
  });

  // Handle Photo Upload
  bot.on("message:photo", async (ctx, next) => {
    if (ctx.session.state === "maint_photo") {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      await submitTicket(ctx, photo.file_id);
    } else {
      await next();
    }
  });
}
