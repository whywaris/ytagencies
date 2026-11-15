// Security pass: every action and admin route checks who's asking, stored guide HTML is
// allowlisted, fetches go to fixed hosts, headers hold, and the old directory's paths are gone.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { cleanPastedHtml, docToHtml, sanitizeDoc } from "../src/lib/guide-content.ts";
import { isRemovedHref, isRemovedPath } from "../src/lib/removed-paths.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.(ts|tsx)$/.test(n)
        ? [p.replace(/\\/g, "/")]
        : [];
  });
const SRC = files("src");

test("every server action checks who's asking", () => {
  const guard = /adminContext\(|getUser\(|guard\(|underRateLimit\(|honeypotFilled\(/;
  const open = new Set(["auth.ts:signOut"]); // signing yourself out needs no check
  for (const f of SRC.filter((f) => f.startsWith("src/lib/actions/"))) {
    const s = read(f);
    for (const m of s.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)) {
      const name = `${f.split("/").pop()}:${m[1]}`;
      if (open.has(name)) continue;
      assert.match(m[2], guard, name);
      // Admin actions use the admin check, never just "signed in".
      if (f.includes("/admin")) assert.match(m[2], /adminContext\(/, name);
    }
  }
});

test("every admin page checks the admin role on the server", () => {
  for (const f of SRC.filter((f) => /^src\/app\/admin\/.*(page|route|layout)\.tsx?$/.test(f)))
    assert.match(read(f), /requireAdmin\(|adminContext\(|redirect\("\/admin\/guides"\)/, f);
  // Signed in but not an admin: a 404, never a page that says admin exists.
  assert.match(read("src/lib/auth.ts"), /if \(!admin\) notFound\(\);/);
});

test("the old directory's pages answer 410, and guides never link to them", () => {
  for (const p of [
    "/agency/acme",
    "/agencies",
    "/youtube-ads-agencies",
    "/youtube-ads-agencies/for-dentists/in-usa",
    "/industries/saas",
    "/locations/united-states/new-york",
    "/claim/acme",
    "/dashboard",
    "/dashboard/acme/billing",
    "/pricing",
    "/request-proposals",
    "/get-matched",
    "/list-your-agency/new",
    "/og/agency/acme",
    "/badge.svg",
  ])
    assert.equal(isRemovedPath(p), true, p);
  for (const p of [
    "/",
    "/guides",
    "/guides/youtube-agency",
    "/guides/talent-agencies-for-new-youtubers",
    "/authors/whywaris",
    "/about",
    "/contact",
    "/admin/guides",
    "/og/guide/youtube-seo",
    "/sitemap.xml",
  ])
    assert.equal(isRemovedPath(p), false, p);
  assert.equal(isRemovedHref("https://ytagencies.com/agency/acme", "ytagencies.com"), true);
  assert.equal(
    isRemovedHref("https://www.ytagencies.com/youtube-seo-agencies?x=1", "ytagencies.com"),
    true,
  );
  assert.equal(isRemovedHref("/agencies#top", "ytagencies.com"), true);
  assert.equal(isRemovedHref("https://example.com/agencies", "ytagencies.com"), false);
  assert.equal(isRemovedHref("#faq", "ytagencies.com"), false);
  const proxy = read("src/proxy.ts");
  assert.match(
    proxy,
    /if \(isRemovedPath\(path\)\) \{\n\s+return new NextResponse\(removedPage\(request\.nextUrl\.origin\), \{\n\s+status: 410,/,
  );
  // The guide renderer turns links to removed pages into plain text, and hides buttons to them.
  assert.match(
    read("src/components/guide-body.tsx"),
    /if \(isRemovedHref\(href, SITE_HOST\)\) return <>\{children\}<\/>;/,
  );
  assert.match(
    read("src/components/guide-blocks.tsx"),
    /const live = \(v: unknown\) => \(isRemovedHref\(s\(v\), SITE_HOST\) \? "" : s\(v\)\);/,
  );
});

test("guide HTML: allowlisted, no scripts, handlers, javascript: links or iframes", () => {
  const doc = sanitizeDoc(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "y",
              marks: [{ type: "link", attrs: { href: " JaVaScRiPt:alert(1)" } }],
            },
          ],
        },
        { type: "iframe", attrs: { src: "https://evil.example" } },
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        {
          type: "paragraph",
          attrs: { onclick: "alert(1)" },
          content: [{ type: "text", text: "z" }],
        },
      ],
    },
    () => false,
  );
  const html = docToHtml(doc, () => false);
  assert.doesNotMatch(html, /javascript:|<iframe|<script|onclick/i);
  const pasted = cleanPastedHtml(
    '<p onclick="x()">a<script>alert(1)</script><iframe src="https://x"></iframe><a href="javascript:y()">b</a><img src=x onerror=z()></p>',
  );
  assert.doesNotMatch(pasted, /<script|<iframe|onclick|onerror|javascript:/i);
});

test("outbound fetches: fixed hosts only (and the admin image import's own checks)", () => {
  const allowed = {
    "src/lib/auth-providers.ts": /\/auth\/v1\/settings/,
    "src/lib/public-slugs.ts": /NEXT_PUBLIC_SUPABASE_URL/,
    "src/lib/actions/admin-guides.ts": /isPublicIp\(a\.address\)/,
    "src/components/admin/rich-editor.tsx": /fetch\(src\)/, // a blob: URL in the browser
  };
  const callers = SRC.filter((f) => /\bfetch\(/.test(read(f)) && !f.includes("/app/"));
  for (const f of callers) {
    assert.ok(f in allowed, `unexpected fetch in ${f}`);
    assert.match(read(f), allowed[f], f);
  }
});

test("headers: CSP, HSTS, framing, referrer and permissions", () => {
  const c = read("next.config.ts");
  for (const h of [
    /"default-src 'self'"/,
    /"frame-ancestors 'none'"/,
    /"object-src 'none'"/,
    /"base-uri 'self'"/,
    /key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload"/,
    /key: "Referrer-Policy", value: "strict-origin-when-cross-origin"/,
    /key: "X-Frame-Options", value: "DENY"/,
    /key: "Permissions-Policy"/,
    /googletagmanager\.com/, // GA (after consent)
    /YT_PLAYER/, // videos in guides
  ])
    assert.match(c, h);
});

test("no server secret in client components", () => {
  for (const f of SRC.filter((f) => read(f).startsWith('"use client"'))) {
    for (const m of read(f).matchAll(/process\.env\.([A-Z0-9_]+)/g))
      assert.ok(/^NEXT_PUBLIC_|^NODE_ENV$/.test(m[1]), `${f} reads ${m[1]}`);
  }
});
