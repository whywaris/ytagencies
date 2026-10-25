// Industry enrichment (src/lib/enrich/*, scripts/enrich-industries.mjs): the fetcher stays on the
// agency's own public site and respects robots.txt, LLM quotes must be literal, claimed agencies
// are never touched, and approving writes the tag and refreshes the pages. Offline: DNS and fetch
// are stubbed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { crawlAgency, homeUrl } from "../src/lib/enrich/crawl.ts";
import { Blocked, createFetcher, isPrivateIp, pickInnerPages, registrableDomain, robotsAllows, USER_AGENT } from "../src/lib/enrich/fetch.ts";
import { INDUSTRY_SYNONYMS, WEAK } from "../src/lib/enrich/industry-synonyms.ts";
import { filterLlm } from "../src/lib/enrich/llm.ts";
import {
  compileSynonyms,
  crossedThreshold,
  highlightParts,
  matchIndustries,
  newSuggestions,
  quoteIsLiteral,
  selectCandidates,
} from "../src/lib/enrich/match.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const html = (body) => new Response(`<html><body>${body}</body></html>`, { headers: { "content-type": "text/html" } });
const notFound = () => new Response("no", { status: 404 });
const redirect = (to) => new Response(null, { status: 301, headers: { location: to } });

/** A fake web: { "https://acme.com/": () => Response }, DNS answers per host. */
function web(routes, dns = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      sleep: async () => {},
      resolve: async (host) => dns[host] ?? ["93.184.216.34"],
      fetch: async (url, init) => {
        calls.push({ url, ua: init.headers["user-agent"], redirect: init.redirect });
        return (routes[url] ?? notFound)();
      },
    },
  };
}

test("addresses: private, loopback, link-local and mapped addresses are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "not-an-ip"])
    assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
  assert.equal(registrableDomain("blog.acme.co.uk"), "acme.co.uk");
  assert.equal(registrableDomain("www.acme.com"), "acme.com");
});

test("SSRF: a host that resolves to a private address is blocked before any request", async () => {
  const w = web({}, { "acme.com": ["10.0.0.5"] });
  const res = await crawlAgency("https://acme.com", w.deps);
  assert.equal(res.outcome, "blocked");
  assert.match(res.detail, /private address/);
  assert.equal(w.calls.length, 0);
});

test("SSRF: a redirect to a private address is blocked", async () => {
  const w = web(
    {
      "https://acme.com/robots.txt": notFound,
      "https://acme.com/": () => redirect("https://internal.acme.com/admin"),
    },
    { "internal.acme.com": ["127.0.0.1"] },
  );
  const res = await crawlAgency("acme.com", w.deps);
  assert.equal(res.outcome, "blocked");
  assert.match(res.detail, /private address for internal\.acme\.com/);
  assert.ok(!w.calls.some((c) => c.url.includes("internal")), "never fetched");
  assert.ok(w.calls.every((c) => c.redirect === "manual" && c.ua === USER_AGENT));
});

test("SSRF: other domains are refused, by redirect or by link", async () => {
  const w = web({ "https://acme.com/robots.txt": notFound, "https://acme.com/": () => redirect("https://evil.example/") });
  const res = await crawlAgency("https://acme.com", w.deps);
  assert.equal(res.outcome, "blocked");
  assert.match(res.detail, /other domain evil\.example/);
  const f = createFetcher("https://acme.com/", web({}).deps);
  await assert.rejects(f.get("https://acme.com.evil.example/"), Blocked);
  await assert.rejects(f.get("file:///etc/passwd"), Blocked);
  // Inner pages: same site only, and only about/work/clients/industries.
  const picked = pickInnerPages(
    [
      { url: "https://acme.com/about-us", text: "About" },
      { url: "https://evil.example/clients", text: "Clients" },
      { url: "https://acme.com/blog/post", text: "Our work with clinics" },
      { url: "https://acme.com/pricing", text: "Pricing" },
      { url: "https://acme.com/case-studies", text: "Results" },
      { url: "https://acme.com/industries", text: "Industries" },
    ],
    "https://acme.com/",
  );
  assert.deepEqual(picked, ["https://acme.com/about-us", "https://acme.com/blog/post", "https://acme.com/case-studies"]);
});

test("robots.txt is respected", async () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /", "/"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private", "/about"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nAllow: /about", "/about"), true);
  assert.equal(robotsAllows("User-agent: YTAgenciesBot\nDisallow: /\n\nUser-agent: *\nAllow: /", "/"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*.php$", "/a.php"), false);

  const w = web({
    "https://acme.com/robots.txt": () => new Response("User-agent: *\nDisallow: /about", { status: 200 }),
    "https://acme.com/": () => html('<p>We help dental clinics grow.</p><a href="/about">About us</a><a href="/clients">Clients</a>'),
    "https://acme.com/clients": () => html("<p>Clients include three SaaS companies.</p>"),
  });
  const res = await crawlAgency("https://acme.com", w.deps);
  assert.equal(res.outcome, "ok");
  assert.deepEqual(res.pages.map((p) => p.url), ["https://acme.com/", "https://acme.com/clients"]);
  assert.ok(!w.calls.some((c) => c.url === "https://acme.com/about"), "the disallowed page is never fetched");
  // A homepage robots.txt disallows: nothing is fetched at all.
  const closed = web({ "https://acme.com/robots.txt": () => new Response("User-agent: *\nDisallow: /") });
  assert.equal((await crawlAgency("https://acme.com", closed.deps)).outcome, "blocked");
  assert.equal(closed.calls.length, 1);
  assert.equal(homeUrl("javascript:alert(1)"), null);
});

test("matching: the exact sentence as evidence, whole words only", () => {
  const pages = [
    { url: "https://acme.com/", text: "We grow YouTube channels.\nHappy to apply our playbook. We work with dental clinics and orthodontists across Texas." },
    { url: "https://acme.com/clients", text: "Clients include B2B software companies and SaaS startups." },
  ];
  const found = matchIndustries(pages, INDUSTRY_SYNONYMS, WEAK);
  const by = Object.fromEntries(found.map((f) => [f.industry, f]));
  assert.equal(by.dentists.evidence, "We work with dental clinics and orthodontists across Texas.");
  assert.equal(by.dentists.sourceUrl, "https://acme.com/");
  assert.ok(pages[0].text.includes(by.dentists.evidence));
  assert.equal(by.saas.confidence, 0.75, "two phrases (0.65) on a clients page (+0.1)");
  assert.equal(by.dentists.confidence, 0.65, "two phrases on the homepage");
  assert.ok(!by.saas.evidence.includes("apply"), "\"app\" doesn't match inside \"apply\"");
  assert.ok(found.every((f) => f.evidence.length <= 300 && f.confidence <= 0.95));
  const parts = highlightParts(by.dentists.evidence, compileSynonyms(INDUSTRY_SYNONYMS).get("dentists"));
  assert.deepEqual(parts.filter((p) => p.hit).map((p) => p.text), ["dental", "orthodontists"]);
});

test("LLM: a quote that isn't literally on the page is dropped", () => {
  const pages = [{ url: "https://acme.com/about", text: "We produce videos for law firms and   personal injury attorneys." }];
  assert.equal(quoteIsLiteral("We produce videos for law firms and personal injury attorneys.", pages[0].text), true);
  assert.equal(quoteIsLiteral("We produce videos for top law firms.", pages[0].text), false);
  const kept = filterLlm(
    {
      industries: [
        { slug: "law-firms", quote: "We produce videos for law firms and personal injury attorneys." },
        { slug: "saas", quote: "We are the leading SaaS video agency." }, // invented
        { slug: "made-up", quote: "We produce videos for law firms and personal injury attorneys." }, // not ours
      ],
    },
    pages,
    new Set(Object.keys(INDUSTRY_SYNONYMS)),
  );
  assert.deepEqual(kept.map((k) => [k.industry, k.sourceUrl, k.method]), [["law-firms", "https://acme.com/about", "llm"]]);
});

test("claimed agencies, recent checks and existing tags are skipped", () => {
  const now = new Date("2026-10-25T00:00:00Z");
  const a = (slug, extra = {}) => ({ id: slug, slug, website: `https://${slug}.com`, is_claimed: false, status: "published", ...extra });
  const list = [a("open"), a("claimed", { is_claimed: true }), a("draft", { status: "draft" }), a("nosite", { website: null }), a("recent"), a("old")];
  const checked = new Map([["recent", "2026-10-20T00:00:00Z"], ["old", "2026-09-01T00:00:00Z"]]);
  assert.deepEqual(selectCandidates(list, checked, now).map((x) => x.slug), ["open", "old"]);
  assert.deepEqual(selectCandidates(list, checked, now, { slug: "claimed" }), []);
  assert.deepEqual(selectCandidates(list, checked, now, { slug: "recent" }).map((x) => x.slug), ["recent"]);
  assert.deepEqual(selectCandidates(list, checked, now, { limit: 1 }).map((x) => x.slug), ["open"]);
  const s = (industry, confidence, method = "keywords") => ({ industry, confidence, method, evidence: "x", sourceUrl: "https://x" });
  assert.deepEqual(newSuggestions([s("saas", 0.5), s("saas", 0.7, "llm"), s("crypto", 0.9)], new Set(["crypto"])), [s("saas", 0.7, "llm")]);
  // The script uses the same rules, and never writes on a dry run.
  const script = read("scripts/enrich-industries.mjs");
  assert.match(script, /selectCandidates\(agencies,/);
  assert.match(script, /if \(dryRun\) return;/);
  assert.match(script, /ignoreDuplicates: true/);
});

test("approval writes the tag (not primary) and refreshes the pages; claimed agencies are refused", () => {
  const src = read("src/lib/actions/admin-industry-review.ts");
  assert.match(src, /const ctx = await adminContext\(\);\n {2}if \(!ctx\) return \{ ok: false, error: NOT_ADMIN \};/);
  assert.match(src, /from\("agency_industries"\)\.upsert\(\n\s+open\.map\(\(r\) => \(\{ agency_id: r\.agency_id, industry_id: r\.industry_id, is_primary: false \}\)\)/);
  assert.match(src, /decision === "approved" \? rows\.filter\(\(r\) => !r\.agencies\?\.is_claimed\) : rows/);
  assert.match(src, /revalidateAgency\(slug\);/);
  // revalidateAgency covers the profile, the industry hub, service × industry pages and the sitemaps.
  const reval = read("src/lib/revalidate.ts");
  for (const p of ["/agency/${slug}", "/(marketing)/[service]/[segment]", "/(marketing)/industries/[industry]", "revalidateSitemap();"])
    assert.ok(reval.includes(p), p);
});

test("report: combos that crossed the 3-agency rule through this week's approvals", () => {
  const counts = new Map([["youtube-ads-agencies|saas", 3], ["youtube-seo-agencies|saas", 5], ["youtube-ads-agencies|crypto", 2]]);
  const crossed = crossedThreshold(
    counts,
    [{ agencyId: "a1", industry: "saas" }, { agencyId: "a2", industry: "crypto" }],
    new Map([["a1", ["youtube-ads-agencies", "youtube-seo-agencies"]], ["a2", ["youtube-ads-agencies"]]]),
    3,
  );
  assert.deepEqual(crossed, [{ service: "youtube-ads-agencies", industry: "saas", count: 3 }]);
});
