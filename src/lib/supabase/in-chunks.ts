// `.in(column, ids)` puts every id in the request URL. A few hundred UUIDs push the URL past the
// ~16 KB header limit (UND_ERR_HEADERS_OVERFLOW on Vercel), so long lists go in batches and the
// rows are joined. No imports: tested (tests/in-chunks.test.mjs).

/** Ids per request: 100 UUIDs are ~3.7 KB of URL, leaving room for long select lists. */
export const IN_CHUNK = 100;

/** Runs `query` once per batch of ids and joins the rows (order across batches isn't kept). */
export async function inChunks<Row>(
  ids: readonly string[],
  query: (batch: string[]) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  size = IN_CHUNK,
): Promise<{ data: Row[]; error: unknown }> {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += size) batches.push(unique.slice(i, i + size));
  const results = await Promise.all(batches.map((b) => query(b)));
  const failed = results.find((r) => r.error);
  if (failed) return { data: [], error: failed.error };
  return { data: results.flatMap((r) => r.data ?? []), error: null };
}

/** The same for `count: "exact", head: true` queries: the counts are added up. */
export async function countInChunks(
  ids: readonly string[],
  query: (batch: string[]) => PromiseLike<{ count: number | null; error: unknown }>,
  size = IN_CHUNK,
): Promise<{ count: number; error: unknown }> {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += size) batches.push(unique.slice(i, i + size));
  const results = await Promise.all(batches.map((b) => query(b)));
  const failed = results.find((r) => r.error);
  if (failed) return { count: 0, error: failed.error };
  return { count: results.reduce((n, r) => n + (r.count ?? 0), 0), error: null };
}
