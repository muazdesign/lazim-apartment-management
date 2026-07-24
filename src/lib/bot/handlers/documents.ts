import { Bot, InlineKeyboard } from "grammy";
import type { BotContext } from "../index";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";

export function setupDocumentsHandler(bot: Bot<BotContext>) {
  // --- ANNOUNCEMENTS ---
  bot.callbackQuery("announcements", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    const { data: announcements } = await supabaseAdmin
      .from("announcements")
      .select("title, content, is_pinned, created_at")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);

    let text = "📢 **Announcements**\n\n";

    if (announcements && announcements.length > 0) {
      announcements.forEach((ann) => {
        const pin = ann.is_pinned ? "📌 " : "";
        const date = format(new Date(ann.created_at), "MMM d");
        text += `${pin}**${ann.title}** (${date})\n${ann.content}\n\n`;
      });
    } else {
      text += "There are no recent announcements.";
    }

    const keyboard = new InlineKeyboard().text("⬅ Back", "home").text("🏠 Home", "home");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // --- DOCUMENTS ---
  bot.callbackQuery("documents", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    // Usually documents are mapped in the documents table, 
    // or they could be static links. Here we'll just mock static links as requested.
    const text = "📄 **Documents**\n\nSelect a document to view or download:";

    const keyboard = new InlineKeyboard()
      .url("📄 Lease Agreement", "https://lazim-apartment-management.vercel.app/docs/lease-template.pdf").row()
      .url("📄 House Rules", "https://lazim-apartment-management.vercel.app/docs/house-rules.pdf").row()
      .url("📄 Emergency Contacts", "https://lazim-apartment-management.vercel.app/docs/emergency-contacts.pdf").row()
      .url("📄 Building Policies", "https://lazim-apartment-management.vercel.app/docs/building-policies.pdf").row()
      .text("⬅ Back", "home").text("🏠 Home", "home");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });
}
