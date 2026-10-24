import { defineConfig } from "@playwright/test";

// End-to-end checks against a production build (`pnpm test:e2e`). E2E_BASE_URL=https://ytagencies.com
// runs the same specs against a live site instead (no local server). PLAYWRIGHT_CHANNEL=msedge uses
// the installed Edge instead of Playwright's own Chromium.
const PORT = 3200;
const live = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: live ?? `http://localhost:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: live
    ? undefined
    : {
        // Cloudflare's documented always-pass test site key: real keys refuse localhost.
        // E2E_SKIP_BUILD=1: reuse a build made with the same test key (saves memory on small machines).
        command: process.env.E2E_SKIP_BUILD
          ? `pnpm start -p ${PORT}`
          : `pnpm build && pnpm start -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        timeout: 900_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_TURNSTILE_SITE_KEY:
            process.env.E2E_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA",
        },
      },
});
