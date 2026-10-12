// YouTube channel URL parsing for verification (src/lib/youtube-url.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseChannelUrl, resolveChannelId } from "../src/lib/youtube-url.ts";

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

// Case study links → channel ID, against a mocked YouTube Data API.
function mockApi(channels) {
  const calls = [];
  const fetcher = async (url) => {
    const params = new URL(url).searchParams;
    calls.push(Object.fromEntries(params));
    const id = channels[params.get("forHandle") ?? params.get("forUsername")];
    return new Response(JSON.stringify(id ? { items: [{ id }] } : {}), { status: 200 });
  };
  return { calls, fetcher };
}

test("resolveChannelId: @handle, /c/ and /user/ links are looked up once", async () => {
  const api = mockApi({ "@GoogleDevelopers": ID, GoogleDevelopers: ID });
  for (const link of [
    "https://www.youtube.com/@GoogleDevelopers",
    "https://www.youtube.com/c/GoogleDevelopers/videos",
    "https://www.youtube.com/user/GoogleDevelopers",
  ]) {
    assert.equal(await resolveChannelId(link, "test-key", api.fetcher), ID, link);
  }
  assert.equal(api.calls.length, 3);
  assert.deepEqual(api.calls[0], { part: "id", key: "test-key", forHandle: "@GoogleDevelopers" });
  assert.equal(api.calls[1].forHandle, "@GoogleDevelopers");
  assert.equal(api.calls[2].forUsername, "GoogleDevelopers");
});

test("resolveChannelId: /channel/ links need no API call", async () => {
  const api = mockApi({});
  assert.equal(
    await resolveChannelId(`https://www.youtube.com/channel/${ID}`, undefined, api.fetcher),
    ID,
  );
  assert.equal(api.calls.length, 0);
});

test("resolveChannelId: null when it can't be resolved", async () => {
  const api = mockApi({});
  assert.equal(await resolveChannelId("https://www.youtube.com/@nobody", "k", api.fetcher), null);
  assert.equal(
    await resolveChannelId("https://www.youtube.com/@x1x", undefined, api.fetcher),
    null,
  );
  assert.equal(await resolveChannelId("https://vimeo.com/@someone", "k", api.fetcher), null);
  const failing = async () => new Response("{}", { status: 403 });
  assert.equal(await resolveChannelId("https://www.youtube.com/@abc", "k", failing), null);
  const offline = async () => {
    throw new Error("offline");
  };
  assert.equal(await resolveChannelId("https://www.youtube.com/@abc", "k", offline), null);
  const bogus = async () => new Response(JSON.stringify({ items: [{ id: "not-an-id" }] }));
  assert.equal(await resolveChannelId("https://www.youtube.com/@abc", "k", bogus), null);
  assert.equal(api.calls.length, 1);
});
