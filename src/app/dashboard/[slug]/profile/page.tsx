import Link from "next/link";

import { BasicsForm } from "@/components/dashboard/basics-form";
import { BookingForm } from "@/components/dashboard/booking-form";
import { LogoForm } from "@/components/dashboard/logo-form";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { SeoHiddenNotice } from "@/components/seo-hidden-notice";
import { updateProfile } from "@/lib/actions/dashboard";
import { profileFormProps } from "@/lib/agency-profile";
import { dashboardContext } from "@/lib/data/dashboard";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ params }: PageProps<"/dashboard/[slug]/profile">) {
  const ctx = await dashboardContext((await params).slug);
  // Owners edit the basics on any plan; booking buttons are Pro (the actions check too).
  const { agency, supabase, e } = ctx;
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
      <section aria-labelledby="basics" className="flex flex-col gap-6">
        <h2 id="basics" className="text-h2">
          Basics
        </h2>
        <BasicsForm
          agencyId={agency.id}
          defaults={{
            tagline: agency.tagline ?? "",
            website: agency.website ?? "",
            foundedYear: agency.founded_year?.toString() ?? "",
            teamSize: (agency.team_size ?? "") as "" | "1-10" | "11-50" | "51-200" | "200+",
            languages: (agency.languages ?? []).join(", "),
          }}
        />
      </section>
      <section aria-labelledby="profile" className="flex flex-col gap-6">
        <h2 id="profile" className="text-h2">
          Profile
        </h2>
        <ProfileForm save={updateProfile} agencyId={agency.id} {...form} />
      </section>
      <section aria-labelledby="booking" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h2 id="booking" className="text-h2">
            Booking buttons
          </h2>
          <p className="text-text-2">
            Let businesses and creators book a call or message you straight from your profile.
          </p>
        </div>
        {e.bookingButtons ? (
          <BookingForm
            agencyId={agency.id}
            calendlyUrl={agency.calendly_url ?? ""}
            whatsappNumber={agency.whatsapp_number ? `+${agency.whatsapp_number}` : ""}
          />
        ) : (
          <p className="text-text-2">
            Part of Pro.{" "}
            <Link
              href={`/dashboard/${agency.slug}/billing`}
              className="text-accent hover:underline"
            >
              Get Pro
            </Link>{" "}
            to add a Calendly link and a WhatsApp button.
          </p>
        )}
      </section>
    </div>
  );
}
