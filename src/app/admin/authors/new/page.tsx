import { AuthorForm } from "@/components/admin/author-form";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "New author" };

export default async function NewAuthorPage() {
  await requireAdmin("/admin/authors/new");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-admin-title">New author</h1>
      <AuthorForm
        author={{
          id: null,
          name: "",
          slug: "",
          role: "",
          bio: "",
          linkedinUrl: "",
          xUrl: "",
          websiteUrl: "",
          avatarPath: null,
          live: false,
        }}
      />
    </div>
  );
}
