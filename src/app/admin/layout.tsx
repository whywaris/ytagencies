import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/nav";
import { signOut } from "@/lib/actions/auth";
import { requireAdmin } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { absolute: `Admin | ${BRAND_NAME}`, template: `%s | Admin | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const db = createAdminClient();
  const [claims, reviews] = await Promise.all([
    db.from("claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-13 max-w-content items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="flex min-h-11 items-center text-[19px] font-semibold">
            {BRAND_NAME} <span className="ml-2 font-normal text-text-2">Admin</span>
          </Link>
          <div className="flex min-w-0 items-center gap-4 text-small">
            <span className="hidden truncate sm:inline">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="min-h-11 text-accent hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-content flex-col gap-8 px-4 py-10 md:px-6">
        <AdminNav
          counts={{ "/admin/claims": claims.count ?? 0, "/admin/reviews": reviews.count ?? 0 }}
        />
        {children}
      </main>
    </>
  );
}
