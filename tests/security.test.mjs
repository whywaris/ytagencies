// Security pass: lead contact details only reach Pro owners and admins, summaries carry no contact
// data, every action and route checks who's asking, webhooks reject bad signatures and test-mode
// events in live mode, stored guide HTML is allowlisted, fetches go to fixed hosts, headers hold.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ignoreEvent, parseEvent, verifySignature } from "../src/lib/billing/lemonsqueezy-events.ts";
import { cleanPastedHtml, docToHtml, sanitizeDoc } from "../src/lib/guide-content.ts";
import { hasContactData, redactSummary, toPreview } from "../src/lib/lead-preview.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p.replace(/\\/g, "/")] : [];
  });
const SRC = files("src");

test("summary: no email, phone, URL or @handle survives, however it's written", () => {
  const tricky = [
    "Mail me: john [at] gmail [dot] com please",
    "john (at) gmail.com",
    "reach john at gmail dot com",
    "JOHN@GMAIL.COM",
    "Call 5 5 5 1 2 3 4 5 6 7",
    "call +44 20 7946 0958 or 020-7946-0958",
    "(555) 010-2030",
    "WhatsApp wa.me/15551234567",
    "tg t.me/johnny",
    "IG instagram.com/johnny_x",
    "see acme.agency/work and shop.example.store",
    "ftp://files.acme.io/x",
    "http://1.2.3.4/admin",
    "hxxps://evil.example/path",
    "www.acme.com",
    "handle @john_doe and@x",
    "linkedin.com/in/john-smith",
    "youtube.com/@skynet",
    "id 1234567890123",
  ];
  for (const t of tricky) {
    const out = redactSummary(t);
    assert.equal(hasContactData(out), false, `${t} → ${out}`);
    assert.doesNotMatch(out, /@|:\/\/|www\.|\.(com|me|io|agency|store)\b|\d{5,}/i, `${t} → ${out}`);
  }
  // The project itself survives.
  const plain = "We want YouTube ads for 3 dental clinics in Texas, budget $3,000/month, start in 2 weeks.";
  assert.equal(redactSummary(plain), plain);
  // Old rows are re-redacted when read.
  assert.equal(toPreview({ summary: "email me at a@b.co" }).summary.includes("@"), false);
});

test("lead contact details: only these files read the leads row", () => {
  // Anything new that reads leads must be reviewed and added here on purpose.
  const allowed = new Set([
    "src/app/admin/agencies/[id]/page.tsx",
    "src/app/admin/layout.tsx",
    "src/app/admin/leads/export/route.ts",
    "src/app/admin/leads/page.tsx",
    "src/app/dashboard/[slug]/inquiries/page.tsx",
    "src/components/dashboard/overview.tsx",
    "src/lib/actions/admin-reviews.ts",
    "src/lib/actions/admin.ts",
    "src/lib/data/admin-dashboard.ts",
    "src/lib/data/admin-seo.ts",
    "src/lib/data/agency-stats.ts",
    "src/lib/lead-fallback.tsx",
    "src/lib/lead-reminders.tsx",
    "src/lib/leads.tsx",
    "src/lib/retention.ts",
  ]);
  const readers = SRC.filter((f) => /from\("leads"\)|[,"(\s]leads\(|leads!inner/.test(read(f)));
  assert.deepEqual(readers.filter((f) => !allowed.has(f)), []);
  // Admin pages, routes and actions are admin-gated; the admin data helpers are only used by them.
  for (const f of readers.filter((f) => f.startsWith("src/app/admin/") || f.startsWith("src/lib/actions/admin")))
    assert.match(read(f), /adminContext\(|requireAdmin\(/, f);
  for (const helper of ["admin-dashboard", "admin-seo"]) {
    const users = SRC.filter((f) => read(f).includes(`@/lib/data/${helper}"`));
    assert.ok(users.length > 0 && users.every((f) => f.startsWith("src/app/admin/")), helper);
  }
});

test("lead contact details: the dashboard checks the plan before reading them", () => {
  const inquiries = read("src/app/dashboard/[slug]/inquiries/page.tsx");
  assert.ok(
    inquiries.indexOf("if (!ctx.e.leadDetails) return <Previews ctx={ctx} />;") <
      inquiries.indexOf("leads(id, name, email"),
  );
  const overview = read("src/components/dashboard/overview.tsx");
  assert.ok(overview.indexOf("if (!e.managed) {") < overview.indexOf("leads(id, name, company"));
  // Reminders (which name the business) go only to Pro owners.
  assert.match(read("src/lib/lead-reminders.tsx"), /!placement\.entitlements\(r\.agency_id\)\.managed\) continue;/);
  // Free owners' emails: the preview has no lead fields, outreach has no request at all.
  assert.doesNotMatch(read("src/emails/agency-lead-preview.tsx"), /lead\.(name|email|company|message)|replyTo/);
  const outreach = read("src/emails/agency-outreach.tsx");
  // Its only inputs: the agency's name and two links.
  assert.match(outreach, /\}: \{\n  agencyName: string;\n  claimUrl: string;\n  unsubscribeUrl: string;\n\}\)/);
  // The CSV export is admin-only, before any query.
  const exp = read("src/app/admin/leads/export/route.ts");
  assert.ok(exp.indexOf("if (!ctx) return new Response") < exp.indexOf('.from("leads")'));
  // No client component touches lead data or the service role.
  for (const f of SRC.filter((f) => read(f).startsWith('"use client"')))
    assert.doesNotMatch(read(f), /from\("leads"\)|lib\/supabase\/admin|lead_previews/, f);
});

test("every server action checks who's asking", () => {
  const guard =
    /adminContext\(|getOwnedAgency\(|editableAgency\(|proAgency\(|owned\(|getUser\(|guard\(|underRateLimit\(|honeypotFilled\(/;
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

test("every admin and dashboard page checks the admin role or ownership on the server", () => {
  for (const f of SRC.filter((f) => /^src\/app\/(admin|dashboard)\/.*(page|route|layout)\.tsx?$/.test(f))) {
    if (f.endsWith("[...rest]/page.tsx")) continue; // a 404 inside the owner-checked layout
    assert.match(read(f), /requireAdmin\(|adminContext\(|dashboardContext\(|getOwnedAgency|requireUser\(/, f);
  }
  // Slug routes: the slug only finds the row, owner_id must match the signed-in user.
  assert.match(read("src/lib/auth.ts"), /\.eq\(column, value\)\s*\.eq\("owner_id", user\.id\)/);
  // Work samples: every write is scoped to the owner's agency.
  const ws = read("src/lib/actions/work-samples.ts");
  assert.match(ws, /\.delete\(\)\s*\.eq\("id", id\)\s*\.eq\("agency_id", owned\.agency\.id\)/);
});

test("Lemon Squeezy webhook: signature required, test mode ignored in live mode", () => {
  const body = JSON.stringify({
    meta: { event_name: "subscription_created", test_mode: true, custom_data: {} },
    data: { type: "subscriptions", id: "1", attributes: { updated_at: "2026-10-01T00:00:00Z" } },
  });
  assert.equal(verifySignature(body, null, "secret"), false);
  assert.equal(verifySignature(body, "", "secret"), false);
  assert.equal(verifySignature(body, "00".repeat(32), "secret"), false);
  assert.equal(verifySignature(body, "abc", ""), false);
  const event = parseEvent(body, null);
  assert.equal(event.testMode, true);
  assert.equal(ignoreEvent(event, false), true);
  assert.equal(ignoreEvent(event, true), false);
  assert.equal(ignoreEvent({ testMode: false }, false), false);
  const route = read("src/app/api/webhooks/lemonsqueezy/route.ts");
  assert.match(route, /handleWebhook\(await request\.text\(\), request\.headers\)/); // raw body
  const handler = read("src/lib/billing/lemonsqueezy.ts");
  assert.ok(handler.indexOf("verifySignature(") < handler.indexOf("ignoreEvent(")); // signature first
  assert.match(handler, /if \(seen\.data\?\.processed_at\) return/); // idempotent
});

test("guide HTML: allowlisted, no scripts, handlers, javascript: links or iframes", () => {
  const doc = sanitizeDoc(
    {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
        { type: "paragraph", content: [{ type: "text", text: "y", marks: [{ type: "link", attrs: { href: " JaVaScRiPt:alert(1)" } }] }] },
        { type: "iframe", attrs: { src: "https://evil.example" } },
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        { type: "paragraph", attrs: { onclick: "alert(1)" }, content: [{ type: "text", text: "z" }] },
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
    "src/lib/actions/work-samples.ts": /oembedUrl\(video\.id\)/,
    "src/lib/youtube.ts": /www\.googleapis\.com\/youtube/,
    "src/lib/billing/lemonsqueezy.ts": /\$\{API\}\$\{path\}/,
    "src/lib/auth-providers.ts": /\/auth\/v1\/settings/,
    "src/lib/public-slugs.ts": /NEXT_PUBLIC_SUPABASE_URL/,
    "src/lib/actions/admin-guides.ts": /isPublicIp\(a\.address\)/,
    "src/components/admin/rich-editor.tsx": /fetch\(src\)/, // a blob: URL in the browser
    // The industry enrichment script: the agency's own site only, private addresses refused.
    "src/lib/enrich/fetch.ts": /ips\.some\(isPrivateIp\)/,
  };
  const callers = SRC.filter((f) => /\bfetch\(/.test(read(f)) && !f.includes("/app/"));
  for (const f of callers) {
    assert.ok(f in allowed, `unexpected fetch in ${f}`);
    assert.match(read(f), allowed[f], f);
  }
  assert.match(read("src/lib/work-samples.ts"), /`https:\/\/www\.youtube\.com\/oembed\?/);
  for (const f of ["src/lib/actions/work-samples.ts", "src/lib/youtube.ts"])
    assert.match(read(f), /AbortSignal\.timeout\(/, f);
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
    /YT_PLAYER/, // work samples
  ])
    assert.match(c, h);
});

test("no server secret in client components", () => {
  for (const f of SRC.filter((f) => read(f).startsWith('"use client"'))) {
    for (const m of read(f).matchAll(/process\.env\.([A-Z0-9_]+)/g))
      assert.ok(/^NEXT_PUBLIC_|^NODE_ENV$/.test(m[1]), `${f} reads ${m[1]}`);
  }
});
