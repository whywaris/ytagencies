// A careful fetcher for agency websites (scripts/enrich-industries.mjs). Only the agency's own
// site: http(s), the same registrable domain, no private or loopback addresses (checked after DNS
// and after every redirect), 10 s timeout, 2 MB cap, robots.txt respected, one request a second
// per host. Returns text and links only; the caller keeps snippets, never the HTML.
// DNS and fetch are injected so tests run offline (tests/enrich.test.mjs).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const USER_AGENT = "YTAgenciesBot/1.0 (+https://ytagencies.com/about)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const GAP_MS = 1000;

export class Blocked extends Error {}

// ───────── Addresses ─────────

function v4Private(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** Loopback, private, link-local, CGNAT, multicast, reserved: anything that isn't the public internet. */
export function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) return v4Private(ip);
  if (isIP(ip) !== 6) return true;
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Private(mapped[1]);
  return (
    v6 === "::" || v6 === "::1" ||
    /^f[cd]/.test(v6) || // unique local fc00::/7
    /^fe[89ab]/.test(v6) || // link-local fe80::/10
    /^ff/.test(v6) || // multicast
    v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8:") || v6.startsWith("::ffff:")
  );
}

// ───────── Domains ─────────

// ponytail: a short list of two-part public suffixes instead of the full Public Suffix List; add
// one here if an agency on, say, .com.ng gets treated as the wrong site.
const TWO_PART = new Set(
  "co.uk org.uk ac.uk gov.uk com.au net.au org.au co.nz com.br com.mx co.in net.in com.sg com.my co.za com.pk com.ng co.jp com.tr com.ar com.co co.id com.ph com.vn com.hk com.tw co.kr com.eg com.sa ae.org co.il".split(" "),
);

/** "blog.acme.co.uk" → "acme.co.uk". */
export function registrableDomain(host: string) {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".");
  if (isIP(host) || parts.length <= 2) return parts.join(".");
  const n = TWO_PART.has(parts.slice(-2).join(".")) ? 3 : 2;
  return parts.slice(-n).join(".");
}

// ───────── robots.txt ─────────

/** Is `path` allowed for our bot? Longest matching rule wins, Allow wins a tie; * and $ supported. */
export function robotsAllows(robots: string, path: string, agent = "ytagenciesbot") {
  type Group = { agents: string[]; rules: { allow: boolean; pattern: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    const re = new RegExp(
      "^" + r.pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\?\$$/, "$"),
    );
    if (!re.test(path)) continue;
    const len = r.pattern.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
  }
  return best ? best.allow : true;
}

// ───────── HTML ─────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" };
const decode = (s: string) =>
  s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Visible text: scripts, styles and the head dropped; block tags become line breaks. */
export function htmlToText(html: string) {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|head|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr|\/header|\/footer)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\r]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function extractLinks(html: string, base: string) {
  const out: { url: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      out.push({ url: new URL(decode(m[1]), base).href, text: htmlToText(m[2]).slice(0, 100) });
    } catch {
      // not a URL
    }
  }
  return out;
}

const INNER = /about|work|clients|case-stud|industr|portfolio/i;
const FILE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mov|docx?|xlsx?)$/i;

/** Up to 3 pages on the same site whose path or link text says about/work/clients/industries. */
export function pickInnerPages(links: { url: string; text: string }[], home: string, max = 3) {
  const site = registrableDomain(new URL(home).hostname);
  const seen = new Set([new URL(home).origin + new URL(home).pathname.replace(/\/$/, "")]);
  const out: string[] = [];
  for (const l of links) {
    const u = new URL(l.url);
    if (!/^https?:$/.test(u.protocol) || registrableDomain(u.hostname) !== site || FILE.test(u.pathname)) continue;
    const key = u.origin + u.pathname.replace(/\/$/, "");
    if (seen.has(key) || !(INNER.test(u.pathname) || INNER.test(l.text))) continue;
    seen.add(key);
    out.push(u.origin + u.pathname + u.search);
    if (out.length >= max) break;
  }
  return out;
}

// ───────── The fetcher ─────────

type Resolve = (host: string) => Promise<string[]>;
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const dnsResolve: Resolve = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/**
 * fetch for one agency's site. get() throws Blocked for anything outside the rules (other domain,
 * private address, robots.txt) and returns null for pages that don't load or aren't HTML.
 *
 * ponytail: the address is checked before fetch() connects, and fetch() resolves the name again.
 * A host that answers DNS differently on the second lookup (rebinding) could slip through; pin
 * the checked IP with a custom dispatcher if this ever runs somewhere with internal services.
 */
export function createFetcher(site: string, deps: { resolve?: Resolve; fetch?: FetchLike; sleep?: (ms: number) => Promise<void> } = {}) {
  const resolve = deps.resolve ?? dnsResolve;
  const doFetch = deps.fetch ?? ((u, i) => fetch(u, i));
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const domain = registrableDomain(new URL(site).hostname);
  const lastHit = new Map<string, number>();
  const robots = new Map<string, string | null>(); // origin → robots.txt (null: disallow all)

  async function check(url: URL) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Blocked(`scheme ${url.protocol}`);
    if (url.username || url.password) throw new Blocked("credentials in URL");
    if (registrableDomain(url.hostname) !== domain) throw new Blocked(`other domain ${url.hostname}`);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const ips = isIP(host) ? [host] : await resolve(host).catch(() => []);
    if (!ips.length) throw new Blocked(`no DNS for ${host}`);
    if (ips.some(isPrivateIp)) throw new Blocked(`private address for ${host}`);
  }

  async function polite(host: string) {
    const wait = (lastHit.get(host) ?? 0) + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
  }

  /** One request, redirects followed by hand (each hop checked). Body capped at 2 MB. */
  async function raw(start: string, accept: string) {
    let url = new URL(start);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await check(url);
      await polite(url.host);
      const res = await doFetch(url.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        url = new URL(location, url);
        continue;
      }
      return { res, url, body: await readCapped(res) };
    }
    throw new Blocked("too many redirects");
  }

  async function allowedByRobots(url: URL) {
    if (!robots.has(url.origin)) {
      let txt: string | null = "";
      try {
        const { res, body } = await raw(`${url.origin}/robots.txt`, "text/plain");
        // Missing robots.txt: everything allowed. Server errors: stay away (as Google does).
        txt = res.ok ? body : res.status >= 500 ? null : "";
      } catch (e) {
        txt = e instanceof Blocked ? "" : null;
      }
      robots.set(url.origin, txt);
    }
    const txt = robots.get(url.origin);
    return txt !== null && robotsAllows(txt ?? "", url.pathname + url.search);
  }

  return {
    domain,
    async get(target: string): Promise<{ url: string; html: string } | null> {
      const url = new URL(target);
      await check(url);
      if (!(await allowedByRobots(url))) throw new Blocked(`robots.txt disallows ${url.pathname}`);
      const { res, url: final, body } = await raw(url.href, "text/html");
      if (final.href !== url.href && !(await allowedByRobots(final))) throw new Blocked("robots.txt disallows the redirect target");
      if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? "")) return null;
      return { url: final.href, html: body };
    },
  };
}

async function readCapped(res: Response) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(size, MAX_BYTES));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.byteLength, buf.length - at));
    buf.set(part, at);
    at += part.byteLength;
  }
  return new TextDecoder().decode(buf);
}
