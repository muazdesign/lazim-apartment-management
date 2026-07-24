import { Bot, InlineKeyboard } from "grammy";
import type { BotContext } from "../index";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";

export function setupPaymentsHandler(bot: Bot<BotContext>) {
  // --- PAYMENTS DASHBOARD ---
  bot.callbackQuery("payments", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("invoice_number, amount, amount_paid, due_date, status")
      .eq("tenant_id", ctx.session.tenantId)
      .in("status", ["sent", "partially_paid", "overdue"])
      .order("due_date", { ascending: true })
      .limit(5);

    let currentBalance = 0;
    let text = "💳 **Payments**\n\n";

    if (invoices && invoices.length > 0) {
      currentBalance = invoices.reduce((sum, inv) => sum + (inv.amount - inv.amount_paid), 0);
      text += `Current Balance: **${currentBalance.toLocaleString()} ETB** ⚠️\n\n`;
      text += `**Outstanding Invoices:**\n`;
      invoices.forEach((inv) => {
        text += `• ${inv.invoice_number}: ${(inv.amount - inv.amount_paid).toLocaleString()} ETB (Due: ${format(new Date(inv.due_date), "MMM d, yyyy")})\n`;
      });
    } else {
      text += `Current Balance: **0 ETB** ✅\n\nYou have no outstanding invoices.`;
    }

    const keyboard = new InlineKeyboard()
      .text("📤 Upload Receipt", "upload_receipt").row()
      .text("⬅ Back", "home").text("🏠 Home", "home");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // --- UPLOAD RECEIPT FLOW ---
  bot.callbackQuery("upload_receipt", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    ctx.session.state = "upload_receipt_photo";
    ctx.session.data = {}; // Reset data

    const text = "Please upload a clear photo of your bank receipt.";
    const keyboard = new InlineKeyboard().text("❌ Cancel", "home");

    await ctx.editMessageText(text, { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Handle Photo Upload
  bot.on("message:photo", async (ctx, next) => {
    if (ctx.session.state === "upload_receipt_photo") {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      
      // Save file_id to session
      ctx.session.data = { ...ctx.session.data, fileId };
      ctx.session.state = "upload_receipt_txn";

      const keyboard = new InlineKeyboard().text("❌ Cancel", "home");
      return ctx.reply("Photo received! 📸\n\nPlease enter the **Transaction Number** from the receipt:", {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
    await next();
  });

  // Handle Transaction Number Text
  bot.on("message:text", async (ctx, next) => {
    if (ctx.session.state === "upload_receipt_txn") {
      ctx.session.data = { ...ctx.session.data, txnNumber: ctx.message.text };
      ctx.session.state = "upload_receipt_bank";

      const text = "Great. Please choose the Bank you transferred to:";
      const keyboard = new InlineKeyboard()
        .text("CBE", "bank_cbe").text("Dashen", "bank_dashen").row()
        .text("Awash", "bank_awash").text("Abyssinia", "bank_abyssinia").row()
        .text("Telebirr", "bank_telebirr").text("Other", "bank_other").row()
        .text("❌ Cancel", "home");

      return ctx.reply(text, { reply_markup: keyboard });
    }
    await next();
  });

  // Handle Bank Selection
  bot.callbackQuery(/^bank_(.+)$/, async (ctx) => {
    if (ctx.session.state !== "upload_receipt_bank") {
      return ctx.answerCallbackQuery("Invalid state. Please start over.");
    }

    const bank = ctx.match[1].toUpperCase();
    const { fileId, txnNumber } = ctx.session.data;
    
    // Process saving the receipt here.
    // To download the file from Telegram, we need to call getFile.
    try {
      const file = await ctx.api.getFile(fileId);
      const filePath = file.file_path;
      if (!filePath) throw new Error("No file path returned");

      const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
      const response = await fetch(url);
      const blob = await response.blob();
      
      const fileName = `${ctx.session.tenantId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("receipts")
        .upload(fileName, blob, { contentType: "image/jpeg" });
      
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseAdmin.storage.from("receipts").getPublicUrl(fileName);
      const receiptUrl = publicUrlData.publicUrl;

      // Insert into payment_requests
      const notes = `Bank: ${bank}\nTxn: ${txnNumber}`;
      await supabaseAdmin.from("payment_requests").insert({
        tenant_id: ctx.session.tenantId,
        receipt_url: receiptUrl,
        status: "pending",
        notes,
      });

      // Clear state
      ctx.session.state = null;
      ctx.session.data = {};

      const text = "Payment submitted successfully. ✅\n\nManagement has received your submission and will process it shortly.";
      const keyboard = new InlineKeyboard().text("🏠 Home", "home");

      await ctx.editMessageText(text, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();

    } catch (error) {
      console.error("Error processing receipt:", error);
      await ctx.editMessageText("Sorry, an error occurred while saving your receipt. Please try again.", {
        reply_markup: new InlineKeyboard().text("🏠 Home", "home")
      });
      await ctx.answerCallbackQuery();
    }
  });
}
