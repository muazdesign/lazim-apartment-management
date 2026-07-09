import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/users — create a staff account (Tech Admin or Manager).
 * Managers may not create Tech Admin accounts.
 * Uses the service-role key, so authorization is checked explicitly here
 * in addition to RLS.
 */
export async function POST(request: Request) {
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
      { error: "Only a Tech Admin or Manager can create accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { email, password, full_name, role } = body ?? {};
  if (
    !email ||
    !password ||
    typeof password !== "string" ||
    password.length < 8 ||
    !["tech_admin", "manager", "secretary"].includes(role)
  ) {
    return NextResponse.json(
      { error: "Email, a password of at least 8 characters, and a valid role are required" },
      { status: 400 }
    );
  }

  if (me.role === "manager" && role === "tech_admin") {
    return NextResponse.json(
      { error: "Only a Tech Admin can create Tech Admin accounts" },
      { status: 403 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? "" },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // The handle_new_user trigger created the profile; set its role.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name: full_name ?? "" })
    .eq("id", created.user.id);
  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}
