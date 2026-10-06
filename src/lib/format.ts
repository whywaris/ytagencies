// Number and date formatting for the admin (ADMIN_V2_SPEC §2). One place, Intl only.
// No imports, so tests/format.test.mjs can load the real file.

const LOCALE = "en-US";
const count = new Intl.NumberFormat(LOCALE);
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });

/** 1,284 · above 10k compact: 12.4k */
export function formatCount(n: number) {
  return Math.abs(n) >= 10_000 ? compact.format(n).toLowerCase() : count.format(n);
}

/** $1,250 · cents only below $10: $9.50 */
export function formatCurrency(usd: number) {
  const small = Math.abs(usd) < 10 && !Number.isInteger(usd);
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: small ? 2 : 0,
    maximumFractionDigits: small ? 2 : 0,
  }).format(usd);
}

/** +18.2% · −4.1% (a real minus sign) · one decimal. `ratio` is 0.182 for +18.2%. */
export function formatDelta(ratio: number) {
  const pct = Math.round(ratio * 1000) / 10;
  const abs = Math.abs(pct).toFixed(1);
  if (pct > 0) return `+${abs}%`;
  if (pct < 0) return `−${abs}%`;
  return "0.0%";
}

/** "Oct 6", or "Oct 6, 2025" when it isn't the current year. */
export function formatDate(value: string | Date, now = new Date()) {
  const d = new Date(value);
  return d.toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Full date and time, for tooltips on relative times. */
export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString(LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "just now", "5m ago", "2h ago", "3d ago", then the date. For activity lists. */
export function formatRelative(value: string | Date, now = new Date()) {
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value, now);
}
