// Retention cutoffs (privacy policy "How long we keep it"). No imports: tested.

/** The moment `months` calendar months before `now`, as an ISO string (UTC). */
export function monthsBefore(now: Date, months: number) {
  const d = new Date(now);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  // Same day of the month, clamped (31 March minus one month is 28/29 February, not 3 March).
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}
