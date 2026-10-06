import Link from "next/link";
import { notFound } from "next/navigation";

import { AgencyForm } from "@/components/admin/agency-form";
import { ActionButton } from "@/components/admin/ui";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { adminUpdateProfile, setAgencyStatus, toggleAgencyFlag } from "@/lib/actions/admin";
import { hqLocationOptions } from "@/lib/admin-locations";
import { profileFormProps } from "@/lib/agency-profile";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEAM_SIZES, type AgencyInput } from "@/lib/validation/admin";

export const metadata = { title: "Edit agency" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminAgencyPage({ params }: PageProps<"/admin/agencies/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/agencies/${id}`);
  if (!UUID.test(id)) notFound();

  const db = createAdminClient();
  const { data: agency } = await db
    .from("agencies")
    .select(
      "id, name, slug, tagline, website, founded_year, team_size, languages, status, is_verified, is_featured, is_claimed, owner_id, description, min_budget_usd, pricing_model, locations!agencies_hq_location_id_fkey(slug)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!agency) notFound();

  const [locations, form, owner] = await Promise.all([
    hqLocationOptions(),
    profileFormProps(db, agency),
    agency.owner_id ? db.auth.admin.getUserById(agency.owner_id) : null,
  ]);

  const defaults: AgencyInput = {
    name: agency.name,
    slug: agency.slug,
    tagline: agency.tagline ?? "",
    website: agency.website ?? "",
    foundedYear: agency.founded_year?.toString() ?? "",
    teamSize: (TEAM_SIZES as readonly string[]).includes(agency.team_size ?? "")
      ? (agency.team_size as AgencyInput["teamSize"])
      : "",
    languages: (agency.languages ?? []).join(", "),
    hqLocation: agency.locations?.slug ?? "",
  };
  const published = agency.status === "published";

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4">
        <Link href="/admin/agencies" className="self-start text-small hover:text-text">
          ← All agencies
        </Link>
        <h1 className="text-admin-title">{agency.name}</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small">
          <span>
            Status: <strong className="text-text">{agency.status}</strong>
          </span>
          <span>
            Owner:{" "}
            <strong className="text-text">
              {owner?.data.user?.email ?? (agency.is_claimed ? "claimed, no account" : "unclaimed")}
            </strong>
          </span>
          {published && (
            <Link href={`/agency/${agency.slug}`} className="text-accent hover:underline">
              View public profile
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6">
          <ActionButton
            action={setAgencyStatus.bind(null, agency.id, published ? "draft" : "published")}
            tone={published ? "danger" : "default"}
          >
            {published ? "Unpublish" : "Publish"}
          </ActionButton>
          <ActionButton action={toggleAgencyFlag.bind(null, agency.id, "is_verified")}>
            {agency.is_verified ? "Remove Verified badge" : "Mark as verified"}
          </ActionButton>
          <ActionButton action={toggleAgencyFlag.bind(null, agency.id, "is_featured")}>
            {agency.is_featured ? "Remove Featured placement" : "Make featured (paid)"}
          </ActionButton>
        </div>
      </header>

      <section aria-labelledby="details" className="flex max-w-reading flex-col gap-6">
        <h2 id="details" className="text-admin-section">
          Details
        </h2>
        <AgencyForm
          id={agency.id}
          defaults={defaults}
          locations={locations}
          slugLocked={published}
        />
      </section>

      <section aria-labelledby="profile" className="flex flex-col gap-6">
        <h2 id="profile" className="text-admin-section">
          Profile, services and locations
        </h2>
        <ProfileForm save={adminUpdateProfile} agencyId={agency.id} {...form} />
      </section>
    </div>
  );
}
