import { ConfirmClaimButton } from "@/components/forms/confirm-claim-button";
import { requireUser } from "@/lib/auth";
import { readClaimToken } from "@/lib/claims";
import { BRAND_NAME } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: { absolute: `Confirm your claim | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

export default async function VerifyClaimPage({ searchParams }: PageProps<"/claim/verify">) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  const user = await requireUser(`/claim/verify?token=${encodeURIComponent(token)}`);

  const claimId = token ? readClaimToken(token) : null;
  // RLS: users can only read their own claims, so another account's claim comes back empty.
  const supabase = await createClient();
  const { data: claim } = claimId
    ? await supabase.from("claims").select("status, agencies(name)").eq("id", claimId).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto flex max-w-reading flex-col gap-6 px-4 py-12 md:py-20">
      <h1 className="text-h1">Confirm your claim</h1>
      {!claimId ? (
        <p>This link is invalid or has expired. Open the listing and start the claim again.</p>
      ) : !claim ? (
        <p>
          This claim belongs to a different account. You&apos;re signed in as {user.email}. Sign in
          with the account you used to start the claim, then open the link again.
        </p>
      ) : claim.status !== "pending" ? (
        <p>This claim has already been {claim.status}.</p>
      ) : (
        <>
          <p>
            Confirm that you manage <strong>{claim.agencies?.name}</strong>. You&apos;ll be able to
            edit its listing and see inquiries.
          </p>
          <ConfirmClaimButton token={token} />
        </>
      )}
    </div>
  );
}
