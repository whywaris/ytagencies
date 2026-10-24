// What an agency profile offers visitors (lib/entitlements.ts). Pure, no imports: tested.
//
// Every profile, claimed or not, takes quote requests ("Request a quote from {Agency}"). The
// request goes to that agency; if it doesn't reply as Pro within 48 hours, it goes to up to 3
// similar Pro agencies (lib/lead-fallback.tsx). Profiles not on Pro also suggest similar agencies.

export type ProfileMode = {
  ctaLabel: string;
  ctaHref: "#contact";
  similar: boolean;
};

export function profileMode(a: { managed: boolean; name: string }): ProfileMode {
  return { ctaLabel: `Request a quote from ${a.name}`, ctaHref: "#contact", similar: !a.managed };
}

/** The consent line the quote form shows and requires. */
export const quoteConsent = (agencyName: string) =>
  `Your request goes to ${agencyName}. If they don't reply within 48 hours, we'll send it to up to 3 similar agencies.`;
