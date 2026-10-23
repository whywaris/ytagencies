"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AccountMenu, AvatarPlaceholder } from "@/components/account-menu";

import { ThemeToggle } from "@/components/theme-toggle";
import { accountFrom, type Account } from "@/lib/account";
import { cn } from "@/lib/utils";

// The Nav renders on static (ISR) pages, so it can't read cookies on the server: that would make
// every page dynamic. The server HTML is the signed-out state; after hydration this checks for the
// Supabase session cookie (no network, no Supabase JS) and swaps to the signed-in state.
// Only signed-in visitors load the Supabase client: the account (from the local session) and
// whether they're an admin.

const AUTH_COOKIE = (() => {
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    return new RegExp(`(?:^|;\\s*)sb-${ref}-auth-token(?:\\.\\d+)?=`);
  } catch {
    return null;
  }
})();

let lookup: Promise<{ account: Account; admin: boolean } | null> | null = null;
/**
 * Signed in: the account from the local session (getSession reads the cookie, no network call)
 * and whether the profile's role is admin (a database read under RLS). Only signed-in visitors
 * load the Supabase client.
 */
function lookupAccount() {
  lookup ??= import("@/lib/supabase/client").then(async ({ createClient }) => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const { data: profile } = await supabase.from("profiles").select("role").maybeSingle();
    return { account: accountFrom(user), admin: profile?.role === "admin" };
  });
  return lookup;
}

type State =
  { status: "out" } | { status: "loading" } | { status: "in"; account: Account; admin: boolean };

function useAccount(): State {
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: "out" });
  useEffect(() => {
    // Re-checked on every navigation, so signing in or out updates the nav.
    const signedIn = !!AUTH_COOKIE?.test(document.cookie);
    if (!signedIn) lookup = null;
    let live = true;
    // Async on purpose: a cookie read is an external system, not render state.
    Promise.resolve().then(() => {
      if (!live) return;
      if (!signedIn) return setState({ status: "out" });
      setState((s) => (s.status === "in" ? s : { status: "loading" }));
      lookupAccount()
        .catch(() => null)
        .then((r) => live && setState(r ? { status: "in", ...r } : { status: "out" }));
    });
    return () => {
      live = false;
    };
  }, [pathname]);
  return state;
}

const menuItem =
  "flex min-h-11 w-full items-center rounded-md px-3 text-left text-[15px] transition-colors duration-150 hover:bg-surface";

/** A native popover that closes when one of its links or buttons is used (not the theme toggle). */
function closeOnSelect(e: React.MouseEvent<HTMLElement>) {
  if ((e.target as HTMLElement).closest("a, button:not([data-keep-open])"))
    e.currentTarget.hidePopover?.();
}

/**
 * Right side of the nav at desktop widths. Signed out: theme toggle, Sign in. Agency-facing links
 * (List your agency, Pricing) live in the footer only: the header is for businesses and creators.
 * Signed in: the theme toggle right next to the avatar menu (the signed-out links are removed, not
 * just hidden, so they don't leave a gap). The server HTML is the signed-out state.
 */
export function NavAccount() {
  const state = useAccount();
  const onLogin = usePathname() === "/login";
  if (state.status !== "out")
    return (
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <AccountSlot state={state} />
      </div>
    );
  return (
    <div className="flex items-center gap-6">
      <ThemeToggle />
      <Link
        href="/login"
        aria-current={onLogin ? "page" : undefined}
        className="flex min-h-11 items-center text-[14px] text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:font-semibold aria-[current=page]:text-text"
      >
        Sign in
      </Link>
    </div>
  );
}

/** The avatar menu once the account is known; a same-size placeholder while it's read. */
function AccountSlot({ state }: { state: State }) {
  return state.status === "in" ? (
    <AccountMenu account={state.account} admin={state.admin} />
  ) : (
    <span className="grid size-11 place-items-center">
      <AvatarPlaceholder />
    </span>
  );
}

/** Small screens: the same avatar menu beside the Menu button (nothing when signed out). */
export function MobileAccount() {
  const state = useAccount();
  return state.status === "out" ? null : <AccountSlot state={state} />;
}

/** The account items inside the mobile menu. */
export function NavAccountMenuItems() {
  const state = useAccount();
  const onLogin = usePathname() === "/login";
  if (state.status === "out") {
    return (
      <Link
        href="/login"
        aria-current={onLogin ? "page" : undefined}
        className={cn(menuItem, "aria-[current=page]:font-semibold")}
      >
        Sign in
      </Link>
    );
  }
  // Signed in: Dashboard, Admin and Sign out are in the avatar menu (MobileAccount).
  return null;
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
          <ThemeToggle className="mx-3 my-1" />
          <NavAccountMenuItems />
        </nav>
      </div>
    </>
  );
}
