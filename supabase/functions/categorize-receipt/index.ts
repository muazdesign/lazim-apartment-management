// Supabase Edge Function: categorize-receipt
//
// Called by the app when a user attaches a receipt image to an expense.
// Downloads the image from Storage, sends it to Claude for OCR +
// categorization, and returns a structured suggestion the form can prefill.
//
// Secrets required:  supabase secrets set ANTHROPIC_API_KEY=...

import { createClient } from "jsr:@supabase/supabase-js@2";

const CATEGORIES = [
  "maintenance",
  "utilities",
  "management_fees",
  "insurance",
  "taxes",
  "cleaning",
  "security",
  "supplies",
  "other",
] as const;

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // Verify the caller is a signed-in, active staff member.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { data: profile } = await userClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();
    if (!profile?.is_active || !["tech_admin", "manager"].includes(profile.role)) {
      return json({ error: "Not allowed" }, 403);
    }

    const { storage_path } = await req.json();
    if (!storage_path || typeof storage_path !== "string") {
      return json({ error: "storage_path is required" }, 400);
    }

    // Download the receipt with the service role.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: file, error: dlError } = await admin.storage
      .from("documents")
      .download(storage_path);
    if (dlError || !file) return json({ error: "File not found" }, 404);

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    }
    const base64 = btoa(binary);
    const mediaType = file.type || "image/jpeg";

    // Ask Claude to read the receipt.
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text:
                  `Read this expense receipt for an apartment building. ` +
                  `Respond with ONLY a JSON object, no prose: ` +
                  `{"category": one of ${JSON.stringify(CATEGORIES)}, ` +
                  `"amount": total amount as a number or null, ` +
                  `"vendor": business name or null, ` +
                  `"description": short plain-English description of the purchase or null, ` +
                  `"confidence": 0-1 how confident you are overall}`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      return json({ error: "AI service unavailable" }, 502);
    }

    const ai = await anthropicRes.json();
    const text: string = ai.content?.[0]?.text ?? "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};

    const category = CATEGORIES.includes(parsed.category)
      ? parsed.category
      : "other";

    return json({
      category,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      description:
        typeof parsed.description === "string" ? parsed.description : null,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
    });
  } catch {
    return json({ error: "Unexpected error" }, 500);
  }
});
