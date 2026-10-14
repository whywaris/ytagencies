import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

import { gaId } from "./src/lib/analytics";
import { creemEnvProblems } from "./src/lib/billing/creem-events";
import { companyTodos } from "./src/lib/company";
import { indexingAllowed, noindexHeaders } from "./src/lib/indexing";
import { turnstileKeyProblems } from "./src/lib/turnstile-keys";
import { mediaHosts } from "./src/lib/media";
import { PRICING_REDIRECTS } from "./src/lib/pricing-redirects";

const isDev = process.env.NODE_ENV === "development";
// Our Cloudflare image host(s) for pasted cover links (MEDIA_HOSTS, see src/lib/media.ts).
const media = mediaHosts();
// Lock CSP to this environment's Supabase project; wildcard only when the env var is missing (e.g. CI build).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const supabaseHost = supabaseUrl?.host ?? "*.supabase.co";

// Vercel Analytics is same-origin (/_vercel/insights) in production; va.vercel-scripts.com is its dev-only debug script.
// ponytail: static CSP with 'unsafe-inline' scripts, because a nonce CSP forces every page dynamic and breaks ISR.
// Upgrade to hashes/SRI if Next supports them for static pages.
// Google Analytics 4 (components/analytics.tsx): the gtag script, and where it sends hits.
// Google profile photos in the account menu (lib/account.ts AVATAR_HOST).
const AVATAR_HOST = "https://lh3.googleusercontent.com";
const GA_SCRIPT = "https://www.googletagmanager.com";
const GA_HITS =
  "https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com ${GA_SCRIPT}${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost}${media.map((h) => ` https://${h}`).join("")} ${GA_HITS} ${AVATAR_HOST}`,
  "font-src 'self'",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} ${GA_HITS}${isDev ? " https://va.vercel-scripts.com" : ""}`,
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Agency slugs never change once published (CLAUDE.md). If one must, add { from, to } here: the
 * profile, its claim page and the owner's dashboard (every section) all redirect permanently.
 */
const AGENCY_SLUG_REDIRECTS: { from: string; to: string }[] = [];

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    // Uploads go through server actions: guide images up to 5 MB + multipart overhead (default 1 MB).
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    // Agency logos from Supabase Storage (public bucket).
    // Local Supabase (CLI or a dev mock) runs on 127.0.0.1; Next 16 refuses local IPs unless allowed.
    dangerouslyAllowLocalIP: isDev,
    remotePatterns: [
      ...media.map((hostname) => ({ protocol: "https" as const, hostname })),
      // Google profile photos (the account menu avatar).
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      {
        protocol: supabaseUrl?.protocol === "http:" ? "http" : "https",
        hostname: supabaseUrl?.hostname ?? "*.supabase.co",
        port: supabaseUrl?.port ?? "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // www → apex, 308. Keep the domain in sync with SITE_DOMAIN in src/lib/site.ts.
  async redirects() {
    return [
      ...PRICING_REDIRECTS,
      // Short link for reports; agency profiles link to /contact?topic=report&agency=<slug>.
      { source: "/report-listing", destination: "/contact?topic=report", permanent: true },
      // Old child sitemap, split into services/combos/locations/pages under /sitemap.xml.
      { source: "/sitemaps/categories.xml", destination: "/sitemap.xml", permanent: true },
      // Managing a listing moved from /agency/<slug>/claim to /claim/<slug>.
      { source: "/agency/:slug/claim", destination: "/claim/:slug", permanent: true },
      ...AGENCY_SLUG_REDIRECTS.flatMap(({ from, to }) => [
        { source: `/agency/${from}`, destination: `/agency/${to}`, permanent: true },
        { source: `/claim/${from}`, destination: `/claim/${to}`, permanent: true },
        {
          source: `/dashboard/${from}/:path*`,
          destination: `/dashboard/${to}/:path*`,
          permanent: true,
        },
      ]),
      // Dashboard sections: Plan and analytics split into Plan (billing) and Analytics.
      { source: "/dashboard/:id/plan", destination: "/dashboard/:id/analytics", permanent: true },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ytagencies.com" }],
        destination: "https://ytagencies.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Until launch (ALLOW_INDEXING), every response also says noindex (lib/indexing.ts).
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, ...noindexHeaders(indexingAllowed())],
      },
    ];
  },
};

// Launch checklist: list company facts nobody has filled in yet (src/lib/company.ts).
export default function config(phase: string): NextConfig {
  // Production builds refuse missing or Cloudflare test Turnstile keys (lib/turnstile-keys.ts).
  if (phase === PHASE_PRODUCTION_BUILD) {
    const turnstile = turnstileKeyProblems();
    if (turnstile.length) {
      console.error(
        `✖ Turnstile: ${turnstile.join("; ")}. Set the real keys in Vercel Production.`,
      );
      throw new Error("Turnstile keys aren't valid for production");
    }
  }
  // Creem: name anything missing for checkout or webhooks (names only, never values). Not fatal:
  // Get Pro then says "temporarily unavailable" and emails the admin (lib/billing/checkout.ts).
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL_ENV === "production") {
    const creem = creemEnvProblems(process.env);
    if (!process.env.CREEM_WEBHOOK_SECRET) creem.push("CREEM_WEBHOOK_SECRET");
    if (creem.length)
      console.warn(`⚠ Creem isn't fully set up, so Get Pro can't check out: ${creem.join(", ")}.`);
  }
  // GA4 only runs with a Measurement ID (G-XXXXXXXX); say so when the value can't be used.
  if (
    phase === PHASE_PRODUCTION_BUILD &&
    process.env.VERCEL_ENV === "production" &&
    process.env.NEXT_PUBLIC_GA_ID &&
    !gaId()
  ) {
    console.warn(
      "⚠ NEXT_PUBLIC_GA_ID isn't a GA4 Measurement ID (G-XXXXXXXX), so Google Analytics is off.",
    );
  }
  // Next loads this file in several build workers; they inherit the env, so this prints once.
  const todos =
    phase === PHASE_PRODUCTION_BUILD && !process.env.COMPANY_TODOS_SHOWN ? companyTodos() : [];
  if (todos.length) {
    process.env.COMPANY_TODOS_SHOWN = "1";
    console.warn(
      `⚠ src/lib/company.ts has ${todos.length} unfilled TODOs (pages hide them until filled):`,
    );
    for (const t of todos) console.warn(`  - ${t}`);
  }
  return nextConfig;
}
