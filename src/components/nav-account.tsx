"use client";

import { UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

// The Nav renders on static (ISR) pages, so it can't read cookies on the server: that would make
// every page dynamic. The server HTML is the signed-out state; after hydration this checks for the
// Supabase session cookie (no network, no Supabase JS) and swaps to the signed-in state.
// Only signed-in visitors load the Supabase client, to ask whether they're an admin.

const AUTH_COOKIE = (() => {
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    return new RegExp(`(?:^|;\\s*)sb-${ref}-auth-token(?:\\.\\d+)?=`);
  } catch {
    return null;
  }
})();

let adminCheck: Promise<boolean> | null = null;
function isAdmin() {
  adminCheck ??= import("@/lib/supabase/client").then(async ({ createClient }) => {
    const { data } = await createClient().from("profiles").select("role").maybeSingle();
    return data?.role === "admin";
  });
  return adminCheck;
}

type Account = { signedIn: boolean; admin: boolean };

function useAccount(): Account {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account>({ signedIn: false, admin: false });
  useEffect(() => {
    // Re-checked on every navigation, so signing in or out updates the nav.
    const signedIn = !!AUTH_COOKIE?.test(document.cookie);
    if (!signedIn) adminCheck = null;
    let live = true;
    // Async on purpose: a cookie read is an external system, not render state.
    Promise.resolve(signedIn ? isAdmin().catch(() => false) : false).then((admin) => {
      if (live) setAccount({ signedIn, admin });
    });
    return () => {
      live = false;
    };
  }, [pathname]);
  return account;
}

const menuItem =
  "flex min-h-11 w-full items-center rounded-md px-3 text-left text-[15px] transition-colors duration-150 hover:bg-surface";

/** A native popover that closes when one of its links or buttons is used. */
function closeOnSelect(e: React.MouseEvent<HTMLElement>) {
  if ((e.target as HTMLElement).closest("a, button")) e.currentTarget.hidePopover?.();
}

function SignOutItem() {
  return (
    <form action={signOut}>
      <button type="submit" className={menuItem}>
        Sign out
      </button>
    </form>
  );
}

/** Right side of the nav at desktop widths. Both states share one grid cell: no layout shift. */
export function NavAccount() {
  const { signedIn, admin } = useAccount();
  const menuId = useId();
  return (
    <div className="grid items-center justify-items-end">
      <div
        className={cn("col-start-1 row-start-1 flex items-center gap-6", signedIn && "invisible")}
      >
        <Link
          href="/login"
          className="flex min-h-11 items-center text-[14px] text-text-2 transition-colors duration-150 hover:text-text"
        >
          Sign in
        </Link>
        <Button asChild>
          <Link href="/list-your-agency">List your agency</Link>
        </Button>
      </div>
      <div
        className={cn("col-start-1 row-start-1 flex items-center gap-4", !signedIn && "invisible")}
      >
        <Link
          href="/dashboard"
          className="flex min-h-11 items-center text-[14px] text-text-2 transition-colors duration-150 hover:text-text"
        >
          Dashboard
        </Link>
        <button
          type="button"
          popoverTarget={menuId}
          aria-label="Account menu"
          className="flex size-11 items-center justify-center rounded-full border border-line transition-colors duration-150 hover:border-text-2"
        >
          <UserIcon aria-hidden className="size-5" />
        </button>
        <div
          id={menuId}
          popover="auto"
          onClick={closeOnSelect}
          className="fixed inset-auto top-14 right-4 m-0 hidden w-56 flex-col gap-1 rounded-lg border border-line bg-bg p-2 text-text shadow-lg open:flex"
        >
          <Link href="/dashboard" className={menuItem}>
            Dashboard
          </Link>
          {admin && (
            <Link href="/admin" className={menuItem}>
              Admin
            </Link>
          )}
          <SignOutItem />
        </div>
      </div>
    </div>
  );
}

/** The account items inside the mobile menu. */
export function NavAccountMenuItems() {
  const { signedIn, admin } = useAccount();
  if (!signedIn) {
    return (
      <>
        <Link href="/login" className={menuItem}>
          Sign in
        </Link>
        <Link href="/list-your-agency" className={cn(menuItem, "font-medium text-accent")}>
          List your agency
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/dashboard" className={menuItem}>
        Dashboard
      </Link>
      {admin && (
        <Link href="/admin" className={menuItem}>
          Admin
        </Link>
      )}
      <SignOutItem />
    </>
  );
}

/** Mobile menu: a native popover under the nav (the browser handles open state, Esc and outside clicks). */
export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const id = useId();
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className="flex min-h-11 items-center rounded-full border border-line px-4 text-[15px] transition-colors duration-150 hover:border-text-2"
      >
        Menu
      </button>
      <div
        id={id}
        popover="auto"
        onClick={closeOnSelect}
        className="fixed inset-x-0 top-13 bottom-auto m-0 hidden max-h-[calc(100dvh-52px)] w-full flex-col gap-1 overflow-y-auto border-b border-line bg-bg px-4 pt-2 pb-4 text-text shadow-lg open:flex"
      >
        <nav aria-label="Menu" className="flex flex-col gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={menuItem}>
              {l.label}
            </Link>
          ))}
          <hr className="my-2 border-line" />
          <NavAccountMenuItems />
        </nav>
      </div>
    </>
  );
}
