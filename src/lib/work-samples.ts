// Work samples: YouTube videos an agency worked on (work_samples). Video URL parsing, the oEmbed
// check, and which samples a profile shows. No imports: tested (tests/work-samples.test.mjs).

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const NOTE_MAX = 140;

const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const NOCOOKIE = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);

export type ParsedVideo = { ok: true; id: string; short: boolean } | { ok: false; error: string };

/**
 * A YouTube video link: watch?v=, youtu.be/, /shorts/, /embed/, /live/ and /v/, on youtube.com,
 * m., music., youtube-nocookie.com or youtu.be. Anything else (channels, playlists, other sites,
 * a bare ID) is refused.
 */
export function parseVideoUrl(raw: string): ParsedVideo {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Paste a YouTube video link." };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, error: "That isn't a link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { ok: false, error: "That isn't a link." };
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const found = (id: string | null | undefined, short = false): ParsedVideo =>
    id && VIDEO_ID.test(id)
      ? { ok: true, id, short }
      : { ok: false, error: "That link doesn't point to a YouTube video." };

  if (host === "youtu.be") return found(parts[0]);
  if (HOSTS.has(host)) {
    if (parts[0] === "watch") return found(url.searchParams.get("v"));
    if (parts[0] === "shorts") return found(parts[1], true);
    if (parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") return found(parts[1]);
    return { ok: false, error: "Use a link to one video, not a channel or playlist." };
  }
  if (NOCOOKIE.has(host) && parts[0] === "embed") return found(parts[1]);
  return { ok: false, error: "Use a youtube.com or youtu.be video link." };
}

/** The oEmbed endpoint for a video (public, no API key). */
export const oembedUrl = (id: string) =>
  `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;

export type OEmbedResult =
  | { ok: true; title: string; format: "long" | "short" }
  | { ok: false; error: string };

/**
 * What a YouTube oEmbed response means. 401/403: private, or embedding turned off. 404: removed
 * or never existed. A Short is a /shorts/ link or a player taller than it is wide.
 */
export function readOEmbed(status: number, body: unknown, shortLink: boolean): OEmbedResult {
  if (status === 401 || status === 403)
    return {
      ok: false,
      error: "This video is private or its owner turned off embedding, so it can't be shown.",
    };
  if (status === 404 || status === 400)
    return { ok: false, error: "This video was removed or doesn't exist." };
  if (status !== 200 || !body || typeof body !== "object")
    return { ok: false, error: "We couldn't check this video with YouTube. Please try again." };
  const b = body as { title?: unknown; width?: unknown; height?: unknown };
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return { ok: false, error: "We couldn't check this video with YouTube. Please try again." };
  const tall = typeof b.width === "number" && typeof b.height === "number" && b.height > b.width;
  return { ok: true, title, format: shortLink || tall ? "short" : "long" };
}

/** Thumbnail (i.ytimg.com, 480×360) and the click-to-play player (no cookies until played). */
export const thumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const embedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;

/**
 * What a profile shows: samples an admin hasn't hidden, in the agency's order, up to the plan's
 * limit (3 on Free, 12 on Pro). Extras past the limit stay saved and come back with Pro.
 */
export function visibleSamples<T extends { sort_order: number; hidden_at: string | null; created_at: string }>(
  samples: T[],
  limit: number,
) {
  return samples
    .filter((s) => !s.hidden_at)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .slice(0, Math.max(0, limit));
}

/** Can the owner add another? Every saved sample counts, hidden ones included. */
export const canAddSample = (saved: number, limit: number) => saved < limit;
