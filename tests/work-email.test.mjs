// Verified needs a company-domain email (src/lib/work-email.ts): free and disposable addresses
// rejected, the email on the website's domain or a subdomain, the one-time link's 24-hour expiry.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  emailOnOwnDomain,
  isFreeOrDisposable,
  NO_OWN_DOMAIN,
  ownDomain,
  readLinkToken,
  signLinkToken,
  workEmailProblem,
} from "../src/lib/work-email.ts";

const SITE = "https://www.acmemedia.com/about";
const SECRET = "x".repeat(40);

test("free and personal providers are rejected, even with a matching-looking site", () => {
  for (const email of [
    "ana@gmail.com",
    "ana@outlook.com",
    "ana@hotmail.com",
    "ana@yahoo.com",
    "ana@icloud.com",
    "ana@proton.me",
  ])
    assert.match(workEmailProblem(email, SITE), /not a personal or temporary one/, email);
  assert.equal(isFreeOrDisposable("GMAIL.com"), true);
  assert.equal(isFreeOrDisposable("mail.yahoo.com"), true, "a provider's subdomain too");
});

test("disposable inboxes are rejected", () => {
  for (const email of [
    "a@mailinator.com",
    "a@10minutemail.com",
    "a@yopmail.com",
    "a@guerrillamail.com",
  ])
    assert.notEqual(workEmailProblem(email, SITE), null, email);
});

test("the wrong domain is rejected, with the right one named", () => {
  assert.equal(
    workEmailProblem("ana@acme-media.com", SITE),
    "Use an email at acmemedia.com, your agency's website domain.",
  );
  assert.notEqual(workEmailProblem("ana@notacmemedia.com", SITE), null, "not a suffix trick");
  assert.notEqual(workEmailProblem("ana@acmemedia.com.evil.io", SITE), null);
  assert.equal(workEmailProblem("not an email", SITE), "Enter a valid email address.");
});

test("same domain and subdomains are fine; www is ignored", () => {
  assert.equal(workEmailProblem("ana@acmemedia.com", SITE), null);
  assert.equal(workEmailProblem("Ana@Mail.AcmeMedia.com", SITE), null);
  assert.equal(workEmailProblem("ana@acmemedia.com", "https://acmemedia.com"), null);
  assert.equal(emailOnOwnDomain("ana@team.acmemedia.com", "http://www.acmemedia.com"), true);
});

test("no own website domain: can't apply (site builders, social profiles, none)", () => {
  assert.equal(ownDomain(null), null);
  assert.equal(ownDomain("https://acme.wixsite.com/agency"), null);
  assert.equal(ownDomain("https://www.youtube.com/@acme"), null);
  assert.equal(ownDomain("https://linktr.ee/acme"), null);
  assert.equal(ownDomain("https://www.AcmeMedia.com"), "acmemedia.com");
  assert.equal(workEmailProblem("ana@acme.wixsite.com", "https://acme.wixsite.com"), NO_OWN_DOMAIN);
});

test("link: valid for 24 hours, then not; tampering and other secrets fail", () => {
  const t0 = Date.parse("2026-10-24T10:00:00Z");
  const id = "00000000-0000-4000-8000-000000000001";
  const token = signLinkToken(id, SECRET, t0);
  assert.equal(readLinkToken(token, SECRET, t0 + 60_000), id);
  assert.equal(readLinkToken(token, SECRET, t0 + 24 * 3_600_000 - 1000), id);
  assert.equal(readLinkToken(token, SECRET, t0 + 24 * 3_600_000 + 1000), null, "expired");
  assert.equal(readLinkToken(token, "y".repeat(40), t0), null, "other secret");
  const [, expires, mac] = token.split(".");
  assert.equal(
    readLinkToken(`00000000-0000-4000-8000-000000000002.${expires}.${mac}`, SECRET, t0),
    null,
  );
  assert.equal(readLinkToken("garbage", SECRET, t0), null);
});

test("single use: the confirm route only moves an email_pending request, once", () => {
  const route = readFileSync("src/app/api/verification/confirm/route.ts", "utf8");
  assert.match(route, /\.eq\("status", "email_pending"\)/);
  assert.match(route, /status: "requested", verified_email_at:/);
});
