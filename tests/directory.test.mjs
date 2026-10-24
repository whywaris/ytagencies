// Directory listing pages (src/lib/directory.ts): generated FAQ text, card buttons, summary,
// "At a glance", sorting and paragraph splitting.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  atAGlance,
  cardActions,
  defaultFaqs,
  monthYear,
  RANKING_ANSWER,
  oneLineSummary,
  shortParagraphs,
  sortAgencies,
  relatedGroup,
} from "../src/lib/directory.ts";

const service = { id: 1, slug: "youtube-ads-agencies", name: "YouTube Ads", intro: null };
const segment = {
  kind: "industry",
  industry: { id: 2, slug: "doctors", name: "Doctors", intro: null },
};
const agency = (o = {}) => ({
  id: "a",
  slug: "a",
  name: "A",
  minBudgetUsd: null,
  pricingModel: null,
  isVerified: false,
  managed: false,
  languages: [],
  ...o,
});

const text = (faqs) => faqs.map((f) => `${f.question} ${f.answer}`).join(" ");

test("FAQs with no agencies: no cost question, no zero counts", () => {
  const faqs = defaultFaqs(service, [], segment);
  assert.ok(!faqs.some((f) => f.question.startsWith("How much")));
  assert.ok(faqs.some((f) => f.question === "How are these agencies ranked?"));
  assert.doesNotMatch(text(faqs), /\b0\b|How many/);
});

test("FAQs with one agency: singular grammar", () => {
  const faqs = defaultFaqs(
    service,
    [agency({ minBudgetUsd: 2000, pricingModel: "retainer", isVerified: true })],
    segment,
  );
  const t = text(faqs);
  assert.match(t, /Minimum projects here start at \$2k\./);
  assert.match(t, /It works on a monthly retainer\./);
  assert.doesNotMatch(t, /\b0\b|1 agencies|of them/);
});

test("FAQs with many agencies: ranges, counts only when they exist", () => {
  const list = [
    agency({ id: "1", minBudgetUsd: 1000, pricingModel: "retainer", isVerified: true }),
    agency({ id: "2", minBudgetUsd: 5000, pricingModel: "per_video", isVerified: true }),
    agency({ id: "3", pricingModel: "retainer" }),
  ];
  const t = text(defaultFaqs(service, list, segment));
  assert.match(t, /range from \$1k to \$5k\./);
  assert.match(t, /2 work on a monthly retainer; the others charge/);

  const none = text(defaultFaqs(service, [agency({ id: "1" }), agency({ id: "2" })], segment));
  assert.doesNotMatch(none, /\b0\b/);
});

test("ranking answer: four groups, Pro labelled, the same text on every page", () => {
  for (const list of [
    [],
    [agency()],
    [agency({ id: "1" }), agency({ id: "2", isVerified: true })],
  ]) {
    const answer = defaultFaqs(service, list, segment).find(
      (f) => f.question === "How are these agencies ranked?",
    ).answer;
    assert.equal(answer, RANKING_ANSWER);
  }
  assert.match(RANKING_ANSWER, /^Pro agencies are shown first and always carry a Pro badge/);
  assert.match(RANKING_ANSWER, /Verified and Pro, then Pro, then Verified, then everyone else/);
  assert.match(RANKING_ANSWER, /Verified is earned and can't be bought/);
  assert.doesNotMatch(RANKING_ANSWER, /sponsor/i);
});

test("every card: Request a quote and View profile, Pro or not", () => {
  assert.deepEqual(
    cardActions({ slug: "acme" }).map((a) => [a.label, a.href, a.primary]),
    [
      ["Request a quote", "/agency/acme#contact", true],
      ["View profile", "/agency/acme", false],
    ],
  );
});

test("summary: the admin line, else the intro's first sentence, max 160 chars", () => {
  assert.equal(oneLineSummary("Set line.", "Intro one. Intro two."), "Set line.");
  assert.equal(oneLineSummary("", "Intro one. Intro two."), "Intro one.");
  assert.ok(oneLineSummary(null, `${"word ".repeat(60)}end.`).length <= 160);
});

test("At a glance hides empty rows", () => {
  assert.deepEqual(atAGlance([]), []);
  assert.deepEqual(
    atAGlance([agency({ id: "1" }), agency({ id: "2" })]).map((r) => r.label),
    ["Agencies listed"],
  );
  assert.deepEqual(
    atAGlance([
      agency({ id: "1", minBudgetUsd: 1500, pricingModel: "retainer", isVerified: true }),
      agency({ id: "2", minBudgetUsd: 4000, pricingModel: "retainer" }),
    ]),
    [
      { label: "Agencies listed", value: "2" },
      { label: "Min. project", value: "$1.5k–$4k" },
      { label: "Most common pricing", value: "Monthly retainer" },
      { label: "Verified", value: "1 of 2" },
    ],
  );
});

test("sort: recommended keeps the ranking; budget puts agencies without one last", () => {
  const list = [{ minBudgetUsd: null }, { minBudgetUsd: 5000 }, { minBudgetUsd: 1000 }];
  assert.equal(sortAgencies(list, "recommended"), list);
  assert.deepEqual(
    sortAgencies(list, "budget").map((a) => a.minBudgetUsd),
    [1000, 5000, null],
  );
});

test("short paragraphs keep every word; Updated month from the newest date", () => {
  const intro = "One. Two! Three? Four.\n\nFive six.";
  const parts = shortParagraphs(intro);
  assert.deepEqual(parts, ["One. Two!", "Three? Four.", "Five six."]);
  assert.equal(parts.join(" ").split(/\s+/).length, intro.split(/\s+/).length);
  assert.equal(monthYear(["2026-03-02T00:00:00Z", null, "2026-10-14T00:00:00Z"]), "October 2026");
  assert.equal(monthYear([]), null);
});

test("Explore more: most agencies first, 12 at most then View all, empty groups dropped", () => {
  const link = (label, count) => ({ href: `/x/${label}`, label, title: `X ${label}`, count });
  assert.equal(relatedGroup("Empty", []), null);
  const g = relatedGroup(
    "By industry",
    Array.from({ length: 14 }, (_, i) => link(`i${String(i).padStart(2, "0")}`, i % 3)),
    { href: "/agencies?service=x", label: "View all" },
  );
  assert.equal(g.links.length, 12);
  assert.deepEqual(
    g.links.slice(0, 2).map((l) => l.count),
    [2, 2],
  );
  assert.equal(g.links[0].label, "i02", "ties A–Z");
  assert.deepEqual(g.viewAll, { href: "/agencies?service=x", label: "View all" });
  const small = relatedGroup("Few", [link("a", 3)], { href: "/agencies", label: "View all" });
  assert.equal(small.viewAll, undefined, "no View all when nothing was cut");
});
