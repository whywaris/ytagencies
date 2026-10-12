import "server-only";

import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { createAdminClient } from "@/lib/supabase/admin";

/** Pickers for the admin review form: every agency (any status), services, industries. */
export async function reviewFormOptions() {
  const [agencies, services, industries] = await Promise.all([
    createAdminClient().from("agencies").select("id, name").order("name"),
    getServices(),
    getIndustries(),
  ]);
  if (agencies.error) throw new Error("Couldn't load agencies");
  return {
    agencies: agencies.data.map((a) => ({ value: a.id, label: a.name })),
    services: services.map((s) => ({ value: s.slug, label: s.name })),
    industries: industries.map((i) => ({ value: i.slug, label: i.name })),
  };
}
