import { Bot, InlineKeyboard } from "grammy";
import type { BotContext } from "../index";

export function setupContactHandler(bot: Bot<BotContext>) {
  bot.callbackQuery("contact", async (ctx) => {
    if (!ctx.session.tenantId) return ctx.answerCallbackQuery("Not authenticated.");

    const text = 
      `☎ **Contact Management**\n\n` +
      `**Office Hours:**\n` +
      `Monday - Friday: 8:30 AM - 5:30 PM\n` +
      `Saturday: 9:00 AM - 1:00 PM\n` +
      `Sunday: Closed\n\n` +
      `*For emergencies, please call the office directly.*`;

    const keyboard = new InlineKeyboard()
      .url("📞 Call Office", "tel:+251911234567").url("💬 Telegram Support", "https://t.me/LazimSupportBot").row()
      .url("🟢 WhatsApp", "https://wa.me/251911234567").url("📧 Email", "mailto:support@lazim.com").row()
      .text("⬅ Back", "home").text("🏠 Home", "home");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });
}
