import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { BRAND_NAME } from "@/lib/site";

// Private, per-user pages: never indexed (also sent as X-Robots-Tag by the proxy).
export const metadata: Metadata = {
  title: { absolute: `Dashboard | ${BRAND_NAME}`, template: `%s | Dashboard | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-13 max-w-content items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="flex min-h-11 items-center text-[19px] font-semibold">
            {BRAND_NAME}
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
      <main id="main" className="mx-auto max-w-content px-4 py-12 md:px-6">
        {children}
      </main>
    </>
  );
}
