-- ============================================================
-- Apartment Management System — Telegram Bot Features
-- Migration 0009: Maintenance tickets and announcements
-- ============================================================

-- 1. Create maintenance_tickets table
CREATE TYPE public.maintenance_category AS ENUM (
    'plumbing', 'electrical', 'doors_locks', 'water', 'internet', 'cleaning', 'other'
);

CREATE TYPE public.maintenance_status AS ENUM (
    'pending', 'assigned', 'in_progress', 'completed'
);

CREATE TABLE public.maintenance_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    unit_id uuid REFERENCES public.units (id) ON DELETE SET NULL,
    category public.maintenance_category NOT NULL DEFAULT 'other',
    description text,
    photo_url text,
    status public.maintenance_status NOT NULL DEFAULT 'pending',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public.profiles (id)
);

-- Enable RLS
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

-- Staff can view and update
CREATE POLICY "Staff can view maintenance_tickets" ON public.maintenance_tickets
    FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can update maintenance_tickets" ON public.maintenance_tickets
    FOR UPDATE USING (public.is_staff());

-- System (bot) can insert and select
CREATE POLICY "System can insert maintenance_tickets" ON public.maintenance_tickets
    FOR INSERT WITH CHECK (true);
CREATE POLICY "System can select maintenance_tickets" ON public.maintenance_tickets
    FOR SELECT USING (true); -- Usually restricted by API logic

CREATE INDEX idx_maintenance_tenant ON public.maintenance_tickets (tenant_id);
CREATE INDEX idx_maintenance_status ON public.maintenance_tickets (status);

-- Trigger for updated_at
CREATE TRIGGER touch_maintenance_tickets 
    BEFORE UPDATE ON public.maintenance_tickets 
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Create announcements table
CREATE TABLE public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    is_pinned boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES public.profiles (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Staff can manage announcements
CREATE POLICY "Staff can manage announcements" ON public.announcements
    FOR ALL USING (public.is_staff());

-- Public / System can view
CREATE POLICY "Public can view announcements" ON public.announcements
    FOR SELECT USING (true);

CREATE INDEX idx_announcements_pinned ON public.announcements (is_pinned);
CREATE INDEX idx_announcements_created_at ON public.announcements (created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER touch_announcements 
    BEFORE UPDATE ON public.announcements 
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Create bot_sessions table to hold temporary conversational state
-- Because Next.js handles requests statelessly, storing expected next steps here is reliable.
CREATE TABLE public.bot_sessions (
    chat_id bigint PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
    state jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage bot_sessions" ON public.bot_sessions
    FOR ALL USING (true);

CREATE TRIGGER touch_bot_sessions 
    BEFORE UPDATE ON public.bot_sessions 
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
