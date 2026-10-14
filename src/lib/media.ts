// Pasted image links (guide covers) must come from our own image host on Cloudflare, listed in
// MEDIA_HOSTS (comma-separated host names, e.g. "images.ytagencies.com"). next.config.ts uses the
// same list for the CSP img-src and next/image. No imports, so tests and next.config load it.

export function mediaHosts(raw = process.env.MEDIA_HOSTS) {
  return (raw ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h));
}

/** Why a pasted image link can't be used, or null when it's fine. */
export function imageLinkError(link: string, hosts = mediaHosts()) {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return "Paste the full image link, starting with https://.";
  }
  if (url.protocol !== "https:") return "Use an https:// link.";
  if (!hosts.length) return "No image host is set up yet (MEDIA_HOSTS).";
  if (!hosts.includes(url.hostname)) return `Use an image hosted on ${hosts.join(" or ")}.`;
  if (url.username || url.password) return "That link can't contain a login.";
  return null;
}

/** Logos and guide covers set by URL: raster images only, at most 1 MB. */
export const MAX_LINKED_IMAGE_BYTES = 1024 * 1024;
const RASTER = /\.(png|webp|jpe?g)$/i;

/**
 * Why an image link (agency logo, guide cover) can't be used, before fetching it: https only, a
 * host in MEDIA_HOSTS, a .png/.webp/.jpg/.jpeg file (no SVG: it can carry scripts). Null when fine.
 */
export function linkedImageError(link: string, hosts = mediaHosts()) {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return "Paste the full image link, starting with https://.";
  }
  if (url.protocol !== "https:") return "Use an https:// link.";
  if (url.username || url.password) return "That link can't contain a login.";
  if (!hosts.length)
    return "No image host is set up yet. Add MEDIA_HOSTS (e.g. media.ytagencies.com) and redeploy.";
  if (!hosts.includes(url.hostname))
    return `This host isn't allowed. Use a ${hosts.join(" or ")} link.`;
  if (/\.svg$/i.test(url.pathname)) return "SVG isn't supported. Use a PNG, WebP or JPG image.";
  if (!RASTER.test(url.pathname)) return "Use a link ending in .png, .webp, .jpg or .jpeg.";
  return null;
}

/**
 * The link checks above, then a HEAD request: 200, an image/* content type, at most 1 MB.
 * `fetchFn` is injectable for tests. Hosts are limited to MEDIA_HOSTS, so this only ever asks
 * our own image host.
 */
export async function checkLinkedImage(
  link: string,
  { hosts = mediaHosts(), fetchFn = fetch }: { hosts?: string[]; fetchFn?: typeof fetch } = {},
): Promise<string | null> {
  const problem = linkedImageError(link, hosts);
  if (problem) return problem;
  let res: Response;
  try {
    res = await fetchFn(link.trim(), {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return "We couldn't reach that image. Check the link and try again.";
  }
  if (res.status !== 200)
    return `That link returned ${res.status}, not an image. Check the file is public.`;
  if (!/^image\//i.test(res.headers.get("content-type") ?? "")) return "That link isn't an image.";
  const size = Number(res.headers.get("content-length"));
  if (!size) return "We couldn't tell the image's size. Check the link and try again.";
  if (size > MAX_LINKED_IMAGE_BYTES) return "That image is over 1 MB. Use a smaller file.";
  return null;
}
