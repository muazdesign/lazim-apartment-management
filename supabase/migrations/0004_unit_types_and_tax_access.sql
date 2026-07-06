-- ============================================================
-- Migration 0004
--   1. Give units a property type (flat / shop / warehouse / …)
--   2. Let Managers — not only Tech Admins — manage tax parameters
-- ============================================================

-- 1) Property type -------------------------------------------
alter table public.units
  add column if not exists unit_type text not null default 'flat';

alter table public.units
  drop constraint if exists units_unit_type_check;

alter table public.units
  add constraint units_unit_type_check
  check (unit_type in ('flat', 'shop', 'warehouse', 'office', 'other'));

-- 2) Tax parameters: managers + tech admins ------------------
drop policy if exists "tax_parameters: admin write"  on public.tax_parameters;
drop policy if exists "tax_parameters: admin update" on public.tax_parameters;
drop policy if exists "tax_parameters: admin delete" on public.tax_parameters;

create policy "tax_parameters: manager write"
  on public.tax_parameters for insert
  with check (public.is_manager_or_admin());

create policy "tax_parameters: manager update"
  on public.tax_parameters for update
  using (public.is_manager_or_admin());

create policy "tax_parameters: manager delete"
  on public.tax_parameters for delete
  using (public.is_manager_or_admin());
