// Dashboard periods (ADMIN_V2_SPEC §5.1): 7 days / 30 days / 12 months, each compared with the
// previous period of the same length. Days and months are UTC. No imports, so tests load it.

export const PERIODS = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "12m", label: "12 months" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

export const parsePeriod = (v: unknown): PeriodId =>
  PERIODS.some((p) => p.id === v) ? (v as PeriodId) : "30d";

export type Bucket = { start: Date; end: Date };

const DAY = 86_400_000;
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const utcMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 1));

/**
 * Buckets for the period ending now (the last one is today / this month, still in progress) and
 * the same number of buckets just before it. Index i of `previous` lines up with index i of `current`.
 */
export function periodBuckets(period: PeriodId, now = new Date()) {
  const all: Bucket[] = [];
  if (period === "12m") {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    for (let i = 23; i >= 0; i--) {
      all.push({ start: utcMonth(y, m - i), end: utcMonth(y, m - i + 1) });
    }
  } else {
    const days = period === "7d" ? 7 : 30;
    const today = utcDay(now).getTime();
    for (let i = 2 * days - 1; i >= 0; i--) {
      const start = new Date(today - i * DAY);
      all.push({ start, end: new Date(start.getTime() + DAY) });
    }
  }
  const half = all.length / 2;
  return { previous: all.slice(0, half), current: all.slice(half) };
}

/** How many timestamps fall in each bucket ([start, end)). */
export function countInBuckets(timestamps: (string | Date)[], buckets: Bucket[]) {
  const counts = buckets.map(() => 0);
  for (const ts of timestamps) {
    const t = new Date(ts).getTime();
    const i = buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
    if (i >= 0) counts[i]++;
  }
  return counts;
}

/** Change from previous to current as a ratio (0.182 = +18.2%), or null when there's no base. */
export function delta(current: number, previous: number) {
  return previous === 0 ? null : (current - previous) / previous;
}
