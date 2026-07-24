import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/sms';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify staff permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['tech_admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden. Only managers or tech admins can send SMS manually.' }, { status: 403 });
    }

    const { tenantId, message } = await request.json();

    if (!tenantId || !message) {
      return NextResponse.json({ error: 'Tenant ID and message are required' }, { status: 400 });
    }

    // Get tenant phone number
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('phone, full_name')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    if (!tenant.phone) {
      return NextResponse.json({ error: 'Tenant does not have a phone number' }, { status: 400 });
    }

    // Send the SMS
    const smsResult = await sendSms({ to: tenant.phone, message });

    // Save log
    const { error: insertError } = await supabase.from('sms_logs').insert({
      tenant_id: tenantId,
      phone_number: tenant.phone,
      message,
      status: smsResult.success ? 'sent' : 'failed',
      provider_response: smsResult.providerResponse || { error: smsResult.error },
    });

    if (insertError) {
      console.error('Error saving SMS log:', insertError);
    }

    if (!smsResult.success) {
      return NextResponse.json({ error: smsResult.error || 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'SMS sent successfully' });
  } catch (error: any) {
    console.error('Error in manual SMS sender:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
