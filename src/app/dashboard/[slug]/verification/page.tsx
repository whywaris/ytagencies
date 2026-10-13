import { Paywall } from "@/components/dashboard/paywall";
import { RequestVerification } from "@/components/dashboard/request-verification";
import { dashboardContext } from "@/lib/data/dashboard";

export const metadata = { title: "Verification" };

export default async function VerificationPage({
  params,
}: PageProps<"/dashboard/[slug]/verification">) {
  const ctx = await dashboardContext((await params).slug);
  const { agency, supabase, e } = ctx;
  if (!e.managed && !e.verifiedBadge)
    return (
      <Paywall ctx={ctx} unlocks="With Pro you can ask us to verify your agency for the badge." />
    );
  const { data, error } = await supabase
    .from("verifications")
    .select("status")
    .eq("agency_id", agency.id)
    .in("status", ["requested", "approved"]);
  if (error) throw new Error("Couldn't load verification");
  const approved = data.some((v) => v.status === "approved");
  const requested = data.some((v) => v.status === "requested");

  return (
    <section aria-labelledby="verification" className="flex flex-col gap-4">
      <h2 id="verification" className="text-h2">
        Verified badge
      </h2>
      {approved ? (
        <p>Your agency is verified. The badge shows on your profile and in the directory.</p>
      ) : requested ? (
        <p className="max-w-reading">
          Your request is in review. We check your channels, your website and your business, and
          email you when it&apos;s decided.
        </p>
      ) : (
        <>
          <p className="max-w-reading text-text-2">
            We check your YouTube channels, your website domain and that your business is real. The
            badge can&apos;t be bought.
          </p>
          <RequestVerification agencyId={agency.id} />
        </>
      )}
    </section>
  );
}
