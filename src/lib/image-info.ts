// Image type and size from the file's own bytes (SECURITY.md: never trust the declared type or
// extension). PNG, JPEG, WebP and GIF. No imports, so tests load this file directly.

export type ImageInfo = { type: string; ext: string; width: number | null; height: number | null };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** `gif`: also accept GIF (guide images only; logos and author photos stay PNG/JPEG/WebP). */
export function imageInfo(
  b: Uint8Array,
  { gif = false }: { gif?: boolean } = {},
): ImageInfo | null {
  // PNG: signature, then the IHDR chunk with width and height.
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 24 && PNG.every((x, i) => b[i] === x)) {
    return { type: "image/png", ext: "png", width: u32be(b, 16), height: u32be(b, 20) };
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1];
      const len = u16be(b, i + 2);
      const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (sof)
        return { type: "image/jpeg", ext: "jpg", width: u16be(b, i + 7), height: u16be(b, i + 5) };
      i += 2 + len;
    }
    return { type: "image/jpeg", ext: "jpg", width: null, height: null };
  }
  // WebP: RIFF....WEBP, then a VP8 (lossy), VP8L (lossless) or VP8X (extended) chunk.
  if (b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    const chunk = ascii(b, 12, 4);
    let width: number | null = null;
    let height: number | null = null;
    if (chunk === "VP8 ") {
      width = u16le(b, 26) & 0x3fff;
      height = u16le(b, 28) & 0x3fff;
    } else if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    } else if (chunk === "VP8X") {
      width = u24le(b, 24) + 1;
      height = u24le(b, 27) + 1;
    }
    return { type: "image/webp", ext: "webp", width, height };
  }
  // GIF: GIF87a / GIF89a, then the logical screen width and height (little-endian).
  if (gif && b.length >= 10 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) {
    return { type: "image/gif", ext: "gif", width: u16le(b, 6), height: u16le(b, 8) };
  }
  return null;
}
