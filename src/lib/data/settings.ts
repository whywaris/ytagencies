import "server-only";
import { cache } from "react";

import { DEFAULT_TABS_MAX } from "@/lib/guide-categories";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin → Settings values public pages need. app_settings isn't readable with the anon key, so
// it's read here with the service role (read-only), once per render.

/** How many category tabs /guides shows before "More" (default 6). */
export const getGuideTabsMax = cache(async () => {
  const { data } = await createAdminClient()
    .from("app_settings")
    .select("guide_tabs_max")
    .maybeSingle();
  return data?.guide_tabs_max ?? DEFAULT_TABS_MAX;
});
