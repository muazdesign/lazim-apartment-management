-- ============================================================
-- Apartment Management System — Core Schema
-- Migration 0001: extensions, enums, tables, triggers, functions
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ENUMS (these replace a separate `roles` lookup table —
-- roles are enforced at the type level and in RLS)
-- ------------------------------------------------------------
create type public.user_role as enum ('tech_admin', 'manager', 'secretary');

create type public.unit_status as enum ('vacant', 'occupied', 'maintenance', 'unavailable');

create type public.lease_status as enum ('active', 'expired', 'terminated', 'pending');

create type public.invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void');

create type public.payment_method as enum ('cash', 'bank_transfer', 'check', 'card', 'mobile_money', 'other');

create type public.expense_category as enum (
  'maintenance', 'utilities', 'management_fees', 'insurance',
  'taxes', 'cleaning', 'security', 'supplies', 'other'
);

create type public.document_type as enum (
  'lease_agreement', 'contract', 'id_copy', 'receipt', 'invoice_pdf', 'other'
);

create type public.document_status as enum ('pending_review', 'approved', 'rejected');

create type public.reminder_channel as enum ('email', 'sms');

create type public.reminder_status as enum ('queued', 'sent', 'failed');

-- ------------------------------------------------------------
-- PROFILES (the app-facing "users" table; 1:1 with auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  phone       text,
  role        public.user_role not null default 'secretary',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER so they can read
-- profiles without recursive RLS evaluation)
-- ------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_tech_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select public.current_user_role() = 'tech_admin' $$;

create or replace function public.is_manager_or_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select public.current_user_role() in ('tech_admin', 'manager') $$;

create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public stable
as $$ select public.current_user_role() in ('tech_admin', 'manager', 'secretary') $$;

-- ------------------------------------------------------------
-- UNITS
-- ------------------------------------------------------------
create table public.units (
  id            uuid primary key default gen_random_uuid(),
  unit_number   text not null unique,
  floor         int,
  bedrooms      int not null default 1,
  bathrooms     int not null default 1,
  size_sqm      numeric(8,2),
  monthly_rent  numeric(12,2) not null default 0 check (monthly_rent >= 0),
  status        public.unit_status not null default 'vacant',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TENANTS
-- ------------------------------------------------------------
create table public.tenants (
  id                       uuid primary key default gen_random_uuid(),
  full_name                text not null,
  email                    text,
  phone                    text,
  national_id              text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  notes                    text,
  is_active                boolean not null default true,
  created_by               uuid references public.profiles (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ------------------------------------------------------------
-- LEASES (a tenant occupying a unit for a period)
-- ------------------------------------------------------------
create table public.leases (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete restrict,
  unit_id          uuid not null references public.units (id) on delete restrict,
  start_date       date not null,
  end_date         date not null,
  monthly_rent     numeric(12,2) not null check (monthly_rent >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  payment_due_day  int not null default 1 check (payment_due_day between 1 and 28),
  status           public.lease_status not null default 'pending',
  notes            text,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date > start_date)
);

-- Only one active lease per unit at a time.
create unique index one_active_lease_per_unit
  on public.leases (unit_id) where (status = 'active');

-- ------------------------------------------------------------
-- INVOICES
-- ------------------------------------------------------------
create sequence public.invoice_number_seq;

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text not null unique
                  default ('INV-' || to_char(now(), 'YYYY') || '-' ||
                           lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  lease_id        uuid not null references public.leases (id) on delete restrict,
  tenant_id       uuid not null references public.tenants (id) on delete restrict,
  period_start    date not null,
  period_end      date not null,
  due_date        date not null,
  amount          numeric(12,2) not null check (amount >= 0),
  amount_paid     numeric(12,2) not null default 0 check (amount_paid >= 0),
  status          public.invoice_status not null default 'draft',
  notes           text,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (lease_id, period_start)          -- no duplicate invoice for the same cycle
);

-- ------------------------------------------------------------
-- PAYMENTS (ledger — rows are never updated, only voided)
-- ------------------------------------------------------------
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id) on delete restrict,
  tenant_id    uuid not null references public.tenants (id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  method       public.payment_method not null default 'bank_transfer',
  reference    text,
  paid_at      timestamptz not null default now(),
  notes        text,
  is_voided    boolean not null default false,
  recorded_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- Keep invoice totals/status in sync with its payments.
create or replace function public.sync_invoice_on_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_total numeric(12,2);
  v_amount numeric(12,2);
  v_due date;
begin
  select coalesce(sum(amount), 0) into v_total
    from public.payments
   where invoice_id = v_invoice_id and not is_voided;

  select amount, due_date into v_amount, v_due
    from public.invoices where id = v_invoice_id;

  update public.invoices
     set amount_paid = v_total,
         status = case
           when status = 'void'            then 'void'
           when v_total >= v_amount        then 'paid'
           when v_total > 0                then 'partially_paid'
           when v_due < current_date       then 'overdue'
           else status
         end,
         updated_at = now()
   where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create trigger on_payment_change
  after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_on_payment();

-- ------------------------------------------------------------
-- DOCUMENTS (metadata; binaries live in Supabase Storage)
-- ------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  doc_type      public.document_type not null default 'other',
  status        public.document_status not null default 'pending_review',
  title         text not null,
  file_name     text not null,
  storage_path  text not null unique,     -- path inside the 'documents' bucket
  mime_type     text,
  size_bytes    bigint,
  tenant_id     uuid references public.tenants (id) on delete set null,
  lease_id      uuid references public.leases (id) on delete set null,
  uploaded_by   uuid references public.profiles (id),
  approved_by   uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- EXPENSES
-- ------------------------------------------------------------
create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  category       public.expense_category not null default 'other',
  description    text not null,
  amount         numeric(12,2) not null check (amount > 0),
  incurred_on    date not null default current_date,
  vendor         text,
  unit_id        uuid references public.units (id) on delete set null,
  receipt_doc_id uuid references public.documents (id) on delete set null,
  ai_categorized boolean not null default false,
  ai_confidence  numeric(4,3) check (ai_confidence between 0 and 1),
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TAX PARAMETERS & YEARLY PAYABLES
-- ------------------------------------------------------------
create table public.tax_parameters (
  id                 uuid primary key default gen_random_uuid(),
  tax_year           int not null unique,
  jurisdiction       text not null default 'default',
  tax_rate           numeric(6,4) not null check (tax_rate between 0 and 1),
  standard_deduction numeric(12,2) not null default 0,
  notes              text,
  updated_by         uuid references public.profiles (id),
  updated_at         timestamptz not null default now()
);

create table public.tax_filings (
  id             uuid primary key default gen_random_uuid(),
  tax_year       int not null unique,
  gross_income   numeric(14,2) not null default 0,
  total_expenses numeric(14,2) not null default 0,
  net_income     numeric(14,2) not null default 0,
  tax_due        numeric(14,2) not null default 0,
  is_finalized   boolean not null default false,
  computed_at    timestamptz not null default now(),
  computed_by    uuid references public.profiles (id)
);

-- Recompute the yearly payable from the ledger + parameters.
create or replace function public.compute_tax_filing(p_year int)
returns public.tax_filings
language plpgsql
security definer set search_path = public
as $$
declare
  v_income numeric(14,2);
  v_expenses numeric(14,2);
  v_rate numeric(6,4);
  v_deduction numeric(12,2);
  v_net numeric(14,2);
  v_row public.tax_filings;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Only managers or tech admins can compute tax filings';
  end if;

  select coalesce(sum(amount), 0) into v_income
    from public.payments
   where not is_voided and extract(year from paid_at) = p_year;

  select coalesce(sum(amount), 0) into v_expenses
    from public.expenses
   where extract(year from incurred_on) = p_year;

  select tax_rate, standard_deduction into v_rate, v_deduction
    from public.tax_parameters where tax_year = p_year;

  if v_rate is null then
    raise exception 'No tax parameters configured for year %', p_year;
  end if;

  v_net := v_income - v_expenses;

  insert into public.tax_filings (tax_year, gross_income, total_expenses, net_income, tax_due, computed_by)
  values (p_year, v_income, v_expenses, v_net,
          greatest(v_net - v_deduction, 0) * v_rate, auth.uid())
  on conflict (tax_year) do update
     set gross_income = excluded.gross_income,
         total_expenses = excluded.total_expenses,
         net_income = excluded.net_income,
         tax_due = excluded.tax_due,
         computed_at = now(),
         computed_by = excluded.computed_by
   where not public.tax_filings.is_finalized
  returning * into v_row;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- PAYMENT REMINDERS (written by the Edge Function)
-- ------------------------------------------------------------
create table public.payment_reminders (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  channel     public.reminder_channel not null default 'email',
  status      public.reminder_status not null default 'queued',
  message     text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- AUDIT LOG (tech-admin visible; written by trigger)
-- ------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,               -- INSERT / UPDATE / DELETE
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(), tg_op, tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- Audit the financially-sensitive tables.
create trigger audit_invoices  after insert or update or delete on public.invoices  for each row execute function public.write_audit_log();
create trigger audit_payments  after insert or update or delete on public.payments  for each row execute function public.write_audit_log();
create trigger audit_expenses  after insert or update or delete on public.expenses  for each row execute function public.write_audit_log();
create trigger audit_leases    after insert or update or delete on public.leases    for each row execute function public.write_audit_log();
create trigger audit_profiles  after insert or update or delete on public.profiles  for each row execute function public.write_audit_log();

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_units    before update on public.units    for each row execute function public.touch_updated_at();
create trigger touch_tenants  before update on public.tenants  for each row execute function public.touch_updated_at();
create trigger touch_leases   before update on public.leases   for each row execute function public.touch_updated_at();
create trigger touch_invoices before update on public.invoices for each row execute function public.touch_updated_at();
create trigger touch_expenses before update on public.expenses for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- RENT-CYCLE AUTOMATION
-- Generates the current month's invoice for every active lease.
-- Called monthly by a scheduled Edge Function (or pg_cron).
-- ------------------------------------------------------------
create or replace function public.generate_monthly_invoices()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_start date := date_trunc('month', current_date)::date;
  v_end   date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  for r in
    select l.id, l.tenant_id, l.monthly_rent, l.payment_due_day
      from public.leases l
     where l.status = 'active'
       and l.start_date <= v_end
       and l.end_date >= v_start
       and not exists (
         select 1 from public.invoices i
          where i.lease_id = l.id and i.period_start = v_start
       )
  loop
    insert into public.invoices (lease_id, tenant_id, period_start, period_end, due_date, amount, status)
    values (r.id, r.tenant_id, v_start, v_end,
            v_start + (r.payment_due_day - 1), r.monthly_rent, 'sent');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Flag overdue invoices (run daily before the reminder job).
create or replace function public.mark_overdue_invoices()
returns int
language sql
security definer set search_path = public
as $$
  with updated as (
    update public.invoices
       set status = 'overdue', updated_at = now()
     where status in ('sent', 'partially_paid')
       and due_date < current_date
       and amount_paid < amount
    returning 1
  )
  select count(*)::int from updated;
$$;

-- ------------------------------------------------------------
-- DASHBOARD AGGREGATES (single RPC so the UI needs one call;
-- restricted to manager/tech_admin because it exposes financials)
-- ------------------------------------------------------------
create or replace function public.dashboard_metrics(p_months int default 6)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Access denied: financial metrics are restricted';
  end if;

  select jsonb_build_object(
    'monthly', (
      select coalesce(jsonb_agg(m order by m ->> 'month'), '[]'::jsonb) from (
        select jsonb_build_object(
          'month', to_char(gs, 'YYYY-MM'),
          'income', coalesce((select sum(p.amount) from public.payments p
                              where not p.is_voided
                                and date_trunc('month', p.paid_at) = gs), 0),
          'expenses', coalesce((select sum(e.amount) from public.expenses e
                                where date_trunc('month', e.incurred_on::timestamptz) = gs), 0)
        ) as m
        from generate_series(
          date_trunc('month', current_date) - make_interval(months => p_months - 1),
          date_trunc('month', current_date), interval '1 month') gs
      ) sub
    ),
    'outstanding', (select coalesce(sum(amount - amount_paid), 0) from public.invoices
                     where status in ('sent', 'partially_paid', 'overdue')),
    'overdue_count', (select count(*) from public.invoices where status = 'overdue'),
    'occupancy', jsonb_build_object(
      'total',    (select count(*) from public.units where status <> 'unavailable'),
      'occupied', (select count(*) from public.units where status = 'occupied')
    ),
    'active_tenants', (select count(*) from public.tenants where is_active)
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- INDEXES for common lookups
-- ------------------------------------------------------------
create index idx_leases_tenant     on public.leases (tenant_id);
create index idx_leases_unit       on public.leases (unit_id);
create index idx_invoices_lease    on public.invoices (lease_id);
create index idx_invoices_tenant   on public.invoices (tenant_id);
create index idx_invoices_status   on public.invoices (status);
create index idx_invoices_due      on public.invoices (due_date);
create index idx_payments_invoice  on public.payments (invoice_id);
create index idx_payments_tenant   on public.payments (tenant_id);
create index idx_payments_paid_at  on public.payments (paid_at);
create index idx_expenses_date     on public.expenses (incurred_on);
create index idx_expenses_category on public.expenses (category);
create index idx_documents_tenant  on public.documents (tenant_id);
create index idx_audit_created     on public.audit_logs (created_at);
