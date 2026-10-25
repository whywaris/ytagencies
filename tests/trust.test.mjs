// "Trust & proof" on agency profiles (src/lib/trust.ts): checked vs not, claimed vs not, reply
// time only from 3 requests, channel groups, case-study labels, empty sections, no price twice.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  caseStudyLabel,
  channelChip,
  channelGroups,
  replyTimeLabel,
  termsCells,
  trustRows,
} from "../src/lib/trust.ts";

const page = readFileSync("src/app/(marketing)/agency/[slug]/page.tsx", "utf8").replace(/\r\n/g, "\n");
const ch = (id, confirmedAt = null, channelId = null) => ({ id, confirmedAt, channelId });
const base = {
  isVerified: false,
  verification: null,
  isClaimed: false,
  claimedAt: null,
  channels: [],
  reply: null,
};
const row = (rows, key) => rows.find((r) => r.key === key);

test("verified: domain and email rows with their dates", () => {
  const rows = trustRows({
    ...base,
    isVerified: true,
    verification: {
      verifiedDomain: "acme.com",
      reviewedAt: "2026-10-02T10:00:00Z",
      verifiedEmailAt: "2026-10-01T09:00:00Z",
    },
  });
  assert.deepEqual(
    { ...row(rows, "domain") },
    {
      key: "domain",
      label: "Business domain matches website",
      short: "Business domain",
      done: true,
      detail: "acme.com",
      date: "2026-10-02T10:00:00Z",
    },
  );
  assert.equal(row(rows, "email").done, true);
  assert.equal(row(rows, "email").date, "2026-10-01T09:00:00Z");
  assert.equal(row(rows, "verification"), undefined);
});

test("not verified: one row, not checked yet (even with an old record)", () => {
  const rows = trustRows({
    ...base,
    verification: { verifiedDomain: "acme.com", reviewedAt: "2026-01-01", verifiedEmailAt: "2026-01-01" },
  });
  assert.equal(row(rows, "domain"), undefined);
  assert.equal(row(rows, "email"), undefined);
  assert.deepEqual(
    [row(rows, "verification").label, row(rows, "verification").detail, row(rows, "verification").done],
    ["Business domain and email", "Not checked yet", false],
  );
  assert.match(page, />Not verified yet</);
});

test("claimed vs unclaimed", () => {
  const claimed = row(trustRows({ ...base, isClaimed: true, claimedAt: "2026-09-01T00:00:00Z" }), "claimed");
  assert.equal(claimed.done, true);
  assert.equal(claimed.date, "2026-09-01T00:00:00Z");
  const unclaimed = row(trustRows(base), "claimed");
  assert.equal(unclaimed.done, false);
  assert.equal(unclaimed.date, null);
  assert.match(page, /Managed by the agency/);
  assert.match(page, /Not claimed yet ·/);
  assert.equal((page.match(/Claim this listing/g) ?? []).length, 1);
});

test("reply time: hidden under 3 requests, then 1 hour / ~h hours / ~d days", () => {
  assert.equal(replyTimeLabel(null), null);
  assert.equal(replyTimeLabel({ medianMinutes: 30, contacted: 2 }), null);
  assert.equal(replyTimeLabel({ medianMinutes: 30, contacted: 3 }), "Usually replies within 1 hour");
  assert.equal(replyTimeLabel({ medianMinutes: 60, contacted: 5 }), "Usually replies within 1 hour");
  assert.equal(replyTimeLabel({ medianMinutes: 170, contacted: 5 }), "Usually replies within ~3 hours");
  assert.equal(replyTimeLabel({ medianMinutes: 1500, contacted: 5 }), "Usually replies within ~1 day");
  assert.equal(replyTimeLabel({ medianMinutes: 4000, contacted: 5 }), "Usually replies within ~3 days");
  const r = row(trustRows({ ...base, reply: { medianMinutes: 30, contacted: 2 } }), "reply");
  assert.deepEqual([r.done, r.detail], [false, "Shown after 3 requests through YT Agencies"]);
  assert.match(page, /"Reply time: not enough data yet"/);
});

test("channels: confirmed vs listed, the chip hidden when there are none", () => {
  const list = [ch("a", "2026-10-01", "UCa"), ch("b"), ch("c", "2026-10-02"), ch("d")];
  const g = channelGroups(list);
  assert.deepEqual(g.confirmed.map((c) => c.id), ["a", "c"]);
  assert.deepEqual(g.listed.map((c) => c.id), ["b", "d"]);
  assert.equal(channelChip(2, 2), "2 channels confirmed · 2 listed");
  assert.equal(channelChip(1, 0), "1 channel confirmed · 0 listed");
  assert.equal(channelChip(0, 0), null);
  assert.equal(row(trustRows({ ...base, channels: list }), "channels").detail, "2 of 4 listed channels");
  assert.match(page, /None yet\. When an owner confirms, the channel moves here\./);
  assert.match(page, /From YouTube, checked \{monthYear\(c\.statsCheckedAt\)\}/);
});

test("case study label: confirmed channel id, else reported by agency", () => {
  const channels = [ch("a", "2026-10-01", "UC_confirmed"), ch("b", null, "UC_listed")];
  assert.equal(caseStudyLabel("UC_confirmed", channels), "Channel confirmed");
  assert.equal(caseStudyLabel("UC_listed", channels), "Reported by agency");
  assert.equal(caseStudyLabel(null, channels), "Reported by agency");
  assert.equal(caseStudyLabel("UC_other", channels), "Reported by agency");
  assert.match(page, /View the channel on YouTube/);
  assert.match(page, /rel="nofollow noopener"/);
});

test("empty sections are hidden", () => {
  assert.match(page, /if \(groups\.confirmed\.length \+ groups\.listed\.length === 0\) return null;/);
  assert.match(page, /if \(terms\.length === 0 && services\.length === 0\) return null;/);
  assert.match(page, /\{agency\.workSamples\.length > 0 && \(/);
  assert.deepEqual(termsCells({ pricingModel: null, minContract: null, adSpend: null, setupFeeUsd: null }), []);
});

test("no price duplication: the starting price is only in the sidebar and mobile bar", () => {
  const cells = termsCells({ pricingModel: "retainer", minContract: "3_months", adSpend: "separate", setupFeeUsd: 0 });
  assert.deepEqual(cells.map((c) => c.label), ["Pricing model", "Minimum contract", "Ad spend", "Setup fee"]);
  assert.ok(!cells.some((c) => /starting/i.test(c.label)));
  assert.doesNotMatch(page, /function PricingSection|id="pricing"/);
  assert.equal((page.match(/Starting price/g) ?? []).length, 1);
  // Section order: At a glance, Trust & proof, Work samples, then Services & pricing.
  const order = ['id="glance"', "<TrustSection", 'id="work"', "<ServicesPricingSection"].map((m) => page.indexOf(m));
  assert.ok(order.every((n, i) => n > 0 && (i === 0 || n > order[i - 1])), String(order));
  // No review schema added.
  assert.doesNotMatch(page, /aggregateRating/);
});
