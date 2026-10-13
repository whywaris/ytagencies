"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";

import { CONSENT_KEY } from "@/lib/track";

// Google Analytics 4 with Consent Mode v2, for public pages only (mounted in the (marketing)
// layout, and only when lib/analytics.ts gaId() allows it). Everything starts denied; analytics
// storage is granted only after "Accept", and ad storage never is (we run no ads). Private areas
// never load it, and if a visitor moves there from a public page, GA is switched off
// (ga-disable-<id>) so nothing is sent.

const PRIVATE = /^\/(admin|dashboard|login|claim|auth)(\/|$)/;
/** The footer's "Cookie settings" link opens the banner with this event. */
export const COOKIE_SETTINGS_EVENT = "yta:cookie-settings";

type W = Window & { gtag?: (...args: unknown[]) => void } & Record<string, unknown>;

export function Analytics({ id }: { id: string }) {
  const pathname = usePathname();
  const blocked = PRIVATE.test(pathname);
  const [loaded] = useState(() => !blocked); // decided on the first page; never loaded on private ones
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    (window as unknown as W)[`ga-disable-${id}`] = blocked;
  }, [id, blocked]);
  // Leaving the public layout (e.g. into the dashboard): stop sending.
  useEffect(
    () => () => {
      (window as unknown as W)[`ga-disable-${id}`] = true;
    },
    [id],
  );

  useEffect(() => {
    let choice: string | null = null;
    try {
      choice = localStorage.getItem(CONSENT_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    if (!choice) setBanner(true);
    const open = () => setBanner(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, open);
  }, []);

  const choose = (granted: boolean) => {
    try {
      localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
    } catch {}
    (window as unknown as W).gtag?.("consent", "update", {
      analytics_storage: granted ? "granted" : "denied",
    });
    setBanner(false);
  };

  return (
    <>
      {loaded && (
        <>
          {/* Consent defaults go first, then the stored choice, then config. */}
          <Script id="ga-consent" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
try{if(localStorage.getItem('${CONSENT_KEY}')==='granted')gtag('consent','update',{analytics_storage:'granted'})}catch(e){}
gtag('js',new Date());gtag('config','${id}');`}
          </Script>
          <Script
            id="ga"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
          />
        </>
      )}
      {banner && !blocked && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-[640px] flex-col gap-3 rounded-2xl border border-line bg-raised p-4 text-[14.5px] shadow-[0_1px_2px_rgba(20,25,40,.06),0_12px_32px_-12px_rgba(20,25,40,.2)] motion-safe:animate-[rise-sm_.4s_ease-out] sm:flex-row sm:items-center sm:gap-4 print:hidden"
        >
          <p className="flex-1">
            We use analytics cookies to understand how the site is used.{" "}
            <Link href="/cookies" className="font-medium text-accent hover:underline">
              Cookie policy
            </Link>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => choose(false)}
              className="inline-flex h-10 items-center rounded-full border border-line bg-raised px-4 font-semibold hover:border-text-2"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => choose(true)}
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 font-semibold text-on-accent"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer link that reopens the consent banner. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
    >
      Cookie settings
    </button>
  );
}
