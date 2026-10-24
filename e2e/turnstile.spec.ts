import { expect, test, type Page } from "@playwright/test";

// Turnstile must render on every public form that uses it, under the site's real CSP and
// headers, and say so (with a retry) when Cloudflare can't be reached. The claim and listing forms
// use the same component but need a signed-in account, so they're covered by the shared component.

const SLUG = process.env.E2E_AGENCY_SLUG ?? "goat-agency";
const FORMS = [
  { name: "request a quote (profile)", path: `/agency/${SLUG}`, scroll: "#contact" },
  { name: "request proposals", path: "/request-proposals", scroll: "form" },
  { name: "contact / report", path: `/contact?topic=report&agency=${SLUG}`, scroll: "form" },
  { name: "sign in", path: "/login", scroll: "form" },
];

async function open(page: Page, path: string, scroll: string) {
  const violations: string[] = [];
  await page.exposeFunction("__cspViolation", (v: string) => violations.push(v));
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) =>
      // @ts-expect-error exposed above
      window.__cspViolation(`${e.effectiveDirective} ${e.blockedURI}`),
    ),
  );
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(scroll).first().scrollIntoViewIfNeeded();
  return violations;
}

for (const form of FORMS) {
  test(`Turnstile renders: ${form.name}`, async ({ page }) => {
    const violations = await open(page, form.path, form.scroll);
    // The widget's iframe sits in a closed shadow root: page.frames() still lists it.
    await expect
      .poll(() => page.frames().some((f) => f.url().startsWith("https://challenges.cloudflare.com/")), {
        timeout: 30_000,
      })
      .toBe(true);
    await expect(page.locator('[name="cf-turnstile-response"]').first()).toBeAttached();
    expect(violations.filter((v) => v.includes("challenges.cloudflare.com"))).toEqual([]);
  });
}

test("Turnstile blocked: a clear message and a working Try again", async ({ page }) => {
  let blocked = true;
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    blocked ? route.abort() : route.continue(),
  );
  await open(page, "/login", "form");
  const alert = page.getByRole("alert").filter({ hasText: "The security check didn't load" });
  await expect(alert).toBeVisible({ timeout: 15_000 });
  blocked = false;
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(alert).toBeHidden({ timeout: 30_000 });
  await expect
    .poll(() => page.frames().some((f) => f.url().startsWith("https://challenges.cloudflare.com/")), {
      timeout: 30_000,
    })
    .toBe(true);
});
