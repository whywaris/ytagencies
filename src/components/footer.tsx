import { Mail } from "lucide-react";
import Link from "next/link";
import { siFacebook, siInstagram, siThreads, siX, siYoutube } from "simple-icons";

import { CookieSettingsButton } from "@/components/analytics";
import { Logo } from "@/components/logo";
import { gaId } from "@/lib/analytics";
import { COMPANY, copyrightName } from "@/lib/company";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";
import { cn } from "@/lib/utils";

// Site-wide footer. Agency-facing links live here only (the header is for businesses and creators).
// Disclosure is linked from /pricing and /how-we-rank, not here.
const GROUPS = [
  {
    heading: "Explore",
    links: [
      { href: "/agencies", label: "All agencies" },
      { href: "/#services", label: "Services" },
      { href: "/#industries", label: "Industries" },
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

// Monochrome brand marks (simple-icons, 24×24). LinkedIn isn't in simple-icons any more (LinkedIn
// asked for it to be removed), so its "in" mark is inlined here.
const LINKEDIN =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
const SOCIAL = [
  { key: "x", platform: "X", path: siX.path },
  { key: "linkedin", platform: "LinkedIn", path: LINKEDIN },
  { key: "youtube", platform: "YouTube", path: siYoutube.path },
  { key: "instagram", platform: "Instagram", path: siInstagram.path },
  { key: "threads", platform: "Threads", path: siThreads.path },
  { key: "facebook", platform: "Facebook", path: siFacebook.path },
] as const;

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// Small links keep a 44px tap target through an invisible pseudo-element, so the rows stay tight.
const small = cn(
  "relative rounded text-text-2 transition-colors duration-150 after:absolute after:-inset-x-1.5 after:-inset-y-3 hover:text-text hover:underline",
  focusRing,
);

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-12 md:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
          <div className="flex max-w-[360px] flex-col gap-4">
            <Link
              href="/"
              aria-label={`${BRAND_NAME} home`}
              className={cn("flex min-h-11 items-center self-start rounded", focusRing)}
            >
              <Logo className="h-6 w-auto" />
            </Link>
            <p className="text-[15px] text-text-2">
              Compare YouTube agencies that already know your niche. Free for businesses and
              creators.
            </p>
            <ul aria-label={`${BRAND_NAME} on social media`} className="flex flex-wrap gap-2">
              {SOCIAL.map((s) => (
                <li key={s.key}>
                  <a
                    href={COMPANY.social[s.key]}
                    target="_blank"
                    rel="me noopener noreferrer"
                    aria-label={`${BRAND_NAME} on ${s.platform}`}
                    className={cn(
                      "grid size-10 place-items-center rounded-[12px] border border-line bg-raised text-text-2 transition-colors duration-150 hover:border-accent hover:text-accent",
                      focusRing,
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-[18px]"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d={s.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] lg:max-w-[720px]">
            {GROUPS.map((g) => (
              <nav key={g.heading} aria-label={g.heading} className="flex flex-col gap-4">
                <h2 className="text-[13px] font-bold tracking-[0.06em] text-text uppercase">
                  {g.heading}
                </h2>
                <ul className="flex flex-col gap-3">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className={cn(small, "text-[15px]")}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-6 pb-8 text-[13.5px] text-text-2 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <span>
              © <span className="tabular-nums">{new Date().getFullYear()}</span> {copyrightName()}
            </span>
            {/* Only where GA can run (lib/analytics.ts). */}
            {gaId() && (
              <>
                <span aria-hidden>·</span>
                <CookieSettingsButton className={small} />
              </>
            )}
            <span aria-hidden>·</span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={cn(small, "inline-flex items-center gap-1.5")}
            >
              <Mail className="size-4 [stroke-width:1.75]" aria-hidden />
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>Independent directory · Not affiliated with YouTube or Google</p>
        </div>
      </div>
    </footer>
  );
}
