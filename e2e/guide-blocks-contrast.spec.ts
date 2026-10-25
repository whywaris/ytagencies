import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Every guide block (components/guide-blocks-demo.tsx on /styleguide), on the page and in the
// editor canvas, in light and dark: axe's WCAG AA colour-contrast check must find nothing.

for (const area of ["site-light", "site-dark", "editor-light", "editor-dark"]) {
  test(`guide blocks pass AA contrast: ${area}`, async ({ page }) => {
    await page.goto("/styleguide");
    const scope = `[data-contrast="${area}"]`;
    await expect(page.locator(`${scope} [data-guide-block]`).first()).toBeVisible();
    // Open the FAQ so its answer is checked too.
    await page.locator(`${scope} details summary`).first().click();
    const { violations } = await new AxeBuilder({ page }).include(scope).withRules(["color-contrast"]).analyze();
    const found = violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary}`));
    expect(found).toEqual([]);
  });
}

test("directory stats: zero counts are hidden on the site, noted in the editor", async ({ page }) => {
  await page.goto("/styleguide");
  const site = page.locator('[data-contrast="site-light"] [data-guide-block="directoryStats"]');
  await expect(site.locator("dt")).toHaveText(["Agencies listed", "Offer YouTube ads"]);
  const editor = page.locator('[data-contrast="editor-light"] [data-guide-block="directoryStats"]');
  await expect(editor.locator("dt")).toHaveCount(3);
  await expect(editor.getByText("Hidden on the site while 0")).toHaveCount(1);
});
