// Get matched: which agencies a request goes to. Pure, no imports: tested.
//
// Only managed agencies (live Pro) receive requests: an unmanaged listing has nobody to answer.
// Candidates already offer the service; they must also work in the industry. Among those:
// minimum project fits the budget first ("Not sure yet" skips this), then the directory's merit
// order (Verified, quality score, name; Sponsored doesn't apply). At most 3. None leaves the
// request unrouted: it's saved, the admin is emailed and follows up by hand (lib/leads.tsx).

export const MAX_MATCHES = 3;

export type MatchCandidate = {
  id: string;
  name: string;
  managed: boolean;
  inIndustry: boolean;
  minBudgetUsd: number | null;
  isVerified: boolean;
  quality: number;
};

/** `budgetMax`: the top of the chosen range; Infinity for $10k+ and "Not sure yet". */
export function pickMatches<T extends MatchCandidate>(candidates: T[], budgetMax: number) {
  const fits = (a: T) => a.minBudgetUsd === null || a.minBudgetUsd <= budgetMax;
  return candidates
    .filter((a) => a.managed && a.inIndustry)
    .sort(
      (a, b) =>
        Number(fits(b)) - Number(fits(a)) ||
        Number(b.isVerified) - Number(a.isVerified) ||
        b.quality - a.quality ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_MATCHES);
}
