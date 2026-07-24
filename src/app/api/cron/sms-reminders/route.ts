import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms';

// Verify Vercel cron request
function verifyCronRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return false;
  }
  return true;
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Use service role key to bypass RLS for cron jobs
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 5 days ago
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);
    const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

    // Find invoices due today
    const { data: dueToday, error: errorDueToday } = await supabase
      .from('invoices')
      .select('id, amount, due_date, amount_paid, tenants (id, full_name, phone)')
      .in('status', ['sent', 'partially_paid'])
      .eq('due_date', todayStr);

    if (errorDueToday) throw errorDueToday;

    // Find invoices 5 days overdue
    const { data: overdue, error: errorOverdue } = await supabase
      .from('invoices')
      .select('id, amount, due_date, amount_paid, tenants (id, full_name, phone)')
      .in('status', ['sent', 'partially_paid', 'overdue'])
      .eq('due_date', fiveDaysAgoStr);

    if (errorOverdue) throw errorOverdue;

    const results = {
      sent: 0,
      failed: 0,
      logs: [] as any[],
    };

    // Helper to send and log SMS
    const processSms = async (invoice: any, messageTemplate: string) => {
      const tenant = invoice.tenants;
      if (!tenant || !tenant.phone) return;

      const amountDue = invoice.amount - invoice.amount_paid;
      const message = messageTemplate
        .replace('{{name}}', tenant.full_name)
        .replace('{{amount}}', amountDue.toString());

      const smsResult = await sendSms({ to: tenant.phone, message });

      // Save log
      await supabase.from('sms_logs').insert({
        tenant_id: tenant.id,
        phone_number: tenant.phone,
        message,
        status: smsResult.success ? 'sent' : 'failed',
        provider_response: smsResult.providerResponse || { error: smsResult.error },
      });

      if (smsResult.success) {
        results.sent++;
      } else {
        results.failed++;
      }
      
      results.logs.push({
        tenant: tenant.full_name,
        phone: tenant.phone,
        success: smsResult.success,
      });
    };

    // Process due today
    for (const invoice of dueToday || []) {
      await processSms(
        invoice,
        `Dear {{name}}, your rent of {{amount}} ETB is due today. Please make the payment to avoid penalties.`
      );
    }

    // Process 5 days overdue
    for (const invoice of overdue || []) {
      await processSms(
        invoice,
        `Dear {{name}}, your rent of {{amount}} ETB is 5 days overdue. Please note that late payment penalties will now apply as per your lease agreement.`
      );
    }

    // Process Queued Messages
    const now = new Date().toISOString();
    const { data: queuedMessages, error: errorQueued } = await supabase
      .from('sms_logs')
      .select('id, tenant_id, phone_number, message')
      .in('status', ['scheduled', 'pending'])
      .lte('scheduled_for', now);
      
    if (errorQueued) throw errorQueued;

    for (const queued of queuedMessages || []) {
      const smsResult = await sendSms({ to: queued.phone_number, message: queued.message });
      
      // Update log
      await supabase.from('sms_logs').update({
        status: smsResult.success ? 'sent' : 'failed',
        provider_response: smsResult.providerResponse || { error: smsResult.error },
        sent_at: new Date().toISOString()
      }).eq('id', queued.id);

      if (smsResult.success) {
        results.sent++;
      } else {
        results.failed++;
      }
      
      results.logs.push({
        type: 'queued',
        phone: queued.phone_number,
        success: smsResult.success,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      ...results,
    });
  } catch (error: any) {
    console.error('Error in SMS cron job:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
