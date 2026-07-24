import { webhookCallback } from "grammy";
import { bot } from "@/lib/bot";
import { NextRequest, NextResponse } from "next/server";

// We use grammy's built-in webhook callback for standard web Request/Response APIs
export const runtime = "edge";
export const dynamic = "force-dynamic";

const handleUpdate = webhookCallback(bot, "std/http");

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    
    // Simple verification (optional but recommended to secure the endpoint)
    if (process.env.TELEGRAM_WEBHOOK_SECRET && token !== process.env.TELEGRAM_WEBHOOK_SECRET) {
       // if we choose to use a secret query param for extra safety
    }

    // Pass the standard Web Request object to grammy
    const response = await handleUpdate(req);
    return response;
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Telegram bot webhook is running." });
}
