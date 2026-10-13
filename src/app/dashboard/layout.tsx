import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { accountFrom } from "@/lib/account";
import { getAdminUser, requireUser } from "@/lib/auth";
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
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <AccountMenu account={accountFrom(user)} admin={isAdmin} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1240px] px-4 pt-7 pb-20 md:px-6">
        {children}
      </main>
    </>
  );
}
