import "server-only";

import type { ChannelRef } from "@/lib/youtube-url";

// YouTube Data API v3 (ADMIN_V2_SPEC §5.4). YOUTUBE_API_KEY is server-only (SECURITY.md).
// channels.list costs 1 quota unit per call.

export type ChannelStats = {
  channelId: string;
  title: string;
  url: string;
  /** null when the channel hides its subscriber count. */
  subscribers: number | null;
  views: number;
  videos: number;
  publishedAt: string;
};

export type ChannelResult = { input: string } & (
  { ok: true; stats: ChannelStats } | { ok: false; error: string }
);

/** What verifications.stats_snapshot holds: the latest check plus up to 24 earlier ones. */
export type StatsSnapshot = {
  latest: { fetchedAt: string; channels: ChannelStats[] };
  history: { fetchedAt: string; channels: ChannelStats[] }[];
};

export const SNAPSHOT_HISTORY = 24;

type ApiChannel = {
  id: string;
  snippet: { title: string; publishedAt: string; customUrl?: string };
  statistics: {
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    viewCount?: string;
    videoCount?: string;
  };
};

export const youtubeConfigured = () => !!process.env.YOUTUBE_API_KEY;

export async function fetchChannel(ref: ChannelRef): Promise<ChannelStats | string> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return "YOUTUBE_API_KEY isn't set, so stats can't be fetched.";
  const params = new URLSearchParams({ part: "snippet,statistics", key });
  if (ref.kind === "id") params.set("id", ref.value);
  else if (ref.kind === "handle") params.set("forHandle", ref.value);
  else params.set("forUsername", ref.value);

  let body: { items?: ApiChannel[]; error?: { message?: string } };
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    body = await res.json();
    if (!res.ok) return `YouTube refused the request (${res.status}). Check the API key and quota.`;
  } catch {
    return "Couldn't reach YouTube. Try again.";
  }
  const c = body.items?.[0];
  if (!c) return "No channel found at that address.";
  const n = (v: string | undefined) => (v ? Number(v) : 0);
  return {
    channelId: c.id,
    title: c.snippet.title,
    url: `https://www.youtube.com/channel/${c.id}`,
    subscribers: c.statistics.hiddenSubscriberCount ? null : n(c.statistics.subscriberCount),
    views: n(c.statistics.viewCount),
    videos: n(c.statistics.videoCount),
    publishedAt: c.snippet.publishedAt,
  };
}

/** Appends a check to a snapshot, keeping the newest SNAPSHOT_HISTORY earlier ones. */
export function withCheck(
  previous: StatsSnapshot | null,
  channels: ChannelStats[],
  at = new Date(),
) {
  const check = { fetchedAt: at.toISOString(), channels };
  return {
    latest: check,
    history: previous ? [previous.latest, ...previous.history].slice(0, SNAPSHOT_HISTORY) : [],
  } satisfies StatsSnapshot;
}
