import { Paywall } from "@/components/dashboard/paywall";
import { RequestVerification } from "@/components/dashboard/request-verification";
import { dashboardContext } from "@/lib/data/dashboard";
import { NO_OWN_DOMAIN, ownDomain } from "@/lib/work-email";

export const metadata = { title: "Verification" };

export default async function VerificationPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[slug]/verification">) {
  const ctx = await dashboardContext((await params).slug);
  const { agency, supabase, e } = ctx;
  const confirmed = (await searchParams).status === "email-confirmed";
  if (!e.managed && !e.verifiedBadge)
    return (
      <Paywall ctx={ctx} unlocks="With Pro you can ask us to verify your agency for the badge." />
    );
  const [{ data, error }, { data: site }] = await Promise.all([
    supabase
      .from("verifications")
      .select("status, verified_domain, created_at")
      .eq("agency_id", agency.id)
      .in("status", ["email_pending", "requested", "approved"]),
    supabase.from("agencies").select("website").eq("id", agency.id).maybeSingle(),
  ]);
  if (error) throw new Error("Couldn't load verification");
  const approved = data.some((v) => v.status === "approved");
  const requested = data.find((v) => v.status === "requested");
  const waiting = data.find((v) => v.status === "email_pending");
  const domain = ownDomain(site?.website);

  return (
    <section aria-labelledby="verification" className="flex flex-col gap-4">
      <h2 id="verification" className="text-h2">
        Verified badge
      </h2>
      {approved ? (
        <p>Your agency is verified. The badge shows on your profile and in the directory.</p>
      ) : requested ? (
        <p role={confirmed ? "status" : undefined} className="max-w-reading">
          {confirmed ? "Thanks, your email is confirmed. " : ""}Your request is in review. We
          checked that you have an email at {requested.verified_domain ?? "your domain"}; now we
          check your website, your YouTube channels and that your business is real, and email you
          when it&apos;s decided.
        </p>
      ) : !domain ? (
        <p className="max-w-reading text-text-2">
          {NO_OWN_DOMAIN} Add your agency&apos;s website in Profile (not a site-builder, social or
          marketplace link), then come back. Your listing and Pro keep working either way.
        </p>
      ) : (
        <>
          <p className="max-w-reading text-text-2">
            Verified agencies prove they own their domain: we send a one-time link to a work email
            at {domain}. Then we check your website, your YouTube channels and that your business is
            real. The badge can&apos;t be bought.
          </p>
          {waiting && (
            <p
              role="status"
              className="max-w-reading rounded-lg border border-line bg-surface px-4 py-3"
            >
              Check your inbox at your {waiting.verified_domain ?? domain} email and click the link
              (it works once, for 24 hours). Your request goes to review after that. Didn&apos;t get
              it? Send it again below.
            </p>
          )}
          <RequestVerification agencyId={agency.id} domain={domain} resend={!!waiting} />
        </>
      )}
    </section>
  );
}
