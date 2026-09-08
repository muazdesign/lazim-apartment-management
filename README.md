# Lazim Rent Management — AI-Powered Apartment Management System

A dashboard-centric management system for small apartment buildings, designed
for **non-technical users**: plain-language labels, large click targets, and a
confirmation dialog in front of every destructive action.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage, Edge
Functions) · Tailwind CSS 4 + shadcn/ui · TanStack React Query · Recharts ·
jsPDF + xlsx exports.

## Roles

| Capability | Tech Admin | Manager | Secretary |
|---|---|---|---|
| Tenants / units / leases | manage | manage | view |
| Invoices | manage | manage | view + create |
| Payments, expenses, financial dashboard | ✅ | ✅ | ❌ |
| Documents | manage | approve/delete | view + upload |
| Yearly tax calculation | ✅ | ✅ | ❌ |
| Tax parameters, staff accounts, audit log | ✅ | ❌ | ❌ |

Enforced twice: in Postgres **RLS policies** (the real gatekeeper,
`supabase/migrations/0002_rls.sql`) and mirrored in the UI
(`src/lib/permissions.ts`) so users never see buttons they can't use.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the three migrations **in order**:
   `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_storage.sql`
   (or `npx supabase db push` if you use the CLI).
3. Create your first user under **Authentication → Users → Add user**
   (email + password, auto-confirm on), then promote them in the SQL editor:
   ```sql
   update public.profiles set role = 'tech_admin' where email = 'you@example.com';
   ```
4. Optionally run `supabase/seed.sql` for sample units and tax parameters.

### 2. App

```bash
cp .env.example .env.local   # fill in URL + anon key + service-role key
npm install
npm run dev
```

Sign in at http://localhost:3000 with the user you created. From
**Administration** you can now create Manager and Secretary accounts.

### 3. Edge Functions (automation & AI)

```bash
supabase functions deploy late-payment-reminders
supabase functions deploy categorize-receipt
supabase secrets set RESEND_API_KEY=...          # email reminders
supabase secrets set REMINDER_FROM_EMAIL=...     # verified sender
supabase secrets set ANTHROPIC_API_KEY=...       # receipt OCR/categorization
```

Schedule `late-payment-reminders` daily (Dashboard → Edge Functions →
Schedules, cron `0 8 * * *`). It marks overdue invoices and emails tenants,
with a 3-day cooldown per invoice.

`categorize-receipt` is called automatically when a Manager attaches a
receipt image to an expense — Claude reads it and prefills category, amount,
and vendor (always shown as a suggestion to double-check).

## Monthly rent cycle

Anyone with invoice access can press **"Create this month's invoices"** on
the Invoices page; it calls the idempotent `generate_monthly_invoices()`
function (one invoice per active lease per month — safe to press twice).
To fully automate it, schedule that RPC with `pg_cron` or a small Edge
Function.

## Project map

```
supabase/migrations/   schema, RLS, storage policies (run in order)
supabase/functions/    late-payment-reminders, categorize-receipt (Deno)
src/proxy.ts           session refresh + auth gate (Next 16 "proxy", ex-middleware)
src/lib/               supabase clients, permissions, export (xlsx/pdf), types
src/app/(app)/         dashboard, tenants, units, invoices, payments,
                       expenses, documents, reports, taxes, admin
src/components/        module UIs + shared (StatusBadge, ConfirmDialog, …)
```
