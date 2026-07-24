import { createClient } from '@supabase/supabase-js';
try {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  console.log("Created successfully");
} catch (e) {
  console.log("Error:", e.message);
}
