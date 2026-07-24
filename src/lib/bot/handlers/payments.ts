import { Bot, InlineKeyboard } from "grammy";
import type { BotContext } from "../index";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";
import { t } from "../i18n";

export function setupPaymentsHandler(bot: Bot<BotContext>) {
  // --- PAYMENTS DASHBOARD ---
  bot.callbackQuery("payments", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery(t(ctx.session.lang, "not_registered"));

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("invoice_number, amount, amount_paid, due_date, status")
      .eq("tenant_id", ctx.session.tenantId)
      .in("status", ["sent", "partially_paid", "overdue"])
      .order("due_date", { ascending: true })
      .limit(5);

    let currentBalance = 0;
    let text = `💳 **${t(ctx.session.lang, "payments").replace("💳 ", "")}**\n\n`;

    if (invoices && invoices.length > 0) {
      currentBalance = invoices.reduce((sum, inv) => sum + (inv.amount - inv.amount_paid), 0);
      text += `${t(ctx.session.lang, "current_balance")}: **${currentBalance.toLocaleString()} ETB** ⚠️\n\n`;
      text += `**${t(ctx.session.lang, "outstanding_invoices")}:**\n`;
      invoices.forEach((inv) => {
        text += `• ${inv.invoice_number}: ${(inv.amount - inv.amount_paid).toLocaleString()} ETB (Due: ${format(new Date(inv.due_date), "MMM d, yyyy")})\n`;
      });
    } else {
      text += `${t(ctx.session.lang, "current_balance")}: **0 ETB** ✅\n\n${t(ctx.session.lang, "no_invoices")}`;
    }

    const keyboard = new InlineKeyboard()
      .text(t(ctx.session.lang, "upload_receipt"), "upload_receipt").row()
      .text(t(ctx.session.lang, "back"), "home").text(t(ctx.session.lang, "home"), "home");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // --- UPLOAD RECEIPT PROMPT ---
  bot.callbackQuery("upload_receipt", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery(t(ctx.session.lang, "not_registered"));

    ctx.session.state = "upload_receipt_photo";
    ctx.session.data = {}; 

    const text = t(ctx.session.lang, "upload_photo_prompt");
    const keyboard = new InlineKeyboard().text(t(ctx.session.lang, "cancel"), "home");

    await ctx.editMessageText(text, { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Handle Photo Upload Directly
  bot.on("message:photo", async (ctx, next) => {
    // If they are explicitly in a different state (like maintenance), pass it on
    if (ctx.session.state && ctx.session.state.startsWith("maint_")) {
      return next();
    }
    
    // Process receipt upload immediately
    try {
      // Send a quick loading message to prevent Telegram timeout glitching
      const loadingMsg = await ctx.reply("⏳ እባክዎ ይጠብቁ... Processing...");

      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      
      const file = await ctx.api.getFile(fileId);
      const filePath = file.file_path;
      if (!filePath) throw new Error("No file path returned");

      const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
      const response = await fetch(url);
      const blob = await response.blob();
      
      const fileName = `${ctx.session.tenantId}-receipt-${Date.now()}.jpg`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("receipts")
        .upload(fileName, blob, { contentType: "image/jpeg" });
      
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseAdmin.storage.from("receipts").getPublicUrl(fileName);
      const receiptUrl = publicUrlData.publicUrl;

      // Find the oldest unpaid invoice for this tenant
      const { data: oldestInvoice } = await supabaseAdmin
        .from("invoices")
        .select("id")
        .eq("tenant_id", ctx.session.tenantId)
        .in("status", ["sent", "partially_paid", "overdue"])
        .order("due_date", { ascending: true })
        .limit(1)
        .single();

      // Insert into payment_requests
      await supabaseAdmin.from("payment_requests").insert({
        tenant_id: ctx.session.tenantId,
        receipt_url: receiptUrl,
        status: "pending",
        invoice_id: oldestInvoice ? oldestInvoice.id : null,
      });

      // Clear state
      ctx.session.state = null;
      ctx.session.data = {};

      const text = t(ctx.session.lang, "payment_submitted");
      const keyboard = new InlineKeyboard().text(t(ctx.session.lang, "home"), "home");

      // Delete loading message and send success
      await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      await ctx.reply(text, { reply_markup: keyboard });

    } catch (error) {
      console.error("Error processing receipt:", error);
      await ctx.reply(t(ctx.session.lang, "payment_error"), {
        reply_markup: new InlineKeyboard().text(t(ctx.session.lang, "home"), "home")
      });
    }
  });
}
