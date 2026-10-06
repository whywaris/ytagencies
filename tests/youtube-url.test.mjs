// YouTube channel URL parsing for verification (src/lib/youtube-url.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseChannelUrl } from "../src/lib/youtube-url.ts";

const ID = "UC_x5XG1OV2P6uZZ5FSM9Ttw";

test("handles", () => {
  for (const input of [
    "https://www.youtube.com/@GoogleDevelopers",
    "youtube.com/@GoogleDevelopers/videos",
    "https://m.youtube.com/@GoogleDevelopers?si=abc",
    "@GoogleDevelopers",
  ]) {
    assert.deepEqual(
      parseChannelUrl(input),
      { ok: true, ref: { kind: "handle", value: "@GoogleDevelopers" } },
      input,
    );
  }
});

test("channel ids", () => {
  assert.deepEqual(parseChannelUrl(`https://www.youtube.com/channel/${ID}`), {
    ok: true,
    ref: { kind: "id", value: ID },
  });
  assert.deepEqual(parseChannelUrl(`youtube.com/channel/${ID}/featured`), {
    ok: true,
    ref: { kind: "id", value: ID },
  });
  assert.deepEqual(parseChannelUrl(ID), { ok: true, ref: { kind: "id", value: ID } });
});

test("legacy /user/ names", () => {
  assert.deepEqual(parseChannelUrl("https://www.youtube.com/user/GoogleDevelopers"), {
    ok: true,
    ref: { kind: "username", value: "GoogleDevelopers" },
  });
});

test("refused: /c/, other sites, videos, junk", () => {
  for (const input of [
    "https://www.youtube.com/c/GoogleDevelopers",
    "https://vimeo.com/@someone",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/@handle",
    "https://www.youtube.com/channel/not-an-id",
    "",
    "   ",
  ]) {
    assert.equal(parseChannelUrl(input).ok, false, input);
  }
  assert.match(parseChannelUrl("https://www.youtube.com/c/Name").error, /@handle/);
});
