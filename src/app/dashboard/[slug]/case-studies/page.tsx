import { CaseStudies } from "@/components/dashboard/case-studies";
import { Paywall } from "@/components/dashboard/paywall";
import { deleteCaseStudy, saveCaseStudy } from "@/lib/actions/dashboard";
import { dashboardContext } from "@/lib/data/dashboard";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { jsonToMetrics } from "@/lib/validation/dashboard";

export const metadata = { title: "Case studies" };

export default async function CaseStudiesPage({
  params,
}: PageProps<"/dashboard/[slug]/case-studies">) {
  const ctx = await dashboardContext((await params).slug);
  if (!ctx.e.canEdit)
    return <Paywall ctx={ctx} unlocks="With Pro you can add case studies with real numbers." />;
  const { agency, supabase } = ctx;
  const [caseStudies, industries, services] = await Promise.all([
    supabase
      .from("case_studies")
      .select("id, title, summary, channel_url, metrics, industries(slug), services(slug)")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false }),
    getIndustries(),
    getServices(),
  ]);
  if (caseStudies.error) throw new Error("Couldn't load your case studies");
  const options = (rows: { slug: string; name: string }[]) =>
    rows.map(({ slug, name }) => ({ slug, name }));

  return (
    <section aria-labelledby="case-studies" className="flex flex-col gap-6">
      <h2 id="case-studies" className="text-h2">
        Case studies
      </h2>
      <CaseStudies
        actions={{ save: saveCaseStudy, remove: deleteCaseStudy }}
        agencyId={agency.id}
        industries={options(industries)}
        services={options(services)}
        items={caseStudies.data.map((c) => ({
          id: c.id,
          title: c.title,
          industry: c.industries?.slug ?? "",
          service: c.services?.slug ?? "",
          channelUrl: c.channel_url ?? "",
          summary: c.summary ?? "",
          metrics: jsonToMetrics(c.metrics),
        }))}
      />
    </section>
  );
}
