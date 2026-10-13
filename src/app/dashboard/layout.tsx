import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAdminUser, requireUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { BRAND_NAME } from "@/lib/site";

// Private, per-user pages: never indexed (also sent as X-Robots-Tag by the proxy).
export const metadata: Metadata = {
  title: { absolute: `Dashboard | ${BRAND_NAME}`, template: `%s | Dashboard | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const isAdmin = !!(await getAdminUser());
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-13 max-w-content items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" aria-label={`${BRAND_NAME} home`} className="flex min-h-11 items-center">
            <Logo className="h-7 w-auto" />
          </Link>
          <div className="flex min-w-0 items-center gap-4 text-small">
            <ThemeToggle />
            <span className="hidden truncate sm:inline">{user.email}</span>
            {isAdmin && (
              <Link
                href="/admin"
                className="flex min-h-11 items-center text-accent hover:underline"
              >
                Admin
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className="min-h-11 text-accent hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1240px] px-4 pt-7 pb-20 md:px-6">
        {children}
      </main>
    </>
  );
}
