// Get matched: which agencies a request goes to. Pure, no imports: tested.
//
// Only managed agencies (live Pro) receive requests: an unmanaged listing has nobody to answer.
// Among those: offers the industry, minimum budget fits, verified, then name. When none match,
// the request is saved unrouted and the admin follows up by hand (lib/leads.tsx).

export const MAX_MATCHES = 3;

export type MatchCandidate = {
  id: string;
  name: string;
  managed: boolean;
  inIndustry: boolean;
  minBudgetUsd: number | null;
  isVerified: boolean;
};

export function pickMatches<T extends MatchCandidate>(candidates: T[], budgetMax: number) {
  const rank = (a: T) => [
    a.inIndustry ? 1 : 0,
    a.minBudgetUsd === null || a.minBudgetUsd <= budgetMax ? 1 : 0,
    a.isVerified ? 1 : 0,
  ];
  return candidates
    .filter((a) => a.managed)
    .sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i];
      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_MATCHES);
}
