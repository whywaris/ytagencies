// Who can claim a listing, in one place: the profile's claim bar, /claim/<slug> and the claim
// server actions (lib/actions/claims.tsx). Pure, no imports: tested.
//
// is_claimed is set together with owner_id whenever a claim or submission is approved, and anon
// can read it (owner_id is private), so the static profile can use it. Pending claims change
// nothing. Once claimed it stays claimed, even if the owner's Pro lapses.

export type ClaimState = "open" | "managed" | "unlisted";

export const claimState = (a: { status: string; isClaimed: boolean }): ClaimState =>
  a.status !== "published" ? "unlisted" : a.isClaimed ? "managed" : "open";

/** The profile shows "Is this your agency? Claim it…" only while nobody owns the listing. */
export const showClaimBar = (a: { status: string; isClaimed: boolean }) => claimState(a) === "open";

export const alreadyManagedMessage = (email: string) =>
  `This listing is already managed by its owner. If you think this is a mistake, email ${email}.`;
