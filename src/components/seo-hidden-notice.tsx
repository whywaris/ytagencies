import { list } from "@/lib/profile-copy";
import { thinProfileMissing } from "@/lib/profile-seo";

/**
 * "Hidden from Google until you add: …" for thin profiles (docs/SEO.md). Shown on the agency's
 * dashboard and in Admin → Agencies; nothing when the profile is indexable. Saving the profile
 * revalidates the page and the sitemap, so it's re-indexed once fixed.
 */
export function SeoHiddenNotice({
  profile,
  className,
}: {
  profile: { description: string; bestFor: string; industries: string[]; minBudget: string };
  className?: string;
}) {
  const missing = thinProfileMissing({
    hasDescription: profile.description.trim() !== "",
    hasBestFor: profile.bestFor.trim() !== "",
    industries: profile.industries.length,
    hasPrice: profile.minBudget.trim() !== "",
  });
  if (!missing.length) return null;
  return (
    <p
      role="status"
      className={
        className ??
        "rounded-lg border border-line bg-(--amber-soft) px-4 py-3 text-[15px] text-text"
      }
    >
      <span className="font-semibold">Hidden from Google until you add:</span> {list(missing)}.
    </p>
  );
}
