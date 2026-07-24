import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { numberToAmharic } from "@/lib/amharic-numbers";
import { toEth } from "@/lib/ethiopian-calendar";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(req.url);

    // Fetch lease with relations
    const { data: lease, error } = await supabase
      .from("leases")
      .select("*, tenant:tenants(*), unit:units(*)")
      .eq("id", id)
      .single();

    if (error || !lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Read query parameters
    const tenant_citizenship = url.searchParams.get("tenant_citizenship") || "ኢትዮፕያዊ";
    const tenant_address_zone = url.searchParams.get("tenant_address_zone") || "";
    const tenant_address_city = url.searchParams.get("tenant_address_city") || "";
    const advance_months = parseInt(url.searchParams.get("advance_months") || "3", 10);
    const witness1_name = url.searchParams.get("witness1_name") || "";
    const witness2_name = url.searchParams.get("witness2_name") || "";
    const witness3_name = url.searchParams.get("witness3_name") || "";
    const late_fee_pct = url.searchParams.get("late_fee_pct") || "1";

    // Computations
    const rent_amount = Number(lease.monthly_rent) || 0;
    const rent_words = numberToAmharic(rent_amount);
    const advance_total = rent_amount * advance_months;
    const advance_words = numberToAmharic(advance_total);
    const advance_months_word = numberToAmharic(advance_months);

    const ethStart = lease.start_date ? toEth(lease.start_date) : null;
    const ethEnd = lease.end_date ? toEth(lease.end_date) : null;

    const start_date = ethStart
      ? `${String(ethStart.day).padStart(2, "0")}/${String(ethStart.month).padStart(2, "0")}/${ethStart.year}`
      : "";
    const end_date = ethEnd
      ? `${String(ethEnd.day).padStart(2, "0")}/${String(ethEnd.month).padStart(2, "0")}/${ethEnd.year}`
      : "";

    const tenant_name = lease.tenant?.full_name || "";
    const unit_number = lease.unit?.unit_number || "";

    // Read template
    const templatePath = path.join(process.cwd(), "src", "templates", "lease-template.docx");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Template not found" }, { status: 500 });
    }
    
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Render document
    doc.render({
      tenant_name,
      tenant_citizenship,
      tenant_address_zone,
      tenant_address_city,
      unit_number,
      rent_amount,
      rent_words,
      advance_months_word,
      advance_total,
      advance_words,
      start_date,
      end_date,
      late_fee_pct,
      witness1_name,
      witness2_name,
      witness3_name
    });

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const safeName = encodeURIComponent(tenant_name.replace(/\s+/g, "_"));
    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="lease.docx"; filename*=UTF-8''lease-${safeName}.docx`,
      },
    });
  } catch (error: any) {
    console.error("Error generating document:", error);
    return NextResponse.json({ error: "Internal Server Error", details: String(error), stack: error.stack }, { status: 500 });
  }
}
