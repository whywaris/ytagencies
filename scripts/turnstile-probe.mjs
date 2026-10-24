// Turnstile probe: opens each page that has a Turnstile form in headless Chromium, brings the form
// into view, waits, and reports CSP violations, console errors, requests to
// challenges.cloudflare.com and whether the widget's iframe rendered.
//   node scripts/turnstile-probe.mjs https://ytagencies.com [agency-slug]
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "https://ytagencies.com").replace(/\/$/, "");
const slug = process.argv[3] ?? "goat-agency";
const PAGES = [
  { name: "quote (profile)", path: `/agency/${slug}`, scroll: "#contact" },
  { name: "request proposals", path: "/request-proposals?service=youtube-ads-agencies&industry=saas", scroll: "form" },
  { name: "contact / report", path: `/contact?topic=report&agency=${slug}`, scroll: "form" },
  { name: "login", path: "/login", scroll: "form" },
];

// PLAYWRIGHT_CHANNEL=msedge uses the installed Edge (no browser download).
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
let failed = 0;
for (const p of PAGES) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const cf = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("response", (r) => {
    if (r.url().includes("challenges.cloudflare.com")) cf.push(`${r.status()} ${r.url().slice(0, 110)}`);
  });
  page.on("requestfailed", (r) => {
    if (r.url().includes("challenges.cloudflare.com"))
      cf.push(`FAILED ${r.failure()?.errorText} ${r.url().slice(0, 110)}`);
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__csp.push(`${e.effectiveDirective} blocked ${e.blockedURI} (${e.disposition})`),
    );
  });
  const res = await page.goto(base + p.path, { waitUntil: "domcontentloaded" });
  await page.locator(p.scroll).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(8000);
  // The widget's iframe is in a closed shadow root: page.frames() still lists it.
  const iframe = page.frames().filter((f) => f.url().startsWith("https://challenges.cloudflare.com/")).length;
  const state = await page.evaluate(() => ({
    csp: window.__csp,
    api: typeof window.turnstile,
    widgets: document.querySelectorAll('[name="cf-turnstile-response"]').length,
    token: [...document.querySelectorAll('[name="cf-turnstile-response"]')].some((i) => i.value),
    status: document.querySelector("[data-turnstile-status]")?.getAttribute("data-turnstile-status") ?? "n/a",
    message: [...document.querySelectorAll('[role="alert"], .text-destructive')]
      .map((n) => n.textContent.trim())
      .filter(Boolean)
      .slice(0, 3),
  }));
  const ok = iframe > 0 || state.widgets > 0;
  if (!ok) failed++;
  console.log(`\n=== ${p.name}: ${base}${p.path} (${res?.status()})`);
  console.log(`widget rendered: ${ok} (iframes ${iframe}, response inputs ${state.widgets}, token ${state.token}, status ${state.status}, window.turnstile ${state.api})`);
  console.log(`CSP violations: ${state.csp.length ? state.csp.join(" | ") : "none"}`);
  console.log(`console errors: ${errors.length ? errors.join(" | ") : "none"}`);
  console.log(`cloudflare requests: ${cf.length ? cf.slice(0, 8).join(" | ") : "none"}`);
  if (state.message.length) console.log(`messages: ${state.message.join(" | ")}`);
  await context.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
