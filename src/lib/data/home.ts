import "server-only";
import { cache } from "react";

import { getAgencySlugs, getResponseTimes, listQuery, toListItem } from "@/lib/data/agencies";
import { profileViews } from "@/lib/data/agency-stats";
import { getPlacement } from "@/lib/data/placement";
import { pickHomeAgencies } from "@/lib/home";

// Home page "Agencies business owners are looking at": indexable profiles only (no thin, noindex
// or unpublished ones), at most one sponsored first, then by profile views, then merit (lib/home.ts).
export const getHomeAgencies = cache(async () => {
  const [{ data, error }, slugs, placement, responses] = await Promise.all([
    listQuery(),
    getAgencySlugs(),
    getPlacement(),
    getResponseTimes(),
  ]);
  if (error) throw error;
  const indexable = new Set(slugs.filter((s) => s.indexable).map((s) => s.slug));
  const rows = data.filter((r) => indexable.has(r.slug));
  const views = await profileViews(rows.map((r) => r.id));
  return pickHomeAgencies(
    rows.map((r) => toListItem(r, placement, responses)),
    {
      sponsoredIds: placement.sponsoredAnywhere(),
      views: Object.fromEntries(views),
    },
  );
});
