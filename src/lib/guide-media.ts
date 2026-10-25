// Where guide images may come from: the guide-media bucket, and guides/ in agency-media (images
// uploaded before the Tiptap editor). Anything else is dropped by the renderer and the sanitizer
// (and the CSP would block it anyway). No imports.

const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
export const GUIDE_MEDIA_BUCKET = "guide-media";
export const GUIDE_MEDIA_PREFIX = `${STORAGE}${GUIDE_MEDIA_BUCKET}/`;
const LEGACY_PREFIX = `${STORAGE}agency-media/guides/`;

export const guideImageAllowed = (src: string) =>
  src.startsWith(GUIDE_MEDIA_PREFIX) || src.startsWith(LEGACY_PREFIX);

/** Public URL of an object in guide-media. */
export const guideMediaUrl = (path: string) => `${GUIDE_MEDIA_PREFIX}${path}`;

/** Each path segment percent-encoded exactly once, whether it arrives raw ("a b") or encoded ("a%20b"). */
const encodeOnce = (path: string) =>
  path
    .split("/")
    .map((seg) => {
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg); // a stray "%": take it literally
      }
    })
    .join("/");

/**
 * Public URL of an image: a pasted https link (covers hosted on Cloudflare, see lib/media.ts), else
 * a file in the agency-media bucket (older uploads, guide images, author photos). The path is
 * encoded once, so a name with spaces never reaches next/image as "%2520".
 */
export function mediaUrl(path: string) {
  if (!path.startsWith("https://")) return `${STORAGE}agency-media/${encodeOnce(path)}`;
  try {
    const u = new URL(path);
    return `${u.origin}${encodeOnce(u.pathname)}${u.search}`;
  } catch {
    return path;
  }
}
