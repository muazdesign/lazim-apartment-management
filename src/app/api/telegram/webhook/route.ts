import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Supabase client will be initialized dynamically inside the POST handler

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup
    })
  });
}

function normalizePhone(phone: string) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('251')) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Missing Supabase credentials');
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const update = await req.json();

    if (!update.message) return NextResponse.json({ ok: true });

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';

    // Handle /start command
    if (text === '/start') {
      await sendMessage(
        chatId,
        'Welcome to Lazim Rent! Please share your phone number to link your tenant account.',
        {
          keyboard: [[{ text: '📱 Share Contact', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      );
      return NextResponse.json({ ok: true });
    }

    // Handle Contact Sharing
    if (msg.contact) {
      const phone = normalizePhone(msg.contact.phone_number);
      
      // Find tenant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, full_name')
        .eq('phone', phone)
        .eq('is_active', true)
        .single();

      if (!tenant) {
        await sendMessage(chatId, `We couldn't find an active tenant account with the phone number ${phone}. Please contact management.`);
        return NextResponse.json({ ok: true });
      }

      // Link account
      await supabase
        .from('tenants')
        .update({ telegram_chat_id: chatId.toString() })
        .eq('id', tenant.id);

      await sendMessage(
        chatId,
        `Welcome ${tenant.full_name}! Your account is securely linked.\n\nYou can now upload rent payment receipts by sending photos here. Use /status to check your account.`,
        { remove_keyboard: true }
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /status command
    if (text === '/status') {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, full_name')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!tenant) {
        await sendMessage(chatId, 'Your account is not linked. Send /start to link it.');
        return NextResponse.json({ ok: true });
      }

      const { data: invoices } = await supabase
        .from('invoices')
        .select('amount_due, amount_paid, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'unpaid');

      const totalOwed = invoices?.reduce((sum, inv) => sum + (inv.amount_due - inv.amount_paid), 0) || 0;

      if (totalOwed > 0) {
        await sendMessage(chatId, `You currently have outstanding invoices totaling ${totalOwed} Birr. Please send a photo of your bank transfer receipt to pay.`);
      } else {
        await sendMessage(chatId, 'Your account is in good standing! You have no unpaid invoices.');
      }
      return NextResponse.json({ ok: true });
    }

    // Handle Photo (Receipt Upload)
    if (msg.photo && msg.photo.length > 0) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!tenant) {
        await sendMessage(chatId, 'Your account is not linked. Send /start to link it before uploading receipts.');
        return NextResponse.json({ ok: true });
      }

      // Get highest resolution photo
      const photo = msg.photo[msg.photo.length - 1];
      const fileId = photo.file_id;

      // Get file path from Telegram
      const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      const filePath = fileData.result.file_path;

      // Download file
      const downloadRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`);
      const blob = await downloadRes.blob();

      // Upload to Supabase Storage
      const fileName = `${tenant.id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        await sendMessage(chatId, 'Sorry, there was an error saving your receipt. Please try again later.');
        return NextResponse.json({ ok: true });
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
      const receiptUrl = publicUrlData.publicUrl;

      // Create Payment Request
      await supabase.from('payment_requests').insert({
        tenant_id: tenant.id,
        receipt_url: receiptUrl,
        status: 'pending'
      });

      await sendMessage(chatId, '✅ Receipt received! It is now pending manual approval by the finance team. We will notify you once it is approved.');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
