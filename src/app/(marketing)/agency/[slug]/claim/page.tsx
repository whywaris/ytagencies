import Link from "next/link";
import { notFound } from "next/navigation";

import { ClaimForm } from "@/components/forms/claim-form";
import { requireUser } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: { absolute: `Claim a listing | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

function hostOf(website: string | null) {
  try {
    return website ? new URL(website).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export default async function ClaimPage({ params }: PageProps<"/agency/[slug]/claim">) {
  const { slug } = await params;
  const user = await requireUser(`/agency/${slug}/claim`);
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, slug, name, website, is_claimed, owner_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!agency) notFound();

  const { data: openClaim } = await supabase
    .from("claims")
    .select("work_email")
    .eq("agency_id", agency.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  const domain = hostOf(agency.website);

  return (
    <div className="mx-auto flex max-w-reading flex-col gap-8 px-4 py-12 md:py-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">Claim {agency.name}</h1>
        <p className="text-text-2">
          Claiming links this listing to your account. With Pro you can then edit it, add case
          studies and receive inquiries.
        </p>
      </header>

      {agency.owner_id === user.id ? (
        <p>
          You already manage this listing.{" "}
          <Link href={`/dashboard/${agency.id}`} className="text-accent hover:underline">
            Go to your dashboard
          </Link>
        </p>
      ) : agency.is_claimed ? (
        <p>
          This listing has already been claimed. If you think that&apos;s wrong, reply to any of our
          emails.
        </p>
      ) : openClaim ? (
        <p>
          You have an open claim using {openClaim.work_email}. Check that inbox for a confirmation
          link, or wait for our review.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {domain ? (
              <p>
                Use an email address on <strong>{domain}</strong> and we&apos;ll send you a
                confirmation link. Other addresses go to manual review, which can take a few
                business days.
              </p>
            ) : (
              <p>We&apos;ll review your claim by hand, which can take a few business days.</p>
            )}
            <p className="text-small">Signed in as {user.email}.</p>
          </div>
          <ClaimForm agencySlug={agency.slug} domain={domain} />
        </>
      )}
    </div>
  );
}
