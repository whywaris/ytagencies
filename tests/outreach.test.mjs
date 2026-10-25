// Outreach emails (src/lib/outreach-rules.ts, outreach-webhook.ts, outreach-mail.ts): who may be
// emailed, the daily cap, at most two emails per agency, the pause and address checks, the Resend
// webhook signature, unsubscribing without an account, and the CSV import.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  blockedReason,
  classifyImport,
  normalizeEmail,
  parseCsv,
  reminderDue,
  renderTemplate,
  runQuota,
  sendingProblems,
  textToHtml,
} from "../src/lib/outreach-rules.ts";
import { verifyResendSignature, WEBHOOK_STATUS } from "../src/lib/outreach-webhook.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ok = { status: "published", isClaimed: false, optedOut: false, suppressed: false, recentLeadEmail: false };

test("never emails claimed, unsubscribed, bounced or unpublished agencies, or one emailed this week", () => {
  assert.equal(blockedReason(ok), null);
  assert.equal(blockedReason({ ...ok, isClaimed: true }), "claimed");
  assert.equal(blockedReason({ ...ok, optedOut: true }), "unsubscribed");
  assert.equal(blockedReason({ ...ok, suppressed: true }), "bounced or complained");
  assert.equal(blockedReason({ ...ok, recentLeadEmail: true }), "emailed about a request this week");
  assert.equal(blockedReason({ ...ok, status: "archived" }), "not published");
  // The cron re-checks every message right before sending, and cancels the blocked ones.
  const mail = read("src/lib/outreach-mail.ts");
  assert.match(mail, /if \(!c \|\| c\.reason \|\| !c\.email\) \{\n\s+await db\n\s+\.from\("outreach_messages"\)\n\s+\.update\(\{ status: "cancelled"/);
  // Claiming (any route) cancels what's queued: a database trigger.
  const sql = read("supabase/migrations/20261105000100_agency_outreach_emails.sql");
  assert.match(sql, /update outreach_messages set status = 'cancelled' where agency_id = new\.id and status = 'queued';/);
});

test("daily cap: spread over the weekday runs, never over the cap", () => {
  const at = (iso) => new Date(iso);
  // Monday 09:00 UTC, 25 a day over 9 runs: 3 now.
  assert.equal(runQuota(25, 0, at("2026-11-02T09:05:00Z")), 3);
  // Last run of the day sends whatever is left.
  assert.equal(runQuota(25, 20, at("2026-11-02T17:00:00Z")), 5);
  // Cap reached: nothing.
  assert.equal(runQuota(25, 25, at("2026-11-02T12:00:00Z")), 0);
  assert.equal(runQuota(25, 40, at("2026-11-02T12:00:00Z")), 0);
  // Outside the window and at weekends: nothing.
  assert.equal(runQuota(25, 0, at("2026-11-02T08:59:00Z")), 0);
  assert.equal(runQuota(25, 0, at("2026-11-02T18:00:00Z")), 0);
  assert.equal(runQuota(25, 0, at("2026-11-07T12:00:00Z")), 0); // Saturday
  assert.equal(runQuota(25, 0, at("2026-11-08T12:00:00Z")), 0); // Sunday
  // Over a whole weekday, the runs add up to the cap exactly.
  let sent = 0;
  for (let h = 9; h <= 17; h++) sent += runQuota(25, sent, at(`2026-11-03T${String(h).padStart(2, "0")}:00:00Z`));
  assert.equal(sent, 25);
});

test("at most two emails per agency, ever; a reminder only after a delivered invite", () => {
  const sql = read("supabase/migrations/20261105000100_agency_outreach_emails.sql");
  assert.match(sql, /template text not null check \(template in \('invite', 'reminder'\)\)/);
  assert.match(sql, /unique \(agency_id, template\)/);
  const now = new Date("2026-11-10T10:00:00Z");
  assert.equal(reminderDue({ status: "delivered", deliveredAt: "2026-11-02T10:00:00Z" }, now, 7), true);
  assert.equal(reminderDue({ status: "delivered", deliveredAt: "2026-11-05T10:00:00Z" }, now, 7), false);
  for (const status of ["sent", "bounced", "complained", "failed", "cancelled", "queued"])
    assert.equal(reminderDue({ status, deliveredAt: "2026-10-01T10:00:00Z" }, now, 7), false, status);
});

test("paused, a missing From or a missing postal address blocks sending", () => {
  const good = { paused: false, from: "hello@mail.ytagencies.com", businessAddress: "1 Main St, Lahore" };
  assert.deepEqual(sendingProblems(good), []);
  assert.deepEqual(sendingProblems({ ...good, paused: true }), ["Outreach is paused."]);
  assert.deepEqual(sendingProblems({ ...good, from: "" }), ["Set the From address."]);
  assert.deepEqual(sendingProblems({ ...good, businessAddress: "  " }), ["Set the business postal address."]);
  // The cron checks before doing anything, and the setting starts paused.
  assert.match(read("src/lib/outreach-mail.ts"), /const problems = sendingProblems\(settings\);\n\s+if \(problems\.length\) return/);
  assert.match(read("supabase/migrations/20261105000100_agency_outreach_emails.sql"), /outreach_paused boolean not null default true/);
});

test("Resend webhook: only a valid, recent Svix signature is accepted", () => {
  const key = Buffer.from("test-signing-key-0123456789abcdef");
  const secret = `whsec_${key.toString("base64")}`;
  const body = JSON.stringify({ type: "email.bounced", data: { email_id: "abc" } });
  const now = 1_800_000_000;
  const sign = (id, ts, b) => `v1,${createHmac("sha256", key).update(`${id}.${ts}.${b}`).digest("base64")}`;
  const h = { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) };
  assert.equal(verifyResendSignature(body, h, secret, now), true);
  assert.equal(verifyResendSignature(body, { ...h, signature: `v1,bad v1,${sign("msg_1", now, body).slice(3)}` }, secret, now), true);
  assert.equal(verifyResendSignature(`${body} `, h, secret, now), false); // tampered body
  assert.equal(verifyResendSignature(body, h, `whsec_${Buffer.from("other").toString("base64")}`, now), false);
  assert.equal(verifyResendSignature(body, h, secret, now + 301), false); // too old
  assert.equal(verifyResendSignature(body, { ...h, signature: null }, secret, now), false);
  assert.equal(verifyResendSignature(body, h, "", now), false); // no secret configured
  assert.deepEqual(Object.values(WEBHOOK_STATUS).sort(), ["bounced", "complained", "delivered"]);
  // Checked on the raw body before parsing; bounces and complaints suppress the address.
  const route = read("src/app/api/webhooks/resend/route.ts");
  assert.ok(route.indexOf("verifyResendSignature(") < route.indexOf("JSON.parse("));
  assert.match(read("src/lib/outreach-mail.ts"), /\.from\("outreach_suppressions"\)\n\s+\.upsert\(\{ email: msg\.email\.toLowerCase\(\), reason: status \}/);
});

test("unsubscribe works without signing in, and one-click headers are sent", () => {
  const route = read("src/app/api/outreach/unsubscribe/route.ts");
  assert.doesNotMatch(route, /getUser|requireUser|requireAdmin/);
  assert.match(route, /export async function POST/);
  assert.match(route, /\.update\(\{ opted_out_at: new Date\(\)\.toISOString\(\) \}\)/);
  // GET only shows a button (link scanners can't unsubscribe anyone).
  assert.doesNotMatch(route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST")), /update\(/);
  const mail = read("src/lib/outreach-mail.ts");
  assert.match(mail, /"List-Unsubscribe": `<mailto:\$\{mailto\}\?subject=unsubscribe>, <\$\{email\.unsubscribe\}>`/);
  assert.match(mail, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
});

test("CSV import: header, quotes, BOM, CRLF, semicolons and every skip reason", () => {
  const csv = '﻿agency slug,email\r\nacme-media, Hello@Acme.com \r\n"beta-co";"ops@beta.co"\r\n\r\nghost,a@b.co\r\nacme-media,second@acme.com\r\nclaimed-co,x@claimed.co\r\nbeta-co,not-an-email\r\ndelta,same@delta.co\r\nepsilon,new@epsilon.co\r\n';
  const rows = parseCsv(csv);
  assert.deepEqual(rows[0], { line: 2, slug: "acme-media", email: "Hello@Acme.com" });
  assert.equal(rows[1].email, "ops@beta.co");
  const agencies = new Map([
    ["acme-media", { id: "a1", isClaimed: false, status: "published" }],
    ["beta-co", { id: "a2", isClaimed: false, status: "published" }],
    ["claimed-co", { id: "a3", isClaimed: true, status: "published" }],
    ["delta", { id: "a4", isClaimed: false, status: "published" }],
    ["epsilon", { id: "a5", isClaimed: false, status: "published" }],
  ]);
  const existing = new Map([["a4", "same@delta.co"], ["a5", "old@epsilon.co"]]);
  const out = classifyImport(rows, agencies, existing).map((r) => [r.slug, r.status, r.normalized]);
  assert.deepEqual(out, [
    ["acme-media", "matched", "hello@acme.com"],
    ["beta-co", "matched", "ops@beta.co"],
    ["ghost", "unknown slug", "a@b.co"],
    ["acme-media", "duplicate", "second@acme.com"],
    ["claimed-co", "claimed", "x@claimed.co"],
    ["beta-co", "invalid email", null],
    ["delta", "duplicate", "same@delta.co"],
    ["epsilon", "updated", "new@epsilon.co"],
  ]);
  assert.equal(normalizeEmail(" A@B.CO "), "a@b.co");
  assert.equal(normalizeEmail("a@b"), null);
  // The server re-classifies on save; the preview isn't trusted.
  assert.match(read("src/lib/actions/admin-outreach.ts"), /const rows = \(await classify\(ctx, csv\)\)\.filter/);
});

test("templates: variables filled, honest default copy, no tracking pixel, token isn't proof", () => {
  const vars = {
    agency_name: "Acme",
    profile_url: "https://ytagencies.com/agency/acme",
    claim_url: "https://ytagencies.com/claim/acme?t=x",
    unsubscribe_url: "https://ytagencies.com/u",
    sender_name: "Waris",
    business_address: "1 Main St",
  };
  assert.equal(renderTemplate("{agency_name} at {business_address} {typo}", vars), "Acme at 1 Main St {typo}");
  const sql = read("supabase/migrations/20261105000100_agency_outreach_emails.sql");
  assert.match(sql, /'\{agency_name\} is listed on YT Agencies'/);
  assert.match(sql, /This is the last email about it\./);
  assert.doesNotMatch(sql, /looking for you/i);
  const html = textToHtml('Hi <b>\nhttps://ytagencies.com/x');
  assert.match(html, /Hi &lt;b&gt;<br><a href="https:\/\/ytagencies\.com\/x">/);
  assert.doesNotMatch(html, /<img/);
  // The claim page only records the click and prefills; the claim actions never read the token.
  assert.doesNotMatch(read("src/lib/actions/claims.tsx"), /outreach_messages/);
  assert.match(read("src/app/(marketing)/claim/[slug]/page.tsx"), /The token only tracks the click/);
});
