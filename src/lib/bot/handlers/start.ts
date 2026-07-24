import { Bot, InlineKeyboard, Keyboard } from "grammy";
import type { BotContext } from "../index";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function setupStartHandler(bot: Bot<BotContext>) {
  bot.command("start", async (ctx) => {
    // If we already know the tenant from session middleware
    if (ctx.session.tenantId) {
      return ctx.reply("Welcome back! Use /dashboard to access your account.", {
        reply_markup: new InlineKeyboard().text("🏠 Go to Dashboard", "home"),
      });
    }

    // Otherwise, ask for phone number to link
    const keyboard = new Keyboard()
      .requestContact("📱 Share Contact")
      .resized()
      .oneTime();

    await ctx.reply(
      "Welcome to the Rent Management Bot! 🏢\n\n" +
      "To verify your identity, please share your contact number using the button below.",
      { reply_markup: keyboard }
    );
  });

  bot.on(":contact", async (ctx) => {
    if (ctx.session.tenantId) {
      return ctx.reply("Your account is already linked. Tap below to access your dashboard.", {
        reply_markup: { remove_keyboard: true },
      }).then(() => {
        ctx.reply("Access your dashboard here:", {
          reply_markup: new InlineKeyboard().text("🏠 Home", "home"),
        });
      });
    }

    const contact = ctx.message?.contact;
    if (!contact) return;

    // Normalize phone number (handle Ethiopian codes or similar logic)
    let phone = contact.phone_number.replace(/\D/g, "");
    if (phone.startsWith("251")) {
      phone = "0" + phone.substring(3);
    }

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .select("id, full_name")
      .eq("phone", phone)
      .eq("is_active", true)
      .single();

    if (error || !tenant) {
      return ctx.reply(
        `❌ We couldn't find an active tenant account with the phone number ${phone}. Please contact management.`,
        { reply_markup: { remove_keyboard: true } }
      );
    }

    // Link account
    await supabaseAdmin
      .from("tenants")
      .update({ telegram_chat_id: ctx.chat?.id.toString() })
      .eq("id", tenant.id);

    ctx.session.tenantId = tenant.id;

    await ctx.reply(`Welcome, ${tenant.full_name}! ✅\nYour account is now securely linked.`, {
      reply_markup: { remove_keyboard: true },
    });

    await ctx.reply("Access your dashboard to get started:", {
      reply_markup: new InlineKeyboard().text("🏠 Go to Dashboard", "home"),
    });
  });
}
