// The site used to be a directory of YouTube agencies. Those pages are gone for good: the proxy
// answers 410 (Gone), so search engines drop them quickly. Pure: no imports, tested.
// Service pages were always /<something>-agencies, with any sub-path (/for-x, /in-y, /for-x/in-y).
const REMOVED = [
  /^\/[a-z0-9-]+-agencies(\/|$)/,
  /^\/(agency|agencies|industries|locations|claim|dashboard)(\/|$)/,
  /^\/(list-your-agency|for-agencies)(\/|$)/,
  /^\/(pricing|refunds|how-we-rank|request-proposals|get-matched|remove-listing|report-listing|no-access|disclosure)\/?$/,
  /^\/og\/(agency|service)(\/|$)/,
  /^\/badge(-verified)?\.svg$/,
];

export const isRemovedPath = (pathname: string) => REMOVED.some((r) => r.test(pathname));

/** A link (relative or absolute, on this site) to a removed page. siteHost: "ytagencies.com". */
export function isRemovedHref(href: string, siteHost: string) {
  let url: URL;
  try {
    url = new URL(href, `https://${siteHost}`);
  } catch {
    return false;
  }
  return url.host.replace(/^www\./, "") === siteHost && isRemovedPath(url.pathname);
}

/** The 410 page: plain HTML, so it needs nothing else to render. */
export function removedPage(home: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>This page was removed</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 16px;color:#141928;background:#fbfbfd}a{color:#3b5bdb}@media(prefers-color-scheme:dark){body{color:#eef0f6;background:#0f1117}a{color:#8ea2ff}}</style></head><body><h1>This page was removed</h1><p>We no longer run the agency directory. Our guides on YouTube for businesses and creators are still here.</p><p><a href="${home}/guides">Read the guides</a></p></body></html>`;
}
