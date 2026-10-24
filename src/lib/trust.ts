// "Trust & proof" on agency profiles: what we checked vs what the agency told us, from stored data
// only (never an invented number). No imports: tested (tests/trust.test.mjs).

/** A reply time needs at least this many contacted requests (agency_response_times, 90 days). */
export const MIN_REPLIES = 3;

/** "Usually replies within 1 hour / ~5 hours / ~2 days", or null without enough data. */
export function replyTimeLabel(r: { medianMinutes: number; contacted: number } | null | undefined) {
  if (!r || r.contacted < MIN_REPLIES || !Number.isFinite(r.medianMinutes)) return null;
  const m = Math.max(0, r.medianMinutes);
  if (m <= 60) return "Usually replies within 1 hour";
  const hours = Math.round(m / 60);
  if (hours < 24) return `Usually replies within ~${hours} hours`;
  const days = Math.round(m / 1440);
  return `Usually replies within ~${days} ${days === 1 ? "day" : "days"}`;
}

export type TrustChannel = { id: string; confirmedAt: string | null; channelId: string | null };

/** Confirmed by the channel owner (confirmed_at set) vs listed by the agency, order kept. */
export function channelGroups<T extends TrustChannel>(channels: T[]) {
  return {
    confirmed: channels.filter((c) => c.confirmedAt !== null),
    listed: channels.filter((c) => c.confirmedAt === null),
  };
}

/** "{n} channels confirmed · {m} listed", or null when the agency has none. */
export function channelChip(confirmed: number, listed: number) {
  if (confirmed + listed === 0) return null;
  return `${confirmed} ${confirmed === 1 ? "channel" : "channels"} confirmed · ${listed} listed`;
}

/** A case study's label: its channel matches one the owner confirmed, or it's the agency's word. */
export function caseStudyLabel(channelId: string | null, channels: TrustChannel[]) {
  const confirmed = new Set(
    channels.filter((c) => c.confirmedAt !== null && c.channelId).map((c) => c.channelId),
  );
  return channelId && confirmed.has(channelId) ? "Channel confirmed" : "Reported by agency";
}

export type TrustInput = {
  isVerified: boolean;
  verification: {
    verifiedDomain: string | null;
    reviewedAt: string | null;
    verifiedEmailAt: string | null;
  } | null;
  isClaimed: boolean;
  claimedAt: string | null;
  channels: TrustChannel[];
  reply: { medianMinutes: number; contacted: number } | null;
};

export type TrustRow = {
  key: string;
  /** Full label (the Trust & proof card). */
  label: string;
  /** Short label (the sidebar). */
  short: string;
  done: boolean;
  /** A value shown after the label, e.g. "2 of 5 listed channels". */
  detail: string | null;
  /** ISO date the check happened, when we store one. */
  date: string | null;
};

/** "Checked by YT Agencies": one row each, ✓ or –, with a date where we have one. */
export function trustRows(t: TrustInput): TrustRow[] {
  const v = t.isVerified ? t.verification : null;
  const { confirmed } = channelGroups(t.channels);
  const reply = replyTimeLabel(t.reply);
  const rows: TrustRow[] = v
    ? [
        {
          key: "domain",
          label: "Business domain matches website",
          short: "Business domain",
          done: !!v.verifiedDomain,
          detail: v.verifiedDomain,
          date: v.verifiedDomain ? v.reviewedAt : null,
        },
        {
          key: "email",
          label: "Business email confirmed",
          short: "Business email",
          done: !!v.verifiedEmailAt,
          detail: null,
          date: v.verifiedEmailAt,
        },
      ]
    : [
        {
          key: "verification",
          label: "Business domain and email",
          short: "Domain and email",
          done: false,
          detail: "Not checked yet",
          date: null,
        },
      ];
  rows.push(
    {
      key: "claimed",
      label: "Profile claimed by the agency",
      short: "Claimed by the agency",
      done: t.isClaimed,
      detail: t.isClaimed ? null : "Not claimed yet",
      date: t.isClaimed ? t.claimedAt : null,
    },
    {
      key: "channels",
      label: "Client channels confirmed by owners",
      short: "Client channels",
      done: confirmed.length > 0,
      detail: `${confirmed.length} of ${t.channels.length} listed ${t.channels.length === 1 ? "channel" : "channels"}`,
      date: null,
    },
    {
      key: "reply",
      label: "Reply time",
      short: "Reply time",
      done: reply !== null,
      detail: reply ?? `Shown after ${MIN_REPLIES} requests through YT Agencies`,
      date: null,
    },
  );
  return rows;
}

/** "Oct 2026" (UTC), for "On YT Agencies since …" and check dates. */
export const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The terms row in "Services & pricing": pricing model, minimum contract, ad spend and setup fee,
 * leaving out what's empty. The starting price isn't here: the sidebar shows it, and each
 * service row shows its own.
 */
export function termsCells(a: {
  pricingModel: string | null;
  minContract: string | null;
  adSpend: string | null;
  setupFeeUsd: number | null;
}) {
  const MODEL: Record<string, string> = {
    retainer: "Monthly retainer",
    per_video: "Per video",
    project: "Per project",
    performance: "Performance-based",
  };
  const cells: { label: string; value: string }[] = [];
  if (a.pricingModel && MODEL[a.pricingModel])
    cells.push({ label: "Pricing model", value: MODEL[a.pricingModel] });
  if (a.minContract) {
    const m = a.minContract.match(/^(\d+)_months?$/)?.[1];
    cells.push({
      label: "Minimum contract",
      value: a.minContract === "none" ? "None" : `${m} ${m === "1" ? "month" : "months"}`,
    });
  }
  if (a.adSpend === "separate") cells.push({ label: "Ad spend", value: "Paid separately" });
  if (a.adSpend === "included") cells.push({ label: "Ad spend", value: "Included" });
  if (a.setupFeeUsd !== null)
    cells.push({
      label: "Setup fee",
      value: a.setupFeeUsd === 0 ? "None" : `$${a.setupFeeUsd.toLocaleString("en-US")} one time`,
    });
  return cells;
}
