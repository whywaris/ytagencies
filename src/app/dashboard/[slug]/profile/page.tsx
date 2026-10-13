import { LogoForm } from "@/components/dashboard/logo-form";
import { Paywall } from "@/components/dashboard/paywall";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { SeoHiddenNotice } from "@/components/seo-hidden-notice";
import { updateProfile } from "@/lib/actions/dashboard";
import { profileFormProps } from "@/lib/agency-profile";
import { dashboardContext } from "@/lib/data/dashboard";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ params }: PageProps<"/dashboard/[slug]/profile">) {
  const ctx = await dashboardContext((await params).slug);
  // Editing is part of managing a listing; the actions refuse too (editableAgency).
  if (!ctx.e.canEdit)
    return <Paywall ctx={ctx} unlocks="With Pro you can edit your profile any time." />;
  const { agency, supabase } = ctx;
  const form = await profileFormProps(supabase, agency);

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
    </div>
  );
}
