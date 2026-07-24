import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN environment variable is not set.' }, { status: 400 });
  }

  const url = new URL(req.url);
  const host = url.host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  
  // Construct the webhook URL dynamically based on the current environment
  const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
    const data = await res.json();
    return NextResponse.json({
      success: data.ok,
      telegramResponse: data,
      webhookUrl: webhookUrl
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
