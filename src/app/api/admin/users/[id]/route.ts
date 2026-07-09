import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/database.types";

/**
 * PATCH /api/admin/users/[id] — edit a staff account (Tech Admin or
 * Manager). Accepts full_name, email, role, and an optional new
 * password. Managers may not edit Tech Admin accounts or promote
 * anyone to Tech Admin. Uses the service-role key (email/password
 * live in auth.users), so authorization is checked explicitly here
 * in addition to RLS.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  if (!me?.is_active || !["tech_admin", "manager"].includes(me.role)) {
    return NextResponse.json(
      { error: "Only a Tech Admin or Manager can edit accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { email, full_name, role, password } = (body ?? {}) as {
    email?: string;
    full_name?: string;
    role?: UserRole;
    password?: string;
  };

  if (role && !["tech_admin", "manager", "secretary"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
    return NextResponse.json(
      { error: "The new password needs at least 8 characters" },
      { status: 400 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();
  if (!target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (
    me.role === "manager" &&
    (target.role === "tech_admin" || role === "tech_admin")
  ) {
    return NextResponse.json(
      { error: "Only a Tech Admin can manage Tech Admin accounts" },
      { status: 403 }
    );
  }

  // Email and password live in auth.users; update them first so a
  // failure there leaves the profile untouched.
  if (email !== undefined || password !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ...(email !== undefined ? { email, email_confirm: true } : {}),
      ...(password !== undefined ? { password } : {}),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const patch: { full_name?: string; email?: string; role?: UserRole } = {};
  if (full_name !== undefined) patch.full_name = full_name;
  if (email !== undefined) patch.email = email;
  if (role !== undefined) patch.role = role;

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("profiles").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
