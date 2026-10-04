import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Admin actions and cron jobs only.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
