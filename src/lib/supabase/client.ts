import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

// Anon-key client for Client Components. Respects RLS.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
