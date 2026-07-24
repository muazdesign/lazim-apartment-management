-- ============================================================
-- Apartment Management System — SMS Queue
-- Migration 0007: Add scheduled_for to sms_logs
-- ============================================================

ALTER TABLE public.sms_logs
ADD COLUMN scheduled_for timestamptz;

CREATE INDEX idx_sms_logs_scheduled_for ON public.sms_logs (scheduled_for);
