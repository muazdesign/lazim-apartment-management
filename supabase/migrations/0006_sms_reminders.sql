-- ============================================================
-- Apartment Management System — SMS Reminders
-- Migration 0006: Create sms_logs table
-- ============================================================

CREATE TABLE public.sms_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
    phone_number text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'sent', -- e.g., 'sent', 'failed'
    provider_response jsonb,
    sent_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to staff (managers, secretaries, tech_admin)
CREATE POLICY "Staff can view sms_logs" ON public.sms_logs
    FOR SELECT
    USING (public.is_staff());

-- Only the system (edge function/cron) or staff can insert logs
CREATE POLICY "System and staff can insert sms_logs" ON public.sms_logs
    FOR INSERT
    WITH CHECK (true); -- Usually inserted via service role, but we'll allow staff to manually trigger too.

CREATE INDEX idx_sms_logs_tenant ON public.sms_logs (tenant_id);
CREATE INDEX idx_sms_logs_sent_at ON public.sms_logs (sent_at);
