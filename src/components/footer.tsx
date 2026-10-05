import Link from "next/link";

import { Logo } from "@/components/logo";
import { BRAND_NAME } from "@/lib/site";

const links = [
  { href: "/#services", label: "Services" },
  { href: "/#industries", label: "Industries" },
  { href: "/guides", label: "Guides" },
  { href: "/get-matched", label: "Get matched" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="flex max-w-md flex-col gap-3">
          <Link
            href="/"
            aria-label={`${BRAND_NAME} home`}
            className="flex min-h-11 items-center self-start"
          >
            <Logo className="h-6 w-auto" />
          </Link>
          <p className="text-small">
            © {new Date().getFullYear()} {BRAND_NAME}. Find the right YouTube agency.
          </p>
          <p className="text-small">
            {BRAND_NAME} is an independent directory and is not affiliated with YouTube or Google.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-6">
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
      </div>
    </footer>
  );
}
