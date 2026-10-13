import { notFound } from "next/navigation";

import { CaseStudies } from "@/components/dashboard/case-studies";
import { ChannelsEditor } from "@/components/dashboard/channels-editor";
import { LogoForm } from "@/components/dashboard/logo-form";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { SeoHiddenNotice } from "@/components/seo-hidden-notice";
import { deleteCaseStudy, saveCaseStudy, updateProfile } from "@/lib/actions/dashboard";
import { getOwnedAgency } from "@/lib/auth";
import { profileFormProps } from "@/lib/agency-profile";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { jsonToMetrics } from "@/lib/validation/dashboard";

export const metadata = { title: "Edit profile" };

export default async function EditAgencyPage({ params }: PageProps<"/dashboard/[agencyId]">) {
  const owned = await getOwnedAgency((await params).agencyId);
  if (!owned) notFound();
  const { agency, supabase } = owned;

  const [form, caseStudies, industries, services, channels] = await Promise.all([
    profileFormProps(supabase, agency),
    supabase
      .from("case_studies")
      .select("id, title, summary, channel_url, metrics, industries(slug), services(slug)")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false }),
    getIndustries(),
    getServices(),
    supabase
      .from("agency_channels")
      .select("id, channel_url, title, subscriber_count, status, industries(slug)")
      .eq("agency_id", agency.id)
      .order("created_at"),
  ]);
  if (caseStudies.error || channels.error) throw new Error("Couldn't load the listing");
  const options = (rows: { slug: string; name: string }[]) =>
    rows.map(({ slug, name }) => ({ slug, name }));

  return (
    <div className="flex flex-col gap-16">
      <SeoHiddenNotice
        profile={form.defaults}
        className="-mb-8 rounded-lg border border-line bg-(--amber-soft) px-4 py-3 text-[15px] text-text"
      />
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

      <section aria-labelledby="channels" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="channels" className="text-h2">
            Channels
          </h2>
          <p className="max-w-reading text-text-2">
            Up to 6 YouTube channels you&apos;ve worked on. They show as &ldquo;Listed by you&rdquo;
            until the client confirms the work with us.
          </p>
        </div>
        <ChannelsEditor
          agencyId={agency.id}
          industries={options(industries)}
          channels={channels.data.map((c) => ({
            id: c.id,
            url: c.channel_url,
            title: c.title,
            subscribers: c.subscriber_count,
            industry: c.industries?.slug ?? "",
            confirmed: c.status === "confirmed",
          }))}
        />
      </section>
    </div>
  );
}
