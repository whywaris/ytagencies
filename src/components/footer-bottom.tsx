import { Mail } from "lucide-react";
import Link from "next/link";

import { CookieSettingsButton } from "@/components/analytics";
import { gaId } from "@/lib/analytics";
import { copyrightName } from "@/lib/company";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/site";

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

// Small links keep a 44px tap target through an invisible pseudo-element, so the row stays tight.
const link =
  "relative text-text-2 transition-colors duration-150 after:absolute after:-inset-x-1.5 after:-inset-y-3 hover:text-text hover:underline";

/**
 * The footer's bottom row: © and the legal links on the left, the contact address on the right,
 * then the disclaimer. The site footer and the sign-in page (without the disclaimer) share it.
 * Sits inside the footer's max-width container.
 */
export function FooterBottom({
  disclaimer = true,
  cookieSettings = true,
}: {
  disclaimer?: boolean;
  /** "Cookie settings" reopens the consent banner (components/analytics.tsx). */
  cookieSettings?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-6 pb-8">
      <div className="flex flex-col items-start gap-2.5 text-[13.5px] text-text-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-2">
        <p>
          © <span className="tabular-nums">{new Date().getFullYear()}</span> {copyrightName()}
        </p>
        <nav aria-label="Legal" className="flex gap-5">
          {LEGAL.map((l) => (
            <Link key={l.href} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
          {/* Only where GA can run: public pages, not the sign-in page. */}
          {cookieSettings && gaId() && <CookieSettingsButton className={link} />}
        </nav>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={`${link} flex items-baseline gap-1.5 sm:ml-auto`}
        >
          <Mail className="size-3.5 self-center [stroke-width:1.75]" aria-hidden />
          {CONTACT_EMAIL}
        </a>
      </div>
      {disclaimer && (
        <p className="text-[12.5px] text-text-2">
          {BRAND_NAME} is an independent directory and isn&apos;t affiliated with YouTube or Google.
        </p>
      )}
    </div>
  );
}
