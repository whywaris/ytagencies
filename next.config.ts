import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Lock CSP to this environment's Supabase project; wildcard only when the env var is missing (e.g. CI build).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const supabaseHost = supabaseUrl?.host ?? "*.supabase.co";

// Vercel Analytics is same-origin (/_vercel/insights) in production; va.vercel-scripts.com is its dev-only debug script.
// ponytail: static CSP with 'unsafe-inline' scripts, because a nonce CSP forces every page dynamic and breaks ISR.
// Upgrade to hashes/SRI if Next supports them for static pages.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost}`,
  "font-src 'self'",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}${isDev ? " https://va.vercel-scripts.com" : ""}`,
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

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
    // Logo uploads go through a server action: 2 MB file + multipart overhead (default is 1 MB).
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    // Agency logos from Supabase Storage (public bucket).
    // Local Supabase (CLI or a dev mock) runs on 127.0.0.1; Next 16 refuses local IPs unless allowed.
    dangerouslyAllowLocalIP: isDev,
    remotePatterns: [
      {
        protocol: supabaseUrl?.protocol === "http:" ? "http" : "https",
        hostname: supabaseUrl?.hostname ?? "*.supabase.co",
        port: supabaseUrl?.port ?? "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// MDX is only imported by /guides/[slug] (trusted files in src/content), never routed directly.
const withMDX = createMDX();

export default withMDX(nextConfig);
