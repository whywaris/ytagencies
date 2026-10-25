import { IndustryReview, type ReviewGroup } from "@/components/admin/industry-review";
import { Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { INDUSTRY_SYNONYMS } from "@/lib/enrich/industry-synonyms";
import { compileSynonyms, crossedThreshold, highlightParts } from "@/lib/enrich/match";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin → Directory → Industry review: industries suggested from agencies' own websites
// (scripts/enrich-industries.mjs), each with the sentence that shows it. Nothing is tagged until
// approved here. Below the queue: approvals per industry, and the service × industry pages that
// reached the 3-agency rule through approvals in the last 7 days.

export const metadata = { title: "Industry review" };

const PATTERNS = compileSynonyms(INDUSTRY_SYNONYMS);
const WEEK_MS = 7 * 24 * 3600 * 1000;
const weekAgo = () => new Date(Date.now() - WEEK_MS).toISOString();

export default async function IndustryReviewPage() {
  await requireAdmin("/admin/industry-review");
  const db = createAdminClient();
  const since = weekAgo();
  const [pending, approved, combos] = await Promise.all([
    db
      .from("industry_suggestions")
      .select("id, agency_id, evidence_text, source_url, method, confidence, created_at, agencies(name, slug, website), industries(slug, name)")
      .eq("status", "pending")
      .order("agency_id")
      .order("confidence", { ascending: false })
      .limit(500),
    db
      .from("industry_suggestions")
      .select("agency_id, reviewed_at, industries(slug, name)")
      .eq("status", "approved"),
    db.from("combo_counts").select("service_slug, industry_slug, agency_count"),
  ]);
  if (pending.error || approved.error || combos.error) throw new Error("Couldn't load industry suggestions");

  const groups = new Map<string, ReviewGroup>();
  for (const s of pending.data) {
    const g = groups.get(s.agency_id) ?? {
      agencyId: s.agency_id,
      name: s.agencies?.name ?? "Deleted agency",
      slug: s.agencies?.slug ?? null,
      rows: [],
    };
    g.rows.push({
      id: s.id,
      industry: s.industries?.name ?? "Unknown industry",
      parts: highlightParts(s.evidence_text, PATTERNS.get(s.industries?.slug ?? "")),
      sourceUrl: s.source_url,
      method: s.method,
      confidence: Number(s.confidence),
    });
    groups.set(s.agency_id, g);
  }

  // Report: approvals per industry, and combos that crossed the index rule this week.
  const perIndustry = new Map<string, { name: string; total: number; week: number }>();
  for (const a of approved.data) {
    const key = a.industries?.slug ?? "?";
    const row = perIndustry.get(key) ?? { name: a.industries?.name ?? key, total: 0, week: 0 };
    row.total++;
    if (a.reviewed_at && a.reviewed_at >= since) row.week++;
    perIndustry.set(key, row);
  }
  const recent = approved.data
    .filter((a) => a.reviewed_at && a.reviewed_at >= since && a.industries)
    .map((a) => ({ agencyId: a.agency_id, industry: a.industries!.slug }));
  const servicesOf = new Map<string, string[]>();
  if (recent.length) {
    const ids = [...new Set(recent.map((r) => r.agencyId))];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await db
        .from("agency_services")
        .select("agency_id, services(slug), agencies!inner(status)")
        .in("agency_id", ids.slice(i, i + 100))
        .eq("agencies.status", "published");
      if (error) throw new Error("Couldn't load agency services");
      for (const r of data)
        if (r.services) servicesOf.set(r.agency_id, [...(servicesOf.get(r.agency_id) ?? []), r.services.slug]);
    }
  }
  const counts = new Map(
    combos.data.map((c) => [`${c.service_slug}|${c.industry_slug}`, Number(c.agency_count)]),
  );
  const crossed = crossedThreshold(counts, recent, servicesOf, MIN_AGENCIES_TO_INDEX);
  const pendingCount = pending.data.length;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex max-w-reading flex-col gap-1">
        <h1 className="text-admin-title">Industry review</h1>
        <p className="text-text-2">
          Industries suggested from each agency&apos;s own website, with the sentence that shows it.
          Nothing is added until you approve it. Keys: J / K to move, A to approve, R to reject.
        </p>
      </div>

      <section aria-labelledby="queue" className="flex flex-col gap-4">
        <h2 id="queue" className="text-admin-section">
          Queue <span className="text-text-2">({pendingCount}{pendingCount === 500 ? "+" : ""})</span>
        </h2>
        <IndustryReview groups={[...groups.values()]} />
      </section>

      <section aria-labelledby="report" className="flex flex-col gap-4">
        <h2 id="report" className="text-admin-section">
          Report
        </h2>
        {perIndustry.size ? (
          <Table>
            <thead>
              <tr>
                <th scope="col">Industry</th>
                <th scope="col">Approved</th>
                <th scope="col">Last 7 days</th>
              </tr>
            </thead>
            <tbody>
              {[...perIndustry.values()]
                .sort((a, b) => b.total - a.total)
                .map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="num">{r.total}</td>
                    <td className="num">{r.week}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-text-2">No approvals yet.</p>
        )}
        <h3 className="font-medium">Pages that reached {MIN_AGENCIES_TO_INDEX} agencies this week</h3>
        {crossed.length ? (
          <ul className="flex flex-col gap-1">
            {crossed.map((c) => (
              <li key={`${c.service}|${c.industry}`}>
                <a
                  href={`/${c.service}/for-${c.industry}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  /{c.service}/for-{c.industry}
                </a>{" "}
                <span className="text-text-2">· {c.count} agencies</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-2">None yet.</p>
        )}
      </section>
    </div>
  );
}
