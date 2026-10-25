// Work samples (src/lib/work-samples.ts): video links, the oEmbed check, plan limits, what a
// downgrade hides, and the click-to-play facade.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { entitlementsFor } from "../src/lib/entitlements.ts";
import {
  canAddSample,
  embedUrl,
  parseVideoUrl,
  readOEmbed,
  thumbnailUrl,
  visibleSamples,
} from "../src/lib/work-samples.ts";

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ID = "dQw4w9WgXcQ";

test("URL parsing: every YouTube video format", () => {
  for (const [url, short] of [
    [`https://www.youtube.com/watch?v=${ID}`, false],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`, false],
    [`https://m.youtube.com/watch?v=${ID}`, false],
    [`https://music.youtube.com/watch?v=${ID}`, false],
    [`www.youtube.com/watch?v=${ID}`, false],
    [`https://youtu.be/${ID}`, false],
    [`https://youtu.be/${ID}?si=abc`, false],
    [`https://www.youtube.com/shorts/${ID}`, true],
    [`https://youtube.com/shorts/${ID}?feature=share`, true],
    [`https://www.youtube.com/embed/${ID}`, false],
    [`https://www.youtube-nocookie.com/embed/${ID}`, false],
    [`https://www.youtube.com/live/${ID}`, false],
    [`  https://youtu.be/${ID}  `, false],
  ]) {
    assert.deepEqual(parseVideoUrl(url), { ok: true, id: ID, short }, url);
  }
});

test("URL parsing: anything else is refused", () => {
  for (const bad of [
    "",
    ID, // a bare id isn't a link
    "https://www.youtube.com/@goatagency",
    "https://www.youtube.com/channel/UC1234567890123456789012",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/watch?v=${ID}x`,
    `https://vimeo.com/${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://evil.example/?u=https://youtu.be/${ID}`,
    `javascript:alert(1)//youtu.be/${ID}`,
    "not a url at all",
  ]) {
    assert.equal(parseVideoUrl(bad).ok, false, bad);
  }
});

test("oEmbed: private, embedding off, removed and network errors are clear failures", () => {
  assert.match(readOEmbed(401, null, false).error, /private or its owner turned off embedding/);
  assert.match(readOEmbed(403, null, false).error, /private or its owner turned off embedding/);
  assert.match(readOEmbed(404, null, false).error, /removed or doesn't exist/);
  assert.match(readOEmbed(0, null, false).error, /couldn't check this video/);
  assert.match(readOEmbed(500, null, false).error, /couldn't check this video/);
  assert.equal(readOEmbed(200, { title: "" }, false).ok, false);
});

test("oEmbed: title saved, Shorts from the link or a tall player", () => {
  assert.deepEqual(readOEmbed(200, { title: " Our ad ", width: 200, height: 113 }, false), {
    ok: true,
    title: "Our ad",
    format: "long",
  });
  assert.equal(readOEmbed(200, { title: "A short", width: 113, height: 200 }, false).format, "short");
  assert.equal(readOEmbed(200, { title: "A short", width: 200, height: 113 }, true).format, "short");
  assert.equal(readOEmbed(200, { title: "x".repeat(300) }, false).title.length, 200);
});

test("limits: 3 on Free, 12 on Pro", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const free = entitlementsFor({ subscriptions: [], verificationApproved: false, now });
  const pro = entitlementsFor({
    subscriptions: [{ plan_id: "pro", status: "active", starts_at: "2026-01-01T00:00:00Z", ends_at: null }],
    verificationApproved: false,
    now,
  });
  assert.equal(free.workSamples, 3);
  assert.equal(pro.workSamples, 12);
  assert.equal(canAddSample(2, free.workSamples), true);
  assert.equal(canAddSample(3, free.workSamples), false);
  assert.equal(canAddSample(11, pro.workSamples), true);
  assert.equal(canAddSample(12, pro.workSamples), false);
  // The database's hard ceiling matches Pro.
  assert.match(read("supabase/schema.sql"), /from work_samples where agency_id = new\.agency_id\) >= 12/);
});

test("a downgrade keeps the first 3 visible and hides the rest without deleting", () => {
  const samples = Array.from({ length: 7 }, (_, i) => ({
    id: `s${i}`,
    sort_order: 6 - i,
    hidden_at: null,
    created_at: `2026-10-0${i + 1}T00:00:00Z`,
  }));
  assert.deepEqual(
    visibleSamples(samples, 3).map((s) => s.id),
    ["s6", "s5", "s4"],
  );
  assert.equal(visibleSamples(samples, 12).length, 7);
  assert.equal(samples.length, 7); // nothing removed
  // An admin-hidden sample never shows and doesn't use a slot.
  samples[0].hidden_at = "2026-10-20T00:00:00Z"; // s0, last in order
  samples[1].hidden_at = "2026-10-20T00:00:00Z"; // s1
  assert.equal(visibleSamples(samples, 12).length, 5);
  samples[6].hidden_at = "2026-10-20T00:00:00Z"; // s6, first in order
  assert.deepEqual(
    visibleSamples(samples, 3).map((s) => s.id),
    ["s5", "s4", "s3"],
  );
});

test("facade: no iframe before the click, the no-cookie player after", () => {
  const src = read("src/components/agency/work-samples-grid.tsx");
  const facade = src.slice(src.indexOf("export function Facade"));
  assert.match(facade, /const \[playing, setPlaying\] = useState\(false\);/);
  // The only iframe is behind `if (playing)`; before that it's a button with the thumbnail.
  assert.equal((facade.match(/<iframe/g) ?? []).length, 1);
  assert.ok(facade.indexOf("if (playing)") < facade.indexOf("<iframe"));
  assert.match(facade, /onClick=\{\(\) => setPlaying\(true\)\}/);
  assert.equal(embedUrl(ID).startsWith("https://www.youtube-nocookie.com/embed/"), true);
  assert.equal(thumbnailUrl(ID), `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  // No VideoObject schema, no view counts.
  const page = read("src/app/(marketing)/agency/[slug]/page.tsx");
  assert.doesNotMatch(page, /VideoObject/);
  assert.doesNotMatch(src, /viewCount|views/);
});

test("CSP and images allow the thumbnail host and the no-cookie player", () => {
  const config = read("next.config.ts");
  assert.match(config, /const YT_THUMBS = "https:\/\/i\.ytimg\.com";/);
  assert.match(config, /`frame-src \$\{YT_PLAYER\}`/);
  assert.match(config, /hostname: "i\.ytimg\.com"/);
});
