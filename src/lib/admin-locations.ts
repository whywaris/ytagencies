import "server-only";

import { getLocations } from "@/lib/data/taxonomy";

/** Locations for an HQ <select>, grouped by country. */
export async function hqLocationOptions() {
  const locations = await getLocations();
  const countries = locations.filter((l) => l.type === "country");
  return countries.flatMap((c) => [
    { slug: c.slug, name: c.name, group: c.name },
    ...locations
      .filter((l) => l.parentId === c.id)
      .map((l) => ({ slug: l.slug, name: l.name, group: c.name })),
  ]);
}
