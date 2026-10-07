// Image type and size sniffing (src/lib/image-info.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { imageInfo } from "../src/lib/image-info.ts";

const bytes = (...parts) => Uint8Array.from(parts.flat());
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n) => [(n >> 8) & 255, n & 255];

test("PNG: type and size from IHDR", () => {
  const png = bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    be32(13),
    [0x49, 0x48, 0x44, 0x52],
    be32(1200),
    be32(630),
  );
  assert.deepEqual(imageInfo(png), { type: "image/png", ext: "png", width: 1200, height: 630 });
});

test("JPEG: size from the first SOF segment after other segments", () => {
  const app0 = [0xff, 0xe0, ...be16(6), 0, 0, 0, 0];
  const sof0 = [0xff, 0xc0, ...be16(17), 8, ...be16(480), ...be16(640), 3, 0, 0, 0, 0, 0, 0];
  const jpg = bytes([0xff, 0xd8], app0, sof0);
  assert.deepEqual(imageInfo(jpg), { type: "image/jpeg", ext: "jpg", width: 640, height: 480 });
});

test("WebP VP8X: 24-bit sizes minus one", () => {
  const w = 1599,
    h = 899; // stored as value - 1
  const webp = bytes(
    [..."RIFF"].map((c) => c.charCodeAt(0)),
    [0, 0, 0, 0],
    [..."WEBPVP8X"].map((c) => c.charCodeAt(0)),
    [10, 0, 0, 0],
    [0, 0, 0, 0],
    [w & 255, (w >> 8) & 255, w >> 16],
    [h & 255, (h >> 8) & 255, h >> 16],
  );
  assert.deepEqual(imageInfo(webp), { type: "image/webp", ext: "webp", width: 1600, height: 900 });
});

test("anything else is refused, whatever its name", () => {
  assert.equal(imageInfo(bytes([..."<svg onload=alert(1)>"].map((c) => c.charCodeAt(0)))), null);
  assert.equal(imageInfo(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), null); // GIF
  assert.equal(imageInfo(new Uint8Array()), null);
});
