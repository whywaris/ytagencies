// Google AdSense. The account tag is always on (it's how AdSense connects the site, and loads
// nothing). The ads script, and the CSP hosts it needs, only with NEXT_PUBLIC_ADS_ENABLED=1 on
// Vercel's Production environment, once the site is approved. Guide articles only.
export const ADSENSE_CLIENT = "ca-pub-6426833983159115";

export function adsEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NEXT_PUBLIC_ADS_ENABLED?.trim() === "1" && env.VERCEL_ENV === "production";
}
