-- ============================================================
-- Migration 0002: Row Level Security — RBAC enforcement
--
-- Role matrix (also mirrored in src/lib/permissions.ts):
--   tech_admin : everything, incl. audit logs & tax parameters
--   manager    : all operational + financial data
--   secretary  : view tenants/units/leases, create standard
--                invoices, upload/view documents.
--                NO access to payments, expenses, tax, audit.
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.units             enable row level security;
alter table public.tenants           enable row level security;
alter table public.leases            enable row level security;
alter table public.invoices          enable row level security;
alter table public.payments          enable row level security;
alter table public.documents         enable row level security;
alter table public.expenses          enable row level security;
alter table public.tax_parameters    enable row level security;
alter table public.tax_filings       enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.audit_logs        enable row level security;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
-- Everyone can read their own profile; staff can see all staff.
create policy "profiles: read own or staff list"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

-- Users may update their own contact info; role changes are
-- blocked by trigger below unless done by a tech_admin.
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid() or public.is_tech_admin())
  with check (id = auth.uid() or public.is_tech_admin());

-- Only tech_admin manages accounts (activate/deactivate, roles).
create policy "profiles: admin insert"
  on public.profiles for insert
  with check (public.is_tech_admin());

create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.is_tech_admin());

-- Prevent privilege escalation: only tech_admin can change roles.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_tech_admin() then
    raise exception 'Only a tech admin can change user roles';
  end if;
  if new.is_active is distinct from old.is_active and not public.is_tech_admin() then
    raise exception 'Only a tech admin can activate/deactivate users';
  end if;
  return new;
end;
$$;

create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ------------------------------------------------------------
-- UNITS — all staff read; managers+ write
-- ------------------------------------------------------------
create policy "units: staff read"      on public.units for select using (public.is_staff());
create policy "units: manager insert"  on public.units for insert with check (public.is_manager_or_admin());
create policy "units: manager update"  on public.units for update using (public.is_manager_or_admin());
create policy "units: manager delete"  on public.units for delete using (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- TENANTS — all staff read; managers+ write
-- (spec: secretary has *viewing* access to tenants)
-- ------------------------------------------------------------
create policy "tenants: staff read"     on public.tenants for select using (public.is_staff());
create policy "tenants: manager insert" on public.tenants for insert with check (public.is_manager_or_admin());
create policy "tenants: manager update" on public.tenants for update using (public.is_manager_or_admin());
create policy "tenants: manager delete" on public.tenants for delete using (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- LEASES — all staff read; managers+ write
-- ------------------------------------------------------------
create policy "leases: staff read"     on public.leases for select using (public.is_staff());
create policy "leases: manager insert" on public.leases for insert with check (public.is_manager_or_admin());
create policy "leases: manager update" on public.leases for update using (public.is_manager_or_admin());
create policy "leases: manager delete" on public.leases for delete using (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- INVOICES — staff read + create (secretaries generate standard
-- invoices); only managers+ may update or void
-- ------------------------------------------------------------
create policy "invoices: staff read"     on public.invoices for select using (public.is_staff());
create policy "invoices: staff insert"   on public.invoices for insert with check (public.is_staff());
create policy "invoices: manager update" on public.invoices for update using (public.is_manager_or_admin());
create policy "invoices: manager delete" on public.invoices for delete using (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- PAYMENTS — core financial data: managers+ only.
-- Ledger integrity: no deletes for anyone; void instead.
-- ------------------------------------------------------------
create policy "payments: manager read"   on public.payments for select using (public.is_manager_or_admin());
create policy "payments: manager insert" on public.payments for insert with check (public.is_manager_or_admin());
create policy "payments: manager update" on public.payments for update using (public.is_manager_or_admin());
-- (no delete policy on purpose — the ledger is append-only)

-- ------------------------------------------------------------
-- DOCUMENTS — staff read + upload; approval/delete managers+
-- ------------------------------------------------------------
create policy "documents: staff read"    on public.documents for select using (public.is_staff());
create policy "documents: staff insert"  on public.documents for insert
  with check (public.is_staff() and uploaded_by = auth.uid());
create policy "documents: manager update" on public.documents for update using (public.is_manager_or_admin());
create policy "documents: manager delete" on public.documents for delete using (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- EXPENSES — core financial data: managers+ only
-- ------------------------------------------------------------
create policy "expenses: manager read"   on public.expenses for select using (public.is_manager_or_admin());
create policy "expenses: manager insert" on public.expenses for insert with check (public.is_manager_or_admin());
create policy "expenses: manager update" on public.expenses for update using (public.is_manager_or_admin());
create policy "expenses: manager delete" on public.expenses for delete using (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- TAX — parameters editable by tech_admin; filings visible to
-- managers+, computed via the compute_tax_filing() RPC
-- ------------------------------------------------------------
create policy "tax_parameters: manager read" on public.tax_parameters for select using (public.is_manager_or_admin());
create policy "tax_parameters: admin write"  on public.tax_parameters for insert with check (public.is_tech_admin());
create policy "tax_parameters: admin update" on public.tax_parameters for update using (public.is_tech_admin());
create policy "tax_parameters: admin delete" on public.tax_parameters for delete using (public.is_tech_admin());

create policy "tax_filings: manager read"   on public.tax_filings for select using (public.is_manager_or_admin());
create policy "tax_filings: manager update" on public.tax_filings for update using (public.is_manager_or_admin());
-- inserts happen only through compute_tax_filing() (security definer)

-- ------------------------------------------------------------
-- PAYMENT REMINDERS — managers+ read; written by Edge Function
-- using the service-role key (bypasses RLS)
-- ------------------------------------------------------------
create policy "reminders: manager read" on public.payment_reminders for select using (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- AUDIT LOGS — tech_admin read-only; rows written by trigger
-- ------------------------------------------------------------
create policy "audit: admin read" on public.audit_logs for select using (public.is_tech_admin());
-- no insert/update/delete policies: only the SECURITY DEFINER
-- trigger writes here, and nobody can tamper with history.
