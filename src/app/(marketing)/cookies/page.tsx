import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
import Link from "next/link";

import { PREF_MAX_AGE, SIDEBAR_COOKIE, THEME_COOKIE } from "@/components/admin/shell-prefs";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

// The cookie list comes from the code that sets them: Supabase sign-in (@supabase/ssr defaults,
// cookie name from the project URL) and the admin preferences (components/admin/shell-prefs.ts).
// Add a row here whenever the code starts setting a new cookie.

const UPDATED = "2026-10-07";
const TITLE = "Cookie policy";
const DESCRIPTION =
  "YT Agencies uses no advertising or tracking cookies. Here are the few essential cookies the site sets for signing in and admin settings, and how long they last.";

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

const sections: LegalSection[] = [
  {
    id: "cookies-we-set",
    title: "Cookies we set",
    body: (
      <>
        <p>
          All of these are essential: the site can&apos;t do what you ask without them, so they
          don&apos;t need consent. None are set when you only browse the directory.
        </p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-[42%] border-b border-text-2/40 py-2.5 pr-4 font-semibold"
                >
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
              {COOKIES.map((c) => (
                <tr key={c.name}>
                  <td className="border-b border-line py-3 pr-4 align-top">
                    <code className="text-[14px] break-all">{c.name}</code>
                    <div className="text-small">{c.who}</div>
                  </td>
                  <td className="border-b border-line py-3 pr-4 align-top">{c.purpose}</td>
                  <td className="border-b border-line py-3 align-top">{c.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics without cookies",
    body: (
      <p>
        We count visits with Vercel Web Analytics, which doesn&apos;t use cookies or identify you.
        Agency profile statistics use a visitor code that changes every day and isn&apos;t stored in
        your browser. Our <Link href="/privacy">privacy policy</Link> explains both.
      </p>
    ),
  },
  {
    id: "turnstile",
    title: "Cloudflare Turnstile",
    body: (
      <p>
        Our forms include Cloudflare Turnstile, which checks that you&apos;re not a bot. It runs in
        a frame served by Cloudflare, not by us, and isn&apos;t used for advertising or to follow
        you across sites. Cloudflare&apos;s Turnstile privacy addendum describes what it processes.
      </p>
    ),
  },
  {
    id: "no-tracking",
    title: "What we don't use",
    body: (
      <p>
        No advertising cookies, no social media tracking pixels and no cross-site tracking. Share
        buttons on our guides are plain links: nothing loads from those networks until you click
        one.
      </p>
    ),
  },
  {
    id: "managing-cookies",
    title: "Managing cookies",
    body: (
      <p>
        Signing out removes the sign-in cookie. You can also delete or block cookies in your browser
        settings; if you block the sign-in cookie, you won&apos;t be able to sign in.
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
        "We use no advertising or tracking cookies.",
        "The only cookies we set keep you signed in, plus two admin-area preferences.",
        "Analytics work without cookies and don't identify you.",
      ]}
      sections={sections}
    />
  );
}
