import { Mail } from "lucide-react";
import Link from "next/link";

import { CookieSettingsButton } from "@/components/analytics";
import { Logo } from "@/components/logo";
import { gaId } from "@/lib/analytics";
import { copyrightName } from "@/lib/company";
import { BRAND_NAME, CONTACT_EMAIL, INDEPENDENT_DIRECTORY } from "@/lib/site";

// Site-wide footer. Agency-facing links live here only (the header is for businesses and creators).
const GROUPS = [
  {
    heading: "Find agencies",
    links: [
      { href: "/agencies", label: "All agencies" },
      { href: "/#services", label: "Services" },
      { href: "/#industries", label: "Industries" },
      { href: "/request-proposals", label: "Request proposals" },
      { href: "/guides", label: "Guides" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/how-we-rank", label: "How we rank" },
      { href: "/editorial-policy", label: "Editorial policy" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "For agencies",
    links: [
      { href: "/list-your-agency", label: "List your agency" },
      { href: "/list-your-agency#claim", label: "Claim a listing" },
      { href: "/pricing", label: "Pricing" },
      { href: "/login", label: "Sign in" },
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

const small =
  "relative rounded text-text-2 transition-colors duration-150 after:absolute after:-inset-x-1.5 after:-inset-y-3 hover:text-text hover:underline";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-12 md:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="flex max-w-[300px] flex-col gap-3">
            <Link
              href="/"
              aria-label={`${BRAND_NAME} home`}
              className="flex min-h-11 items-center self-start"
            >
              <Logo className="h-6 w-auto" />
            </Link>
            <p className="text-[14px] text-text-2">
              Helping businesses and creators find YouTube agencies that know their niche.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex min-h-11 items-center gap-1.5 self-start text-[14px] text-text-2 hover:text-text hover:underline"
            >
              <Mail className="size-4 [stroke-width:1.75]" aria-hidden />
              {CONTACT_EMAIL}
            </a>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 lg:gap-x-14">
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

        <div className="flex flex-col gap-2 border-t border-line pt-6 pb-8 text-[13.5px] text-text-2 sm:flex-row sm:items-baseline sm:justify-between">
          <p>
            © <span className="tabular-nums">{new Date().getFullYear()}</span> {copyrightName()}
            {/* Only where GA can run (lib/analytics.ts). */}
            {gaId() && (
              <>
                {" · "}
                <CookieSettingsButton className={small} />
              </>
            )}
          </p>
          <div className="flex flex-col gap-1 sm:max-w-[40em] sm:text-right">
            <p>{INDEPENDENT_DIRECTORY}</p>
            <p>Not affiliated with YouTube or Google.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
