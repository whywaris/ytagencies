// Lets the proxy answer "does this public URL exist?" before rendering starts.
// Why: in Next 16, notFound() thrown inside a page returns a 404 whose HTML body is empty (the
// not-found UI only renders client-side). Rewriting unknown slugs to an unmatched path in the
// proxy gets the fully server-rendered root not-found with a real 404 (docs: loading.md,
// "Status Codes"). Pages keep their own notFound() as the fallback.

type Slugs = {
  services: Set<string>;
  industries: Set<string>;
  locations: Set<string>;
  agencies: Set<string>;
  /** Live guides plus old slugs that redirect to one (RLS hides drafts and future guides). */
  guides: Set<string>;
  /** Authors with a live guide (RLS hides the rest). */
  authors: Set<string>;
};

const TTL_MS = 60_000; // a newly published agency can 404 for up to a minute per instance
let cache: { at: number; slugs: Slugs } | null = null;

async function slugsOf(table: string, query = "", column = "slug") {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=${column}${query}`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      signal: AbortSignal.timeout(1500),
    },
  );
  if (!res.ok) throw new Error(`${table}: ${res.status}`);
  return new Set(((await res.json()) as Record<string, string>[]).map((r) => r[column]));
}

async function getSlugs(): Promise<Slugs | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.slugs;
  try {
    // Anon key: RLS already limits agencies to published ones.
    const [services, industries, locations, agencies, guides, redirects, authors] =
      await Promise.all([
        slugsOf("services"),
        slugsOf("industries"),
        slugsOf("locations"),
        slugsOf("agencies", "&status=eq.published"),
        slugsOf("guides"),
        slugsOf("guide_redirects", "", "from_slug"),
        slugsOf("authors"),
      ]);
    cache = {
      at: Date.now(),
      slugs: {
        services,
        industries,
        locations,
        agencies,
        guides: new Set([...guides, ...redirects]),
        authors,
      },
    };
    return cache.slugs;
  } catch {
    return cache?.slugs ?? null; // database unreachable: use stale data, or don't block at all
  }
}

// First path segments that are real routes, not a [service] slug.
const STATIC_ROOTS = new Set([
  "agencies",
  "industries",
  "locations",
  "guides",
  "get-matched",
  "request-proposals",
  "list-your-agency",
  "for-agencies",
  "pricing",
  "how-we-rank",
  "no-access",
  "login",
  "privacy",
  "terms",
  "refunds",
  "cookies",
  "disclosure",
  "editorial-policy",
  "about",
  "contact",
  "report-listing",
  "remove-listing",
  "styleguide",
  "dashboard",
  "admin",
  "auth",
  "claim",
  "sitemaps",
  "og",
]);

/**
 * false when the path is a public dynamic route whose slug doesn't exist; true or null otherwise
 * (null = couldn't check, let the page decide).
 */
export async function publicPathExists(pathname: string): Promise<boolean | null> {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return true;
  const [first, second, third] = parts;

  if (first === "guides") {
    if (parts.length !== 2) return true;
    const slugs = await getSlugs();
    return slugs ? slugs.guides.has(second) : null;
  }
  if (first === "authors") {
    if (parts.length !== 2) return parts.length === 1 ? false : true; // no /authors index
    const slugs = await getSlugs();
    return slugs ? slugs.authors.has(second) : null;
  }
  if (first === "agency") {
    if (parts.length === 2 || (parts.length === 3 && third === "claim")) {
      const slugs = await getSlugs();
      return slugs ? slugs.agencies.has(second) : null;
    }
    return true; // let Next handle other shapes
  }
  if (STATIC_ROOTS.has(first) || parts.length > 2) return true; // 3+ segments already 404 fully

  // /[service] and /[service]/[segment]
  const slugs = await getSlugs();
  if (!slugs) return null;
  if (!slugs.services.has(first)) return false;
  if (parts.length === 1) return true;
  if (second.startsWith("for-")) return slugs.industries.has(second.slice(4));
  if (second.startsWith("in-")) return slugs.locations.has(second.slice(3));
  return false;
}
