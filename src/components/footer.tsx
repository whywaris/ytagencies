import Link from "next/link";

import { FooterBottom } from "@/components/footer-bottom";
import { Logo } from "@/components/logo";
import { BRAND_NAME } from "@/lib/site";

const GROUPS = [
  {
    heading: "Directory",
    links: [
      { href: "/#services", label: "Services" },
      { href: "/#industries", label: "Industries" },
      { href: "/guides", label: "Guides" },
      { href: "/get-matched", label: "Get matched" },
    ],
  },
  {
    heading: "For agencies",
    links: [
      { href: "/list-your-agency", label: "List your agency" },
      { href: "/for-agencies/pricing", label: "Pricing" },
      { href: "/how-we-rank", label: "How we rank" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/editorial-policy", label: "Editorial policy" },
      { href: "/disclosure", label: "Disclosure" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refunds", label: "Refunds" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-12 md:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <Link
            href="/"
            aria-label={`${BRAND_NAME} home`}
            className="flex min-h-11 items-center self-start"
          >
            <Logo className="h-6 w-auto" />
          </Link>
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 lg:gap-x-16">
            {GROUPS.map((g) => (
              <nav key={g.heading} aria-label={g.heading} className="flex flex-col gap-1">
                <h2 className="text-[14px] font-medium">{g.heading}</h2>
                <ul className="flex flex-col">
                  {g.links.map((l) => (
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
              </nav>
            ))}
          </div>
        </div>

        <FooterBottom />
      </div>
    </footer>
  );
}
