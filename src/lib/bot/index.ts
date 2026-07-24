import { Bot, Context, session, SessionFlavor } from "grammy";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { Language } from "./i18n";

interface SessionData {
  tenantId: string | null;
  state: string | null;
  lang: Language | null;
  data: Record<string, any>;
}

export type BotContext = Context & SessionFlavor<SessionData>;

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing.");
}

export const bot = new Bot<BotContext>(botToken);

function initial(): SessionData {
  return {
    tenantId: null,
    state: null,
    lang: null,
    data: {},
  };
}

// Since Vercel is serverless, in-memory session will reset per request.
// However, since telegram bot session state usually persists, 
// for simple inline button logic we will embed state in callback data,
// but for text input steps, we need DB storage.
// Custom session storage adapter using Supabase:
const supabaseStorage = {
  read: async (key: string) => {
    const { data, error } = await supabaseAdmin
      .from("bot_sessions")
      .select("state")
      .eq("chat_id", key)
      .single();

    if (error || !data) return undefined;
    return data.state as SessionData;
  },
  write: async (key: string, value: SessionData) => {
    await supabaseAdmin.from("bot_sessions").upsert({
      chat_id: key,
      state: value as any,
      updated_at: new Date().toISOString(),
    });
  },
  delete: async (key: string) => {
    await supabaseAdmin.from("bot_sessions").delete().eq("chat_id", key);
  },
};

bot.use(
  session({
    initial,
    storage: supabaseStorage,
  })
);

// Middleware to inject tenant info if registered
bot.use(async (ctx, next) => {
  if (ctx.chat?.id) {
    // If not cached in session
    if (!ctx.session.tenantId) {
      const { data } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("telegram_chat_id", ctx.chat.id.toString())
        .single();
      if (data) {
        ctx.session.tenantId = data.id;
      }
    }
  }
  await next();
});

// Import and register handlers
import { setupStartHandler } from "./handlers/start";
import { setupDashboardHandler } from "./handlers/dashboard";
import { setupPaymentsHandler } from "./handlers/payments";
import { setupMaintenanceHandler } from "./handlers/maintenance";
import { setupDocumentsHandler } from "./handlers/documents";
import { setupContactHandler } from "./handlers/contact";

setupStartHandler(bot);
setupDashboardHandler(bot);
setupPaymentsHandler(bot);
setupMaintenanceHandler(bot);
setupDocumentsHandler(bot);
setupContactHandler(bot);

// Catch-all for unhandled
bot.on("message", (ctx) => {
  // If the user types a random message and they aren't in a specific text-input state
  if (!ctx.session.state) {
    if (ctx.session.tenantId) {
      ctx.reply("I didn't understand that command. Please use the menu.", {
        reply_markup: {
          inline_keyboard: [[{ text: "🏠 Home", callback_data: "home" }]],
        },
      });
    } else {
      ctx.reply("You are not registered in this property. Please contact management.");
    }
  }
});
