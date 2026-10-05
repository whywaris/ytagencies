import { notFound } from "next/navigation";

import { CaseStudies } from "@/components/dashboard/case-studies";
import { LogoForm } from "@/components/dashboard/logo-form";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { updateProfile } from "@/lib/actions/dashboard";
import { getOwnedAgency } from "@/lib/auth";
import { profileFormProps } from "@/lib/agency-profile";
import { getIndustries } from "@/lib/data/taxonomy";
import { jsonToMetrics } from "@/lib/validation/dashboard";

export const metadata = { title: "Edit profile" };

export default async function EditAgencyPage({ params }: PageProps<"/dashboard/[agencyId]">) {
  const owned = await getOwnedAgency((await params).agencyId);
  if (!owned) notFound();
  const { agency, supabase } = owned;

  const [form, caseStudies, industries] = await Promise.all([
    profileFormProps(supabase, agency),
    supabase
      .from("case_studies")
      .select("id, title, summary, channel_url, metrics, industries(slug)")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false }),
    getIndustries(),
  ]);
  if (caseStudies.error) throw new Error("Couldn't load the listing");
  const options = (rows: { slug: string; name: string }[]) =>
    rows.map(({ slug, name }) => ({ slug, name }));

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="logo" className="flex flex-col gap-6">
        <h2 id="logo" className="text-h2">
          Logo
        </h2>
        <LogoForm agencyId={agency.id} name={agency.name} logoPath={agency.logo_path} />
      </section>

      <section aria-labelledby="profile" className="flex flex-col gap-6">
        <h2 id="profile" className="text-h2">
          Profile
        </h2>
        <ProfileForm save={updateProfile} agencyId={agency.id} {...form} />
      </section>

      <section aria-labelledby="case-studies" className="flex flex-col gap-6">
        <h2 id="case-studies" className="text-h2">
          Case studies
        </h2>
        <CaseStudies
          agencyId={agency.id}
          industries={options(industries)}
          items={caseStudies.data.map((c) => ({
            id: c.id,
            title: c.title,
            industry: c.industries?.slug ?? "",
            channelUrl: c.channel_url ?? "",
            summary: c.summary ?? "",
            metrics: jsonToMetrics(c.metrics),
          }))}
        />
      </section>
    </div>
  );
}
