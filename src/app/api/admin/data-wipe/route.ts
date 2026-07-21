import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Valid wipe categories. The order here doesn't matter — the handler
 * resolves which tables to truncate and processes them in FK-safe order.
 */
const VALID_CATEGORIES = [
  "tenants",
  "units",
  "leases",
  "finance",
  "documents",
  "staff",
  "tax",
  "audit_logs",
  "all",
] as const;

type WipeCategory = (typeof VALID_CATEGORIES)[number];

/**
 * POST /api/admin/data-wipe — permanently delete data by category.
 *
 * Auth: Tech Admin only.
 * Body: { categories: WipeCategory[] }
 *
 * Uses the service-role key so FK-ordered bulk deletes succeed regardless
 * of per-table RLS delete policies (e.g. payments has no delete policy).
 */
export async function POST(request: Request) {
  // ---- auth ----
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!me?.is_active || me.role !== "tech_admin") {
    return NextResponse.json(
      { error: "Only a Tech Admin can wipe data" },
      { status: 403 }
    );
  }

  // ---- parse body ----
  const body = await request.json().catch(() => null);
  const categories: WipeCategory[] = body?.categories;
  if (
    !Array.isArray(categories) ||
    categories.length === 0 ||
    !categories.every((c) =>
      (VALID_CATEGORIES as readonly string[]).includes(c)
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Provide { categories: [...] } with at least one valid category.",
      },
      { status: 400 }
    );
  }

  // ---- resolve which tables to purge ----
  const expand = (cats: WipeCategory[]): Set<string> => {
    const tables = new Set<string>();
    for (const c of cats) {
      switch (c) {
        case "all":
          tables.add("payment_reminders");
          tables.add("payments");
          tables.add("invoices");
          tables.add("leases");
          tables.add("documents");
          tables.add("expenses");
          tables.add("tenants");
          tables.add("units");
          tables.add("tax_filings");
          tables.add("tax_parameters");
          tables.add("audit_logs");
          tables.add("profiles");
          break;
        case "tenants":
          // Tenants own leases → invoices → payments/reminders, and docs
          tables.add("payment_reminders");
          tables.add("payments");
          tables.add("invoices");
          tables.add("leases");
          tables.add("tenants");
          break;
        case "units":
          // Leases reference units with ON DELETE RESTRICT
          tables.add("payment_reminders");
          tables.add("payments");
          tables.add("invoices");
          tables.add("leases");
          tables.add("units");
          break;
        case "leases":
          tables.add("payment_reminders");
          tables.add("payments");
          tables.add("invoices");
          tables.add("leases");
          break;
        case "finance":
          tables.add("payment_reminders");
          tables.add("payments");
          tables.add("invoices");
          tables.add("expenses");
          break;
        case "documents":
          tables.add("documents");
          break;
        case "staff":
          tables.add("profiles");
          break;
        case "tax":
          tables.add("tax_filings");
          tables.add("tax_parameters");
          break;
        case "audit_logs":
          tables.add("audit_logs");
          break;
      }
    }
    return tables;
  };

  const tablesToPurge = expand(categories);

  // FK-safe deletion order.
  const ORDER = [
    "payment_reminders",
    "payments",
    "invoices",
    "leases",
    "documents",
    "expenses",
    "tenants",
    "units",
    "tax_filings",
    "tax_parameters",
    "audit_logs",
    "profiles",
  ];

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const deleted: Record<string, number> = {};

  try {
    for (const table of ORDER) {
      if (!tablesToPurge.has(table)) continue;

      if (table === "profiles") {
        // Delete all profiles except the caller, so they don't lock
        // themselves out. Also remove the corresponding auth.users.
        const { data: otherProfiles } = await admin
          .from("profiles")
          .select("id")
          .neq("id", user.id);

        if (otherProfiles && otherProfiles.length > 0) {
          // Delete auth users first (profiles cascade from auth.users)
          for (const p of otherProfiles) {
            await admin.auth.admin.deleteUser(p.id);
          }
        }
        deleted.profiles = otherProfiles?.length ?? 0;
        continue;
      }

      if (table === "documents") {
        // Remove files from storage first
        const { data: docs } = await admin
          .from("documents")
          .select("storage_path");

        if (docs && docs.length > 0) {
          const paths = docs.map((d: { storage_path: string }) => d.storage_path);
          // Supabase storage remove accepts up to 1000 paths at a time
          for (let i = 0; i < paths.length; i += 1000) {
            await admin.storage
              .from("documents")
              .remove(paths.slice(i, i + 1000));
          }
        }
      }

      // Generic table purge — delete all rows
      const { count, error } = await admin
        .from(table)
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // always-true filter to satisfy PostgREST

      if (error) {
        throw new Error(`Failed to delete from ${table}: ${error.message}`);
      }
      deleted[table] = count ?? 0;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during wipe";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted });
}
