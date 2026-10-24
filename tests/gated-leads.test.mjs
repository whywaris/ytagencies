// Free editing, gated leads and the Pro badge: free owners edit the basics but never see a lead's
// contact details; Pro sees them; previews carry no PII; profile requests fall back after 48
// hours; the Pro badge needs a live Pro plan and Verified doesn't care about the plan.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { entitlementsFor } from "../src/lib/entitlements.ts";
import {
  fallbackDue,
  PREVIEW_KEYS,
  redactSummary,
  SUMMARY_MAX,
  toPreview,
} from "../src/lib/lead-preview.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const now = new Date("2026-10-24T12:00:00Z");
const pro = (extra = {}) => ({
  plan_id: "pro",
  status: "active",
  starts_at: "2026-09-01T00:00:00Z",
  ends_at: null,
  ...extra,
});
const free = entitlementsFor({ subscriptions: [], verificationApproved: false, now });
const paid = entitlementsFor({ subscriptions: [pro()], verificationApproved: false, now });

test("free owner can edit the basics", () => {
  assert.equal(free.canEdit, true);
  assert.equal(free.caseStudies, 3);
  const actions = read("src/lib/actions/dashboard.ts");
  // The basics only check ownership; the Pro-only actions check the feature.
  const editable = actions.slice(actions.indexOf("async function editableAgency"));
  assert.doesNotMatch(editable.slice(0, editable.indexOf("\n}\n")), /getEntitlements/);
  for (const fn of ["updateProfile", "updateBasics", "uploadLogo", "saveCaseStudy", "requestVerification"]) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}(`));
    assert.match(body.slice(0, 400), /editableAgency\(agencyId\)/, fn);
  }
  assert.match(actions, /export async function updateBooking[\s\S]{0,200}proAgency\(agencyId, "bookingButtons"\)/);
  assert.match(actions, /export async function addChannel[\s\S]{0,200}proAgency\(agencyId, "channels"\)/);
  assert.match(actions, /export async function markLeadContacted[\s\S]{0,200}proAgency\(agencyId, "leadDetails"\)/);
  // Website joins the owner's update grant.
  assert.match(read("supabase/schema.sql"), /grant update \(website\) on agencies to authenticated;/);
});

test("free owner can't see lead contact details; Pro can", () => {
  assert.equal(free.leadDetails, false);
  assert.equal(paid.leadDetails, true);
  const schema = read("supabase/schema.sql");
  // RLS: the leads row (name, email, company, links, message) needs a live Pro plan.
  const policies = [...schema.matchAll(/create policy "agency reads routed leads" on leads[\s\S]*?\);/g)];
  assert.match(policies.at(-1)[0], /agency_managed\(a\.id\)/);
  // The preview function never returns contact columns.
  const fn = schema.slice(schema.lastIndexOf("create or replace function lead_previews"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  for (const col of ["l.name", "l.email", "l.company", "business_url", "channel_url", "l.message"])
    assert.ok(!body.includes(col), col);
  // The dashboard shows free owners previews, Pro owners the full request.
  const page = read("src/app/dashboard/[slug]/inquiries/page.tsx");
  assert.match(page, /if \(!ctx\.e\.leadDetails\) return <Previews ctx=\{ctx\} \/>;/);
  assert.match(page, /rpc\("lead_previews"/);
  // Emails: the full request (with reply-to) only on Pro, a preview otherwise.
  const leads = read("src/lib/leads.tsx");
  assert.match(leads, /managed\s*\?\s*await send\(\{\s*from,\s*to,\s*replyTo: lead\.email/);
  assert.match(leads, /<AgencyLeadPreviewEmail/);
  const previewEmail = read("src/emails/agency-lead-preview.tsx");
  assert.doesNotMatch(previewEmail, /lead\.(name|email|company|message)|replyTo/);
  assert.match(previewEmail, /Upgrade to Pro to see contact details and reply\./);
});

test("preview never contains PII", () => {
  const message =
    "Hi, I'm Sarah Connor from Skynet Labs. Email sarah@skynet.io or call +1 (555) 010-2030, " +
    "site https://skynet.io/about and skynetlabs.com, channel youtube.com/@skynet, IG @sarah.c. " +
    "We want YouTube ads for our dental clinics in Texas, starting next month.";
  const out = redactSummary(message, { name: "Sarah Connor", company: "Skynet Labs" });
  for (const bad of ["Sarah", "Connor", "Skynet", "sarah@", "555", "010-2030", "https", "skynet.io", "skynetlabs.com", "youtube.com", "@sarah", "@skynet"])
    assert.ok(!out.toLowerCase().includes(bad.toLowerCase()), `${bad} leaked: ${out}`);
  assert.ok(out.length <= SUMMARY_MAX);
  assert.match(redactSummary("We want YouTube ads for our dental clinics."), /dental clinics/);
  // toPreview copies only the preview fields, whatever the row holds.
  const p = toPreview({
    service: "YouTube Ads",
    industry: "Dentists",
    country: "Call me on 555 123 4567",
    name: "Sarah",
    email: "sarah@skynet.io",
    business_url: "https://skynet.io",
    message,
  });
  assert.deepEqual(Object.keys(p).sort(), [...PREVIEW_KEYS].sort());
  assert.ok(!JSON.stringify(p).includes("sarah"));
  assert.ok(!JSON.stringify(p).includes("4567"));
});

test("48-hour fallback: only with consent, once, unless opened or answered on Pro", () => {
  const sent = (hours) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const base = {
    sentAt: sent(49),
    consent: true,
    fallbackAt: null,
    managed: false,
    openedAt: null,
    contactedAt: null,
  };
  assert.equal(fallbackDue(base, now), true);
  assert.equal(fallbackDue({ ...base, sentAt: sent(47) }, now), false);
  assert.equal(fallbackDue({ ...base, consent: false }, now), false);
  assert.equal(fallbackDue({ ...base, fallbackAt: sent(1) }, now), false);
  // Opened or answered on Pro: it stays with the agency.
  assert.equal(fallbackDue({ ...base, managed: true, openedAt: sent(40) }, now), false);
  assert.equal(fallbackDue({ ...base, managed: true, contactedAt: sent(40) }, now), false);
  // Pro that never opened it, or a free owner who looked at the preview: it moves on.
  assert.equal(fallbackDue({ ...base, managed: true }, now), true);
  assert.equal(fallbackDue({ ...base, openedAt: sent(40) }, now), true);
  // Wired into the daily cron, claimed before sending so it runs once.
  assert.match(read("src/app/api/cron/guides/route.ts"), /runLeadFallbacks\(now\)/);
  assert.match(read("src/lib/lead-fallback.tsx"), /\.update\(\{ fallback_at:[\s\S]*?\.is\("fallback_at", null\)/);
});

test("Pro badge only for an active Pro plan; Verified independent of plan", () => {
  assert.equal(free.proBadge, false);
  assert.equal(paid.proBadge, true);
  const ended = entitlementsFor({
    subscriptions: [pro({ ends_at: "2026-10-01T00:00:00Z" })],
    verificationApproved: true,
    now,
  });
  assert.equal(ended.proBadge, false);
  assert.equal(ended.verifiedBadge, true);
  assert.equal(
    entitlementsFor({ subscriptions: [pro()], verificationApproved: false, now }).verifiedBadge,
    false,
  );
  // Separate badges, never combined, never "verified".
  const badge = read("src/components/pro-badge.tsx");
  assert.match(badge, /title="Pro member: paid plan"/);
  // Rendered text only (the comment explains why it isn't "verified").
  const rendered = badge.slice(badge.indexOf("return ("));
  assert.doesNotMatch(rendered, /verif/i);
  const card = read("src/components/directory/agency-card.tsx");
  assert.match(card, /\{a\.managed && <ProBadge \/>\}/);
  assert.match(card, /variant="verified"/);
  const profile = read("src/app/(marketing)/agency/[slug]/page.tsx");
  assert.match(profile, /\{e\.proBadge && <ProBadge \/>\}/);
});

test("unclaimed outreach: once per lead, rate-limited, with unsubscribe", () => {
  const src = read("src/lib/outreach.tsx");
  assert.match(src, /OUTREACH_PER_WEEK = 3/);
  assert.match(src, /opted_out_at/);
  assert.match(src, /List-Unsubscribe/);
  const email = read("src/emails/agency-outreach.tsx");
  assert.match(email, /You have a project request on \{BRAND_NAME\}\. Claim your free profile to see it\./);
  assert.match(email, /Why you got this/);
  // Primary key (agency_id, lead_id): one email per request.
  assert.match(read("supabase/schema.sql"), /create table agency_outreach \([\s\S]*?primary key \(agency_id, lead_id\)/);
});
