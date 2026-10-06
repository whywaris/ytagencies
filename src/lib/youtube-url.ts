// YouTube channel URLs for verification (ADMIN_V2_SPEC §5.4). Accepts the forms the Data API can
// resolve exactly: channel ID, @handle and legacy /user/ names. Legacy /c/custom URLs can't be
// looked up directly, so they're reported back with a request for the @handle. No imports: tested.

export type ChannelRef =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string };

export type ParsedChannel = { ok: true; ref: ChannelRef } | { ok: false; error: string };

const CHANNEL_ID = /^UC[\w-]{22}$/;
const HANDLE = /^@[\w.-]{3,30}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

export function parseChannelUrl(raw: string): ParsedChannel {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Paste a channel URL." };
  if (HANDLE.test(input)) return { ok: true, ref: { kind: "handle", value: input } };
  if (CHANNEL_ID.test(input)) return { ok: true, ref: { kind: "id", value: input } };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, error: "That isn't a URL." };
  }
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: "Use a youtube.com channel URL." };
  }
  const [first, second] = url.pathname.split("/").filter(Boolean);
  const handle = first ? decodeURIComponent(first) : "";
  if (HANDLE.test(handle)) return { ok: true, ref: { kind: "handle", value: handle } };
  if (first === "channel" && second && CHANNEL_ID.test(second)) {
    return { ok: true, ref: { kind: "id", value: second } };
  }
  if (first === "user" && second && /^[\w.-]{1,100}$/.test(second)) {
    return { ok: true, ref: { kind: "username", value: second } };
  }
  if (first === "c") {
    return {
      ok: false,
      error: "Custom /c/ URLs can't be looked up. Use the channel's @handle or /channel/ URL.",
    };
  }
  return { ok: false, error: "Use a channel URL: /@handle, /channel/UC… or /user/name." };
}
