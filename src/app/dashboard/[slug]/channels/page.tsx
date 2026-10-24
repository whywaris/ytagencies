import { ChannelsEditor } from "@/components/dashboard/channels-editor";
import { Paywall } from "@/components/dashboard/paywall";
import { dashboardContext } from "@/lib/data/dashboard";
import { getIndustries } from "@/lib/data/taxonomy";

export const metadata = { title: "Channels" };

export default async function ChannelsPage({ params }: PageProps<"/dashboard/[slug]/channels">) {
  const ctx = await dashboardContext((await params).slug);
  if (!ctx.e.channels)
    return <Paywall ctx={ctx} unlocks="With Pro you can list the channels you've worked on." />;
  const { agency, supabase } = ctx;
  const [channels, industries] = await Promise.all([
    supabase
      .from("agency_channels")
      .select("id, channel_url, title, subscriber_count, status, industries(slug)")
      .eq("agency_id", agency.id)
      .order("created_at"),
    getIndustries(),
  ]);
  if (channels.error) throw new Error("Couldn't load your channels");

  return (
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
        industries={industries.map(({ slug, name }) => ({ slug, name }))}
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
  );
}
