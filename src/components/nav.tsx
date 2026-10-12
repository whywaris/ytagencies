import Link from "next/link";

import { Logo } from "@/components/logo";
import { MobileMenu, NavAccount } from "@/components/nav-account";
import { BRAND_NAME } from "@/lib/site";

const links = [
  { href: "/#services", label: "Services" },
  { href: "/#industries", label: "Industries" },
  { href: "/guides", label: "Guides" },
  { href: "/#how", label: "How it works" },
];

// DESIGN.md: 52px, sticky, frosted, hairline bottom border. Server-rendered and cookie-free so
// pages stay static; the account area is a client component (see nav-account.tsx).
export function Nav() {
  return (
    <header className="@container sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-[20px] print:hidden">
      <nav
        aria-label="Main"
        className="mx-auto flex h-13 max-w-content items-center gap-8 px-4 md:px-6"
      >
        <Link href="/" aria-label={`${BRAND_NAME} home`} className="flex min-h-11 items-center">
          <Logo className="h-7 w-auto" />
        </Link>
        <ul className="hidden items-center gap-6 @4xl:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex min-h-11 items-center text-[14px] text-text-2 transition-colors duration-150 hover:text-text"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto hidden @4xl:block">
          <NavAccount />
        </div>
        <div className="ml-auto @4xl:hidden">
          <MobileMenu links={links} />
        </div>
      </nav>
    </header>
  );
}
