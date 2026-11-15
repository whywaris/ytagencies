// Lets the proxy answer "does this public URL exist?" before rendering starts.
// Why: in Next 16, notFound() thrown inside a page returns a 404 whose HTML body is empty (the
// not-found UI only renders client-side). Rewriting unknown slugs to an unmatched path in the
// proxy gets the fully server-rendered root not-found with a real 404 (docs: loading.md,
// "Status Codes"). Pages keep their own notFound() as the fallback.

type Slugs = {
  /** Live guides plus old slugs that redirect to one (RLS hides drafts and future guides). */
  guides: Set<string>;
  /** Authors with a live guide (RLS hides the rest). */
  authors: Set<string>;
};

const TTL_MS = 60_000; // a newly published guide can 404 for up to a minute per instance
let cache: { at: number; slugs: Slugs } | null = null;

async function slugsOf(table: string, column = "slug") {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=${column}`,
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
    const [guides, redirects, authors] = await Promise.all([
      slugsOf("guides"),
      slugsOf("guide_redirects", "from_slug"),
      slugsOf("authors"),
    ]);
    cache = { at: Date.now(), slugs: { guides: new Set([...guides, ...redirects]), authors } };
    return cache.slugs;
  } catch {
    return cache?.slugs ?? null; // database unreachable: use stale data, or don't block at all
  }
}

/**
 * false when the path is a public dynamic route whose slug doesn't exist; true or null otherwise
 * (null = couldn't check, let the page decide).
 */
export async function publicPathExists(pathname: string): Promise<boolean | null> {
  const parts = pathname.split("/").filter(Boolean);
  const [first, second] = parts;
  if (first === "guides" && parts.length === 2) {
    const slugs = await getSlugs();
    return slugs ? slugs.guides.has(second) : null;
  }
  if (first === "authors") {
    if (parts.length !== 2) return parts.length === 1 ? false : true; // no /authors index
    const slugs = await getSlugs();
    return slugs ? slugs.authors.has(second) : null;
  }
  return true; // everything else is a fixed route: Next 404s what doesn't match
}
