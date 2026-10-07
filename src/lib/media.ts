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
