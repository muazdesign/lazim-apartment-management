import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: "c:/apartment-management/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Calling dashboard_metrics...");
  const { data, error } = await supabase.rpc("dashboard_metrics", { p_months: 6 });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("Data:", JSON.stringify(data, null, 2));
  }
}

main();
