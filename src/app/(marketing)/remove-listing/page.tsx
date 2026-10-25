import type { Metadata } from "next";

import { RemovalForm } from "@/components/forms/removal-form";
import { validRemoveLink } from "@/lib/outreach";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// "Remove my listing", linked from outreach emails (signed per agency, lib/outreach.tsx). Not
// indexed. The request lands in Admin → Inbox; an admin archives the listing.

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Remove a listing",
  robots: { index: false, follow: false },
};

export default async function RemoveListingPage({ searchParams }: PageProps<"/remove-listing">) {
  const sp = await searchParams;
  const a = typeof sp.a === "string" ? sp.a : "";
  const t = typeof sp.t === "string" ? sp.t.slice(0, 100) : "";
  const valid = validRemoveLink(a, t);
  const agency = valid
    ? (await createAdminClient().from("agencies").select("name, status").eq("id", a).maybeSingle()).data
    : null;

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5 px-4 py-14 md:px-6">
      <h1 className="text-h2">Remove a listing</h1>
      {!agency ? (
        <p className="text-text-2">
          This link isn&apos;t valid any more. Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>{" "}
          and tell us which listing to remove.
        </p>
      ) : agency.status === "archived" ? (
        <p className="text-text-2">{agency.name} is no longer listed on {BRAND_NAME}.</p>
      ) : (
        <>
          <p className="text-text-2">
            Ask us to remove <b className="text-text">{agency.name}</b> from {BRAND_NAME}. To check
            it&apos;s really you, use an email address on the agency&apos;s own website domain.
          </p>
          <RemovalForm agencyId={a} token={t} agencyName={agency.name} />
        </>
      )}
    </div>
  );
}
