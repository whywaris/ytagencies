// AdSense: connected always, but no third-party script or wider CSP until it's switched on.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ADSENSE_CLIENT, adsEnabled } from "../src/lib/ads.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("ads run only when switched on, on Production", () => {
  assert.equal(adsEnabled({}), false);
  assert.equal(adsEnabled({ VERCEL_ENV: "production" }), false);
  assert.equal(adsEnabled({ NEXT_PUBLIC_ADS_ENABLED: "1", VERCEL_ENV: "preview" }), false);
  assert.equal(adsEnabled({ NEXT_PUBLIC_ADS_ENABLED: "0", VERCEL_ENV: "production" }), false);
  assert.equal(adsEnabled({ NEXT_PUBLIC_ADS_ENABLED: "1 ", VERCEL_ENV: "production" }), true);
});

test("the account ID matches ads.txt, and the script is on guide articles only", () => {
  assert.ok(read("public/ads.txt").includes(ADSENSE_CLIENT.replace("ca-", "")));
  assert.match(read("src/app/layout.tsx"), /"google-adsense-account": ADSENSE_CLIENT/);
  assert.match(read("src/app/(marketing)/guides/[slug]/page.tsx"), /\{adsEnabled\(\) && \(\n\s+<Script/);
  assert.doesNotMatch(read("src/app/layout.tsx"), /adsbygoogle/);
  assert.doesNotMatch(read("src/app/(marketing)/layout.tsx"), /adsbygoogle/);
});

test("the CSP gains ad hosts only when ads are on", () => {
  const c = read("next.config.ts");
  for (const name of ["ADS_SCRIPT", "ADS_IMG", "ADS_CONNECT", "ADS_FRAME"]) {
    assert.match(c, new RegExp(`const ${name} = ads\\n\\s+\\? "[^"]+"\\n\\s+: "";`), name);
    assert.ok(c.includes(`\${${name}}`), name);
  }
});

test("the policies say what the site does", () => {
  for (const p of ["src/app/(marketing)/privacy/page.tsx", "src/app/(marketing)/cookies/page.tsx"]) {
    const s = read(p);
    assert.doesNotMatch(s, /run no ads|or show ads|No advertising cookies/, p);
    assert.match(s, /Google asks for your consent first/, p);
  }
});
