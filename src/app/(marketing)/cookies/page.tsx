import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
import Link from "next/link";

import { PREF_MAX_AGE, SIDEBAR_COOKIE, THEME_COOKIE } from "@/components/admin/shell-prefs";
import { CookieSettingsButton } from "@/components/analytics";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";
import { PAGE_UPDATED } from "@/lib/page-dates";

// The cookie list comes from the code that sets them: Supabase sign-in (@supabase/ssr defaults,
// cookie name from the project URL), the admin preferences (components/admin/shell-prefs.ts) and,
// after consent, Google Analytics (components/analytics.tsx).
// Add a row here whenever the code starts setting a new cookie.

const UPDATED = PAGE_UPDATED["/cookies"];
const TITLE = "Cookie policy";
const DESCRIPTION =
  "The essential cookies YT Agencies sets for signing in and admin settings, the Google Analytics cookies set only if you accept them, Google's ad cookies on guides, and how long each lasts.";

export const metadata = buildMetadata({
  title: `Cookie policy | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/cookies",
});

const days = (seconds: number) => {
  const d = Math.round(seconds / 86400);
  return d >= 365 && d % 365 === 0 ? `${d / 365} year${d === 365 ? "" : "s"}` : `${d} days`;
};

// sb-<project ref>-auth-token, as @supabase/ssr names it (it may split it into .0, .1, …).
const projectRef = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0];
  } catch {
    return "<project>";
  }
})();
const authCookie = `sb-${projectRef}-auth-token`;

const COOKIES = [
  {
    name: authCookie,
    who: "Everyone who signs in",
    purpose:
      "Keeps you signed in to your agency dashboard. Long values are split into numbered parts (.0, .1).",
    duration: `Up to ${days(DEFAULT_COOKIE_OPTIONS.maxAge ?? 0)}, or until you sign out`,
  },
  {
    name: `${authCookie}-code-verifier`,
    who: "Everyone who signs in",
    purpose:
      "Links a sign-in link to the browser that asked for it. Removed once you're signed in.",
    duration: "Until sign-in completes",
  },
  {
    name: THEME_COOKIE,
    who: "Our administrators only",
    purpose: "Remembers the light or dark theme chosen in the admin area.",
    duration: days(PREF_MAX_AGE),
  },
  {
    name: SIDEBAR_COOKIE,
    who: "Our administrators only",
    purpose: "Remembers whether the admin sidebar is collapsed.",
    duration: days(PREF_MAX_AGE),
  },
];

// _ga_<container id>: the measurement ID without its "G-" prefix.
const gaContainer = (process.env.NEXT_PUBLIC_GA_ID ?? "G-<id>").replace(/^G-/, "");
const ANALYTICS_COOKIES = [
  {
    name: "_ga",
    purpose: "Google Analytics: tells visits apart with a random ID, so we can count visitors.",
    duration: "2 years",
  },
  {
    name: `_ga_${gaContainer}`,
    purpose: "Google Analytics: keeps track of the current visit (session).",
    duration: "2 years",
  },
];

function CookieTable({
  rows,
}: {
  rows: { name: string; who?: string; purpose: string; duration: string }[];
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
        <thead>
          <tr>
            <th scope="col" className="w-[42%] border-b border-text-2/40 py-2.5 pr-4 font-semibold">
              Cookie
            </th>
            <th scope="col" className="border-b border-text-2/40 py-2.5 pr-4 font-semibold">
              Purpose
            </th>
            <th scope="col" className="border-b border-text-2/40 py-2.5 font-semibold">
              How long
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name}>
              <td className="border-b border-line py-3 pr-4 align-top">
                <code className="text-[14px] break-all">{c.name}</code>
                {c.who && <div className="text-small">{c.who}</div>}
              </td>
              <td className="border-b border-line py-3 pr-4 align-top">{c.purpose}</td>
              <td className="border-b border-line py-3 align-top">{c.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sections: LegalSection[] = [
  {
    id: "cookies-we-set",
    title: "Essential cookies",
    body: (
      <>
        <p>
          All of these are essential: the site can&apos;t do what you ask without them, so they
          don&apos;t need consent. None are set when you only browse the directory.
        </p>
        <CookieTable rows={COOKIES} />
      </>
    ),
  },
  {
    id: "analytics-cookies",
    title: "Analytics cookies (only if you accept)",
    body: (
      <>
        <p>
          On our public pages, a banner asks whether we may use analytics cookies. Only if you
          choose Accept does Google Analytics set these cookies. Until then, and if you decline, it
          sets none (it runs in Google&apos;s Consent Mode with all storage denied). It never runs
          for signed-in users, or in the dashboard, the claim pages, sign-in or admin.
        </p>
        <CookieTable rows={ANALYTICS_COOKIES} />
        <p>
          Your choice itself is kept in your browser&apos;s local storage (<code>yta-consent</code>,
          not a cookie) until you clear it, so we don&apos;t ask again on every page. Change it any
          time with{" "}
          <CookieSettingsButton className="font-medium text-accent underline underline-offset-2" />{" "}
          (also in the footer).
        </p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics without cookies",
    body: (
      <p>
        We also count visits with Vercel Web Analytics, which doesn&apos;t use cookies or identify
        you. Agency profile statistics use a visitor code that changes every day and isn&apos;t
        stored in your browser. Our <Link href="/privacy">privacy policy</Link> explains both.
      </p>
    ),
  },
  {
    id: "advertising-cookies",
    title: "Advertising cookies",
    body: (
      <p>
        Our guides may show ads through Google AdSense. Google and its partners can set cookies to
        show and measure those ads, including ads based on your earlier visits to this and other
        sites. In the EEA, the UK and Switzerland, Google asks for your consent first. Elsewhere,
        you can turn off personalized ads in{" "}
        <a href="https://adssettings.google.com">Google&apos;s ad settings</a>. Ads never run in the
        dashboard, the claim pages, sign-in or admin.
      </p>
    ),
  },
  {
    id: "no-tracking",
    title: "What we don't use",
    body: (
      <p>
        No social media tracking pixels. Outside the ads above, no cross-site tracking. Share buttons on our guides are plain links:
        nothing loads from those networks until you click one.
      </p>
    ),
  },
  {
    id: "managing-cookies",
    title: "Managing cookies",
    body: (
      <p>
        Signing out removes the sign-in cookie. Cookie settings (in the footer) changes your
        analytics choice. You can also delete or block cookies in your browser settings; if you
        block the sign-in cookie, you won&apos;t be able to sign in.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title={TITLE}
      description={DESCRIPTION}
      path="/cookies"
      updated={UPDATED}
      contactEmail={COMPANY.email}
      summary={[
        "Our guides may show Google ads, which can use cookies. In the EEA, the UK and Switzerland, Google asks for your consent first.",
        "Essential cookies keep you signed in, plus two admin-area preferences.",
        "Google Analytics cookies are set only if you accept them; change your choice any time in Cookie settings.",
      ]}
      sections={sections}
    />
  );
}
