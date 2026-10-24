import { btnPrimary } from "@/components/dashboard/ui";
import { UpgradeDialog } from "@/components/dashboard/upgrade-dialog";
import { WorkSamplesEditor } from "@/components/dashboard/work-samples-editor";
import { COMPANY } from "@/lib/company";
import { dashboardContext } from "@/lib/data/dashboard";
import { visibleSamples } from "@/lib/work-samples";

export const metadata = { title: "Work samples" };

export default async function WorkSamplesPage({
  params,
}: PageProps<"/dashboard/[slug]/work-samples">) {
  const ctx = await dashboardContext((await params).slug);
  const { agency, supabase, e, pro } = ctx;
  const [samples, services] = await Promise.all([
    supabase
      .from("work_samples")
      .select("id, youtube_video_id, title, format, note, sort_order, hidden_at, created_at, services(name)")
      .eq("agency_id", agency.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("agency_services")
      .select("is_primary, services(slug, name)")
      .eq("agency_id", agency.id),
  ]);
  if (samples.error || services.error) throw new Error("Couldn't load your work samples");
  // What the profile shows now: the rest are hidden by an admin or past the plan's limit.
  const shown = new Set(visibleSamples(samples.data, e.workSamples).map((s) => s.id));

  return (
    <section aria-labelledby="work-samples" className="flex flex-col gap-6">
      <div className="flex max-w-reading flex-col gap-1.5">
        <h2 id="work-samples" className="text-h2">
          Work samples
        </h2>
        <p className="text-text-2">
          YouTube videos you worked on, shown on your profile with the service and a short note.
          Up to {e.workSamples} on your plan{e.managed ? "" : " (12 with Pro)"}. Videos must be
          public and allow embedding.
        </p>
      </div>
      <WorkSamplesEditor
        agencyId={agency.id}
        limit={e.workSamples}
        services={[...services.data]
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
          .map((r) => r.services)}
        samples={samples.data.map((s) => ({
          id: s.id,
          videoId: s.youtube_video_id,
          title: s.title,
          format: s.format,
          service: s.services?.name ?? null,
          note: s.note,
          hidden: !!s.hidden_at,
          overLimit: !shown.has(s.id),
        }))}
        upgrade={
          <UpgradeDialog
            className={btnPrimary}
            label="Get Pro"
            agencyId={agency.id}
            monthly={pro.monthly}
            yearly={pro.yearly}
            saving={pro.saving}
            from="billing"
            refundDays={COMPANY.refunds.yearlyFullRefundDays}
          />
        }
      />
    </section>
  );
}
