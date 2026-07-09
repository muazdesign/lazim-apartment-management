-- ============================================================
-- Migration 0005: Managers can manage staff accounts
--
-- Managers may now create, edit, activate/deactivate accounts —
-- everything a tech admin can do EXCEPT anything involving the
-- tech_admin role: a manager cannot create a tech admin, promote
-- anyone to tech admin, or modify an existing tech admin account.
-- That keeps privilege escalation impossible while delegating
-- day-to-day user management.
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES policies: widen from tech_admin to manager+
-- (deletes stay tech_admin-only; the app deactivates instead)
-- ------------------------------------------------------------
drop policy "profiles: update own" on public.profiles;
create policy "profiles: update own or user manager"
  on public.profiles for update
  using (id = auth.uid() or public.is_manager_or_admin())
  with check (id = auth.uid() or public.is_manager_or_admin());

drop policy "profiles: admin insert" on public.profiles;
create policy "profiles: manager insert"
  on public.profiles for insert
  with check (public.is_manager_or_admin());

-- ------------------------------------------------------------
-- Guard trigger: managers manage everyone except tech admins.
-- ------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Tech admins are unrestricted. So are service-role calls
  -- (auth.uid() is null): the API route using the service key
  -- performs its own authorization checks, and RLS already
  -- blocks unauthenticated users before this trigger runs.
  if auth.uid() is null or public.is_tech_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active then
    if not public.is_manager_or_admin() then
      raise exception 'Only a manager or tech admin can change roles or account status';
    end if;
    if new.role = 'tech_admin' then
      raise exception 'Only a tech admin can grant the tech admin role';
    end if;
  end if;

  -- A manager may not touch a tech admin account at all
  -- (their own row is never tech_admin, so self-updates pass).
  if old.role = 'tech_admin' and old.id <> auth.uid() then
    raise exception 'Only a tech admin can modify a tech admin account';
  end if;

  return new;
end;
$$;
