import { BRAND_NAME, CONTACT_EMAIL } from "./site";

// Company facts: the one source for the legal pages, About, Contact, the footer and JSON-LD.
// Never invent any of this. A null value is a TODO only the owner can fill in; pages hide what's
// missing, and `pnpm build` prints the list (companyTodos, called from next.config.ts).
// Relative import only, so next.config.ts can load this file.

export const COMPANY = {
  /** The name people know us by. */
  tradingName: BRAND_NAME,
  /** TODO: registered legal name, e.g. "Example Media Ltd". Used in the terms and the footer. */
  legalName: null as string | null,
  /** Country the business is run from. */
  country: "Pakistan" as string | null,
  /** ISO 3166-1 alpha-2 code for `country` (JSON-LD addressCountry). */
  countryCode: "PK" as string | null,
  city: "Multan" as string | null,
  /** The year YT Agencies started (/about, Organization foundingDate). */
  foundedYear: 2026,
  /** Optional: a postal address, shown only if you want it public. Not a launch TODO. */
  address: null as string | null,
  /** The law and courts for the terms. */
  jurisdiction: "Pakistan" as string | null,

  /** The one contact address for every topic (questions, press, privacy). */
  email: CONTACT_EMAIL,

  /** Our social profiles: the footer icons and Organization JSON-LD sameAs, in that order. */
  social: {
    x: "https://x.com/ytagencies",
    linkedin: "https://www.linkedin.com/company/ytagencies",
    youtube: "https://www.youtube.com/@YTAgencies",
    instagram: "https://www.instagram.com/ytagencies/",
    threads: "https://www.threads.com/@ytagencies",
    facebook: "https://www.facebook.com/ytagencies/",
  },

  /**
   * How quickly each inbox answers, as a phrase ("within 2 business days"). Privacy requests have
   * the legal limit (one month under GDPR); the others are TODO promises only you can make.
   */
  responseTimes: {
    general: null as string | null,
    privacy: "within 30 days",
  },

  /** TODO: the founder card on /about (shown once name, role and bio are filled). */
  founder: {
    name: "Waris Jamil" as string | null,
    role: "Founder" as string | null,
    /** Two or three plain sentences. */
    bio: "Waris Jamil is a freelancer from Multan, Pakistan, who works with YouTube creators and built ytcrew.com, a free YouTube creator toolkit. He writes YT Agencies' guides on YouTube marketing costs, growth and hiring." as string | null,
    /** Optional: a square photo in /public, e.g. "/team/founder.jpg". */
    photoPath: null as string | null,
    /** Optional: https://www.linkedin.com/in/… */
    linkedinUrl: "https://www.linkedin.com/in/whywaris/" as string | null,
  },

  /**
   * TODO: how often every guide is re-checked, as a phrase ("at least once a year"). A promise on
   * /editorial-policy, so only you can set it; until then the page doesn't make one.
   */
  guideReviewCycle: null as string | null,

  /**
   * How long personal data is kept before the daily cron deletes it (lib/retention.ts). The
   * privacy policy reads these, so changing a number here changes both.
   */
  retention: {
    /** Old inquiries (leads) from the agency directory, still purged on schedule. */
    leadsMonths: 24,
    /** Contact-form messages, counted from when they were closed. Open ones are kept. */
    closedMessagesMonths: 12,
  },
} as const;

/** The name to put after ©: the legal name once it's filled in. */
export const copyrightName = () => COMPANY.legalName ?? COMPANY.tradingName;

/** Unfilled facts, for the launch checklist (printed by `pnpm build`). */
export function companyTodos() {
  const todos: string[] = [];
  const need = (value: string | null, label: string) => value === null && todos.push(label);
  need(COMPANY.legalName, "legalName (registered company name)");
  need(COMPANY.country, "country");
  need(COMPANY.city, "city");
  need(COMPANY.jurisdiction, "jurisdiction (governing law for the terms)");
  need(COMPANY.responseTimes.general, 'responseTimes.general (e.g. "within 2 business days")');
  need(COMPANY.founder.name, "founder.name");
  need(COMPANY.founder.role, "founder.role");
  need(COMPANY.founder.bio, "founder.bio");
  need(COMPANY.founder.photoPath, "founder.photoPath (optional)");
  need(COMPANY.founder.linkedinUrl, "founder.linkedinUrl (optional)");
  need(COMPANY.guideReviewCycle, 'guideReviewCycle (e.g. "at least once a year")');
  return todos;
}
