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
