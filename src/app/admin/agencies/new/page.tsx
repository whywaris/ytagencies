import { AgencyForm } from "@/components/admin/agency-form";
import { hqLocationOptions } from "@/lib/admin-locations";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "New agency" };

export default async function NewAgencyPage() {
  await requireAdmin("/admin/agencies/new");
  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1 className="text-h2">New agency</h1>
      <p className="text-text-2">
        New agencies start as drafts. After creating it, add services, industries and locations,
        then publish.
      </p>
      <AgencyForm
        id={null}
        slugLocked={false}
        locations={await hqLocationOptions()}
        defaults={{
          name: "",
          slug: "",
          tagline: "",
          website: "",
          foundedYear: "",
          teamSize: "",
          languages: "",
          hqLocation: "",
        }}
      />
    </div>
  );
}
