// The signed-in account as the header shows it. Pure, no imports: tested.

export type Account = {
  /** full_name / name from the sign-in provider, else the part of the email before "@". */
  name: string;
  email: string;
  /** Google profile photo, only from the host the CSP and next/image allow. */
  avatarUrl: string | null;
  /** First letter of the name (or email), for the fallback avatar. */
  initial: string;
};

/** Google profile photos (lh3.googleusercontent.com): next.config images + CSP img-src. */
export const AVATAR_HOST = "lh3.googleusercontent.com";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function accountFrom(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Account {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const name = str(meta.full_name) ?? str(meta.name) ?? (email.split("@")[0] || "Account");
  const photo = str(meta.avatar_url) ?? str(meta.picture);
  let avatarUrl: string | null = null;
  try {
    if (photo && new URL(photo).protocol === "https:" && new URL(photo).hostname === AVATAR_HOST)
      avatarUrl = photo;
  } catch {}
  return { name, email, avatarUrl, initial: (name[0] ?? email[0] ?? "?").toUpperCase() };
}
