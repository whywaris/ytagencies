// What an agency profile offers visitors, managed or not (lib/entitlements.ts). Pure, no
// imports: tested.
//
// Managed (live Pro): contact form, website link, reply time, no similar agencies.
// Unmanaged: no way to reach the agency through us, so the call to action is Request proposals with
// similar (managed) agencies, prefilled with this agency's main service and industry.

export type ProfileMode =
  | { kind: "contact"; ctaLabel: string; ctaHref: "#contact"; note: null; similar: false }
  | { kind: "match"; ctaLabel: string; ctaHref: string; note: string; similar: true };

export function profileMode(a: {
  managed: boolean;
  name: string;
  slug: string;
  mainService: string | null;
  mainIndustry: string | null;
}): ProfileMode {
  if (a.managed)
    return {
      kind: "contact",
      ctaLabel: "Contact agency",
      ctaHref: "#contact",
      note: null,
      similar: false,
    };
  const q = new URLSearchParams();
  if (a.mainService) q.set("service", a.mainService);
  if (a.mainIndustry) q.set("industry", a.mainIndustry);
  q.set("ref", `profile:${a.slug}`);
  return {
    kind: "match",
    ctaLabel: "Request proposals from similar agencies",
    ctaHref: `/request-proposals?${q}`,
    note: `${a.name} hasn't joined YT Agencies yet, so we can't pass messages to them. We'll match you with similar agencies that reply.`,
    similar: true,
  };
}
