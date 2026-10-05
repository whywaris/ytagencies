import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/site";

const links = [
  { href: "/#services", label: "Services" },
  { href: "/#industries", label: "Industries" },
  { href: "/guides", label: "Guides" },
];

// DESIGN.md: 52px, sticky, frosted, hairline bottom border.
export function Nav() {
  return (
    <header className="@container sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-[20px]">
      <nav
        aria-label="Main"
        className="mx-auto flex h-13 max-w-content items-center gap-8 px-4 md:px-6"
      >
        <Link href="/" className="flex min-h-11 items-center text-[19px] font-semibold">
          {BRAND_NAME}
        </Link>
        {/* ponytail: links hidden when the nav is narrow, the footer repeats them; add a menu if mobile nav data says so */}
        <ul className="hidden items-center gap-6 @xl:flex">
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
        <Button asChild className="ml-auto">
          <Link href="/get-matched">Get matched</Link>
        </Button>
      </nav>
    </header>
  );
}
