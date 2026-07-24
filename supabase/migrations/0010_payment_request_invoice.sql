-- Migration 0010: Add invoice_id to payment_requests
ALTER TABLE public.payment_requests
ADD COLUMN invoice_id uuid REFERENCES public.invoices (id) ON DELETE CASCADE;
