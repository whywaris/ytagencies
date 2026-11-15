import { GuideTabsSetting } from "@/components/admin/guide-tabs-setting";
import { RefreshSitemap } from "@/components/admin/refresh-sitemap";
import { requireAdmin } from "@/lib/auth";
import { getGuideTabsMax } from "@/lib/data/settings";
import { sitemapEntries, SITEMAP_FILES } from "@/lib/sitemap";

export const metadata = { title: "Settings" };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 py-8 md:grid-cols-[240px_1fr] md:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-admin-section">{title}</h2>
        <p className="text-admin-meta">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** ADMIN_V2_SPEC §5.10: admin profile, guide tabs and the sitemap. */
export default async function AdminSettingsPage() {
  const admin = await requireAdmin("/admin/settings");
  const guideTabsMax = await getGuideTabsMax();
  const sitemapCounts = Object.fromEntries(
    await Promise.all(
      SITEMAP_FILES.map(async (f) => [f, (await sitemapEntries(f)).length] as const),
    ),
  );

  return (
    <div className="flex max-w-[880px] flex-col">
      <h1 className="text-admin-title">Settings</h1>

      <div className="flex flex-col divide-y divide-line">
        <Section title="Your account" description="The admin you're signed in as.">
          <dl className="grid grid-cols-[120px_1fr] gap-y-3">
            <dt className="text-text-2">Email</dt>
            <dd className="min-w-0 truncate">{admin.email}</dd>
            <dt className="text-text-2">Role</dt>
            <dd>Admin</dd>
          </dl>
        </Section>

        <Section
          title="Guides"
          description="How many category tabs /guides shows; the other categories with guides go under More."
        >
          <GuideTabsSetting value={guideTabsMax} />
        </Section>

        <Section
          title="Sitemap"
          description="Updates by itself when guides or authors change, and hourly as a fallback. Refresh it after editing the database directly."
        >
          <RefreshSitemap initial={sitemapCounts} />
        </Section>
      </div>
    </div>
  );
}
