// Google Analytics 4: whether it may run at all. Read on the server at build time (no cookies), so
// public pages stay static. Only with a GA4 measurement ID on Vercel's Production environment, so
// never on localhost or preview deployments. Independent of ALLOW_INDEXING (lib/indexing.ts).
// Signed-in visitors and private routes are excluded in the browser (lib/track.ts).
export function gaId(env: Record<string, string | undefined> = process.env) {
  const id = env.NEXT_PUBLIC_GA_ID;
  if (!id || env.VERCEL_ENV !== "production") return null;
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}
