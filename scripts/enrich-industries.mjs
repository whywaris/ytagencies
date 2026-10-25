// Suggests industries for unclaimed agencies from their own websites, with the sentence that shows
// it. Suggestions wait in Admin → Directory → Industry review; nothing is tagged until an admin
// approves it. Safe to re-run: agencies checked in the last 30 days are skipped and each
// (agency, industry) pair is suggested at most once, so a crash just resumes.
//   pnpm enrich:industries [--limit 50] [--dry-run] [--agency <slug>]
// Reads .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and (optional)
// ANTHROPIC_API_KEY for the LLM step. --dry-run writes nothing.
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { crawlAgency } from "../src/lib/enrich/crawl.ts";
import { INDUSTRY_SYNONYMS, WEAK } from "../src/lib/enrich/industry-synonyms.ts";
import { matchIndustries, newSuggestions, selectCandidates } from "../src/lib/enrich/match.ts";

const { values: args } = parseArgs({
  options: {
    limit: { type: "string", default: "50" },
    "dry-run": { type: "boolean", default: false },
    agency: { type: "string" },
  },
});
const limit = Number(args.limit);
if (!Number.isInteger(limit) || limit < 1) {
  console.error("--limit must be a positive whole number.");
  process.exit(1);
}
const dryRun = args["dry-run"];
const CONCURRENCY = 4; // different hosts in parallel; each host still gets 1 request a second

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const fail = (what, error) => {
  console.error(`Couldn't read ${what}: ${error.message}`);
  process.exit(1);
};

// ───────── What to look at ─────────

const { data: industries, error: e1 } = await db.from("industries").select("id, slug, name");
if (e1) fail("industries", e1);
const industryBySlug = new Map(industries.map((i) => [i.slug, i]));
for (const i of industries)
  if (!INDUSTRY_SYNONYMS[i.slug]) console.warn(`! No synonyms for "${i.slug}" (src/lib/enrich/industry-synonyms.ts).`);
for (const slug of Object.keys(INDUSTRY_SYNONYMS))
  if (!industryBySlug.has(slug)) console.warn(`! Synonyms for "${slug}", which isn't an industry.`);
const synonyms = Object.fromEntries(Object.entries(INDUSTRY_SYNONYMS).filter(([s]) => industryBySlug.has(s)));

async function all(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

let agencies, runs;
try {
  agencies = await all(() =>
    db.from("agencies").select("id, slug, website, is_claimed, status").eq("status", "published").order("slug"),
  );
  runs = await all(() => db.from("industry_enrichment_runs").select("agency_id, checked_at"));
} catch (error) {
  fail("agencies", error);
}
const candidates = selectCandidates(agencies, new Map(runs.map((r) => [r.agency_id, r.checked_at])), new Date(), {
  slug: args.agency,
  limit,
});
if (args.agency && !candidates.length)
  console.warn(`! "${args.agency}" isn't a published, unclaimed agency with a website.`);

// Industries each candidate already has, or was already suggested (any status).
const taken = new Map(candidates.map((a) => [a.id, new Set()]));
for (let i = 0; i < candidates.length; i += 100) {
  const ids = candidates.slice(i, i + 100).map((a) => a.id);
  const [tags, sugg] = await Promise.all([
    db.from("agency_industries").select("agency_id, industry_id").in("agency_id", ids),
    db.from("industry_suggestions").select("agency_id, industry_id").in("agency_id", ids),
  ]);
  if (tags.error) fail("agency industries", tags.error);
  if (sugg.error) fail("suggestions", sugg.error);
  const slugOf = new Map(industries.map((x) => [x.id, x.slug]));
  for (const r of [...tags.data, ...sugg.data]) taken.get(r.agency_id)?.add(slugOf.get(r.industry_id));
}

// ───────── Optional LLM step ─────────

let llm = null;
if (process.env.ANTHROPIC_API_KEY) {
  const [{ default: Anthropic }, mod] = await Promise.all([import("@anthropic-ai/sdk"), import("../src/lib/enrich/llm.ts")]);
  llm = { client: new Anthropic(), ...mod };
}
const slugs = new Set(Object.keys(synonyms));

// ───────── Run ─────────

const stats = { considered: candidates.length, fetched: 0, failed: 0, blocked: 0, pages: 0, llmErrors: 0 };
const perIndustry = new Map();
const failures = [];

async function processAgency(a) {
  const crawl = await crawlAgency(a.website);
  stats.pages += crawl.pages.length;
  let found = [];
  if (crawl.outcome === "ok") {
    stats.fetched++;
    found = matchIndustries(crawl.pages, synonyms, WEAK);
    if (llm) {
      try {
        const result = await llm.classifyWithClaude(llm.client, industries, crawl.pages);
        if (result) found.push(...llm.filterLlm(result, crawl.pages, slugs));
      } catch (e) {
        stats.llmErrors++;
        console.warn(`! LLM step failed for ${a.slug}: ${e.message}`);
      }
    }
  } else {
    stats[crawl.outcome]++;
    failures.push(`${a.slug}: ${crawl.detail}`);
  }
  const fresh = newSuggestions(found, taken.get(a.id));
  for (const s of fresh) {
    perIndustry.set(s.industry, (perIndustry.get(s.industry) ?? 0) + 1);
    console.log(`  ${a.slug} → ${s.industry} (${s.confidence.toFixed(2)}, ${s.method}) “${s.evidence}” ${s.sourceUrl}`);
  }
  if (dryRun) return;
  if (fresh.length) {
    const { error } = await db.from("industry_suggestions").upsert(
      fresh.map((s) => ({
        agency_id: a.id,
        industry_id: industryBySlug.get(s.industry).id,
        evidence_text: s.evidence,
        source_url: s.sourceUrl,
        method: s.method,
        confidence: s.confidence,
      })),
      { onConflict: "agency_id,industry_id", ignoreDuplicates: true },
    );
    if (error) {
      console.error(`✖ ${a.slug}: couldn't save suggestions: ${error.message}`);
      return; // not marked as checked, so the next run tries again
    }
  }
  const { error } = await db.from("industry_enrichment_runs").upsert({
    agency_id: a.id,
    checked_at: new Date().toISOString(),
    outcome: crawl.outcome,
    pages: crawl.pages.length,
    detail: crawl.outcome === "ok" ? null : crawl.detail.slice(0, 300),
  });
  if (error) console.error(`✖ ${a.slug}: couldn't record the run: ${error.message}`);
}

console.log(
  `${dryRun ? "[dry run] " : ""}Checking ${candidates.length} agenc${candidates.length === 1 ? "y" : "ies"}` +
    `${llm ? ` (keywords + ${llm.LLM_MODEL})` : " (keywords only; set ANTHROPIC_API_KEY for the LLM step)"}…`,
);
const queue = [...candidates];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let a; (a = queue.shift()); ) await processAgency(a);
  }),
);

// ───────── Summary ─────────

const total = [...perIndustry.values()].reduce((n, v) => n + v, 0);
console.log(`\n${dryRun ? "[dry run] nothing written. " : ""}Summary`);
console.log(`  agencies: ${stats.considered} · fetched: ${stats.fetched} · failed: ${stats.failed} · blocked: ${stats.blocked} · pages read: ${stats.pages}`);
if (llm) console.log(`  LLM errors: ${stats.llmErrors}`);
console.log(`  suggestions: ${total}`);
for (const [slug, n] of [...perIndustry].sort((x, y) => y[1] - x[1])) console.log(`    ${slug.padEnd(14)} ${n}`);
if (failures.length) {
  console.log("  not fetched:");
  for (const f of failures) console.log(`    ${f}`);
}
