// Profile strength on the claim welcome screen and the dashboard: what's done and what each
// missing piece adds. Pure, no imports: tested. Weights add up to 100. These are the parts that
// also feed the quality score (lib/ranking.ts) or that businesses ask about most.

export type StrengthInput = {
  hasLogo: boolean;
  descriptionLength: number;
  hasBestFor: boolean;
  hasStartingPrice: boolean;
  hasContract: boolean;
  /** Every chosen service has a focus %. */
  hasServiceFocus: boolean;
  hasLocation: boolean;
  channels: number;
  caseStudies: number;
};

export type StrengthSection = "profile" | "channels" | "case-studies";

const ITEMS: {
  key: string;
  label: string;
  gain: number;
  section: StrengthSection;
  done: (i: StrengthInput) => boolean;
}[] = [
  {
    key: "pricing",
    label: "Pricing and contract",
    gain: 15,
    section: "profile",
    done: (i) => i.hasStartingPrice && i.hasContract,
  },
  {
    key: "focus",
    label: "Services and focus",
    gain: 10,
    section: "profile",
    done: (i) => i.hasServiceFocus,
  },
  {
    key: "description",
    label: "A description of 200+ characters",
    gain: 15,
    section: "profile",
    done: (i) => i.descriptionLength >= 200,
  },
  {
    key: "best-for",
    label: "Who you're best for",
    gain: 10,
    section: "profile",
    done: (i) => i.hasBestFor,
  },
  { key: "logo", label: "Your logo", gain: 10, section: "profile", done: (i) => i.hasLogo },
  {
    key: "location",
    label: "Where you're based",
    gain: 10,
    section: "profile",
    done: (i) => i.hasLocation,
  },
  {
    key: "channels",
    label: "Channels you've worked on",
    gain: 15,
    section: "channels",
    done: (i) => i.channels > 0,
  },
  {
    key: "case-study",
    label: "A case study",
    gain: 15,
    section: "case-studies",
    done: (i) => i.caseStudies > 0,
  },
];

export function profileStrength(input: StrengthInput) {
  const items = ITEMS.map(({ done, ...item }) => ({ ...item, done: done(input) }));
  const percent = items.reduce((n, i) => n + (i.done ? i.gain : 0), 0);
  // Done first, then the missing ones by what they add.
  items.sort((a, b) => Number(b.done) - Number(a.done) || b.gain - a.gain);
  return { percent, items };
}
