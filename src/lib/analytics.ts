// Google Analytics 4: whether it runs at all. Read on the server at build/render time (no
// cookies), so public pages stay static. Only with a GA ID and ALLOW_INDEXING exactly "true"
// (production), so never on localhost or preview deployments.
export function gaId() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || process.env.ALLOW_INDEXING !== "true") return null;
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}
