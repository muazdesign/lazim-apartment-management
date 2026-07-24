-- ============================================================
-- Apartment Management System — Telegram Bot & Receipts
-- Migration 0008: Add telegram integration and pending receipts
-- ============================================================

-- 1. Add Telegram Chat ID to tenants
ALTER TABLE public.tenants
ADD COLUMN telegram_chat_id text UNIQUE;

-- 2. Create payment_requests table
CREATE TABLE public.payment_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    receipt_url text NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_by uuid REFERENCES public.profiles (id),
    reviewed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Allow read/write access to staff
CREATE POLICY "Staff can view payment_requests" ON public.payment_requests
    FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Staff can update payment_requests" ON public.payment_requests
    FOR UPDATE
    USING (public.is_staff());

-- Allow system (webhook) to insert requests
CREATE POLICY "System can insert payment_requests" ON public.payment_requests
    FOR INSERT
    WITH CHECK (true);

-- Indexes
CREATE INDEX idx_payment_requests_tenant ON public.payment_requests (tenant_id);
CREATE INDEX idx_payment_requests_status ON public.payment_requests (status);

-- 3. Set up Storage Bucket for Receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for receipts bucket
-- Allow public viewing of receipts (since the URL is obscure and needed for admin dashboard)
CREATE POLICY "Public Access to Receipts" ON storage.objects
    FOR SELECT USING (bucket_id = 'receipts');

-- Allow system/service_role to upload receipts
CREATE POLICY "System can upload receipts" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'receipts');

-- Allow staff to manage/delete receipts
CREATE POLICY "Staff can manage receipts" ON storage.objects
    FOR ALL USING (bucket_id = 'receipts' AND public.is_staff());
