// Google AdSense. The account tag (it connects the site, and loads nothing) and the CSP hosts are
// always on. The ads script only with NEXT_PUBLIC_ADS_ENABLED=1 on Vercel's Production environment,
// and on guide articles only.
export const ADSENSE_CLIENT = "ca-pub-6426833983159115";

export function adsEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NEXT_PUBLIC_ADS_ENABLED?.trim() === "1" && env.VERCEL_ENV === "production";
}
