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

    // Fetch documents associated with this tenant
    const { data: documents } = await supabaseAdmin
      .from("documents")
      .select("title, storage_path, doc_type")
      .eq("tenant_id", ctx.session.tenantId)
      .eq("status", "approved");

    let text = "📄 **Documents**\n\n";
    const keyboard = new InlineKeyboard();

    if (documents && documents.length > 0) {
      text += "Select a document to view or download:\n\n*(Links expire in 24 hours)*";

      for (const doc of documents) {
        // Generate signed URL
        const { data: signedUrlData } = await supabaseAdmin.storage
          .from("documents")
          .createSignedUrl(doc.storage_path, 60 * 60 * 24); // 24 hours

        if (signedUrlData?.signedUrl) {
          keyboard.url(`📄 ${doc.title}`, signedUrlData.signedUrl).row();
        }
      }
    } else {
      text += "You currently have no documents available.";
    }

    keyboard.text("⬅ Back", "home").text("🏠 Home", "home");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });
}
