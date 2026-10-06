import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { BRAND_NAME } from "@/lib/site";

// Shown in place of /admin pages to signed-in accounts that aren't admins (proxy rewrite, and the
// requireAdmin() fallback). Static: it doesn't need to know who's signed in.
export const metadata = {
  title: { absolute: `No access | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

export default function NoAccessPage() {
  return (
    <div className="mx-auto flex max-w-reading flex-col gap-6 px-4 py-20 md:py-30">
      <h1 className="text-h1">You don&apos;t have access to this page</h1>
      <p className="text-text-2">
        This area is for the {BRAND_NAME} team. The account you&apos;re signed in with isn&apos;t an
        admin account. If you manage an agency, your listings are in your dashboard.
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <Button asChild>
          <Link href="/dashboard">Go to your dashboard</Link>
        </Button>
        <form action={signOut}>
          <button type="submit" className="flex min-h-11 items-center text-accent hover:underline">
            Sign in with a different account
          </button>
        </form>
      </div>
    </div>
  );
}
