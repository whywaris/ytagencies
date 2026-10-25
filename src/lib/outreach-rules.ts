// Outreach email rules (Admin → Growth → Outreach, lib/outreach-mail.ts): templates, who may be
// emailed, how many per run, reminders and CSV import. No imports (the admin's live preview uses
// it in the browser): tested in tests/outreach.test.mjs.

export const TEMPLATES = ["invite", "reminder"] as const;
export type Template = (typeof TEMPLATES)[number];

export const VARIABLES = [
  "agency_name",
  "profile_url",
  "claim_url",
  "unsubscribe_url",
  "sender_name",
  "business_address",
] as const;
export type Variables = Record<(typeof VARIABLES)[number], string>;

/** "{agency_name}" → its value. Unknown names stay as typed, so a typo is visible in the preview. */
export const renderTemplate = (tpl: string, vars: Variables) =>
  tpl.replace(/\{([a-z_]+)\}/g, (m, name: string) =>
    (VARIABLES as readonly string[]).includes(name) ? vars[name as keyof Variables] : m,
  );

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Trimmed and lowercased, or null if it isn't an email address. */
export function normalizeEmail(v: unknown) {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

// ───────── Who may be emailed ─────────

export type Recipient = {
  status: string; // agencies.status
  isClaimed: boolean;
  optedOut: boolean;
  suppressed: boolean; // bounced or complained, ever
  /** A lead-based "you have a request" email went to this agency in the last 7 days. */
  recentLeadEmail: boolean;
};

/** Why this agency can't be emailed now, or null when it can. */
export function blockedReason(r: Recipient) {
  if (r.status !== "published") return "not published";
  if (r.isClaimed) return "claimed";
  if (r.optedOut) return "unsubscribed";
  if (r.suppressed) return "bounced or complained";
  if (r.recentLeadEmail) return "emailed about a request this week";
  return null;
}

export type OutreachSettings = {
  paused: boolean;
  from: string;
  businessAddress: string;
};

/** What stops the cron from sending at all; empty when it may send. */
export function sendingProblems(s: OutreachSettings) {
  const out: string[] = [];
  if (s.paused) out.push("Outreach is paused.");
  if (!normalizeEmail(s.from)) out.push("Set the From address.");
  if (!s.businessAddress.trim()) out.push("Set the business postal address.");
  return out;
}

export const SEND_START_HOUR = 9; // UTC, first run
export const SEND_END_HOUR = 17; // UTC, last run

/**
 * How many to send in this run: weekdays 09:00–17:00 UTC, the day's remaining allowance spread
 * over the runs left today (one an hour). Outside the window: 0.
 */
export function runQuota(cap: number, sentToday: number, now: Date) {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  if (day === 0 || day === 6 || hour < SEND_START_HOUR || hour > SEND_END_HOUR) return 0;
  const remaining = Math.max(0, cap - sentToday);
  const runsLeft = SEND_END_HOUR - hour + 1;
  return Math.ceil(remaining / runsLeft);
}

/** A delivered invite is due a reminder `days` after delivery. */
export function reminderDue(invite: { status: string; deliveredAt: string | null }, now: Date, days: number) {
  if (invite.status !== "delivered" || !invite.deliveredAt) return false;
  return now.getTime() - Date.parse(invite.deliveredAt) >= days * 86_400_000;
}

// ───────── CSV import ─────────

export type CsvRow = { line: number; slug: string; email: string };

/** One CSV field list per line; quotes, "" escapes, CRLF and a BOM handled. */
function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

/** "agency slug, email" rows; a header row is skipped. At most 2,000 rows. */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    if (!raw.trim() || rows.length >= 2000) return;
    const [slug = "", email = ""] = splitCsvLine(raw);
    if (i === 0 && /slug|agency/i.test(slug) && /mail/i.test(email)) return; // header
    rows.push({ line: i + 1, slug: slug.toLowerCase(), email });
  });
  return rows;
}

export type ImportStatus = "matched" | "updated" | "unknown slug" | "invalid email" | "duplicate" | "claimed";
export type ImportRow = CsvRow & { status: ImportStatus; agencyId: string | null; normalized: string | null };

/**
 * What saving the file would do, row by row: new address (matched), a changed address (updated),
 * or why it's skipped. Only matched and updated rows are saved.
 */
export function classifyImport(
  rows: CsvRow[],
  agencies: Map<string, { id: string; isClaimed: boolean; status: string }>,
  existing: Map<string, string>, // agency id → current email
): ImportRow[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const agency = agencies.get(r.slug);
    const normalized = normalizeEmail(r.email);
    const row = (status: ImportStatus): ImportRow => ({ ...r, status, agencyId: agency?.id ?? null, normalized });
    if (!agency || agency.status !== "published") return row("unknown slug");
    if (!normalized) return row("invalid email");
    if (agency.isClaimed) return row("claimed");
    if (seen.has(agency.id) || existing.get(agency.id) === normalized) return row("duplicate");
    seen.add(agency.id);
    return row(existing.has(agency.id) ? "updated" : "matched");
  });
}

// ───────── Email body ─────────

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The plain-text body as simple HTML: escaped, links clickable, paragraphs kept. No images. */
export function textToHtml(text: string) {
  const paras = text.split(/\n\s*\n/).map((p) =>
    escapeHtml(p)
      .replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`)
      .replace(/\n/g, "<br>"),
  );
  return `<div style="font:15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#1d1d1f;max-width:560px">${paras
    .map((p) => `<p>${p}</p>`)
    .join("")}</div>`;
}
