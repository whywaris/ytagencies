// Agency logos: a full https link (Cloudflare R2, MEDIA_HOSTS; set in admin) or a path in the
// agency-media bucket (uploaded from the dashboard). No imports: server, client and tests use it.

const LOGO_BUCKET = "agency-media";

/** The image URL for a stored logo value, or null when there's none. */
export function logoSrc(logoPath: string | null | undefined) {
  const v = logoPath?.trim();
  if (!v) return null;
  if (v.startsWith("https://")) return v;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${v}`;
}

/** "Acme Video Co" → "AV": the tile shown when there's no logo or it fails to load. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
