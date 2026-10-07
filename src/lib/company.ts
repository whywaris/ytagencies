import { BRAND_NAME, SITE_DOMAIN } from "./site";

// Company facts: the one source for the legal pages, About, Contact, the footer and JSON-LD.
// Never invent any of this. A null value is a TODO only the owner can fill in; pages hide what's
// missing, and `pnpm build` prints the list (companyTodos, called from next.config.ts).
// Relative import only, so next.config.ts can load this file.

export const COMPANY = {
  /** The name people know us by. */
  tradingName: BRAND_NAME,
  /** TODO: registered legal name, e.g. "Example Media Ltd". Used in the terms and the footer. */
  legalName: null as string | null,
  /** TODO: country the business is registered in. */
  country: null as string | null,
  /** TODO: city. */
  city: null as string | null,
  /** Optional: a postal address, shown only if you want it public. Not a launch TODO. */
  address: null as string | null,
  /** TODO: the law and courts for the terms, e.g. "England and Wales". */
  jurisdiction: null as string | null,

  emails: {
    hello: `hello@${SITE_DOMAIN}`,
    privacy: `privacy@${SITE_DOMAIN}`,
    agencies: `agencies@${SITE_DOMAIN}`,
  },

  /**
   * How quickly each inbox answers, as a phrase ("within 2 business days"). Privacy requests have
   * the legal limit (one month under GDPR); the others are TODO promises only you can make.
   */
  responseTimes: {
    general: null as string | null,
    agencies: null as string | null,
    privacy: "within 30 days",
  },

  /** TODO: the founder card on /about (shown once name, role and bio are filled). */
  founder: {
    name: null as string | null,
    role: null as string | null,
    /** Two or three plain sentences. */
    bio: null as string | null,
    /** Optional: a square photo in /public, e.g. "/team/founder.jpg". */
    photoPath: null as string | null,
    /** Optional: https://www.linkedin.com/in/… */
    linkedinUrl: null as string | null,
  },

  /**
   * TODO: how often every guide is re-checked, as a phrase ("at least once a year"). A promise on
   * /editorial-policy, so only you can set it; until then the page doesn't make one.
   */
  guideReviewCycle: null as string | null,

  /** Refund rules for paid plans (/refunds). */
  refunds: {
    /** Yearly plans: full refund if asked within this many days of purchase. */
    yearlyFullRefundDays: 14,
  },

  /**
   * Payment provider that sells our plans as merchant of record (Lemon Squeezy or Paddle).
   * TODO once payments go live; until then the refund page says plans aren't on sale.
   */
  paymentProvider: null as string | null,
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
  need(COMPANY.responseTimes.agencies, "responseTimes.agencies");
  need(COMPANY.founder.name, "founder.name");
  need(COMPANY.founder.role, "founder.role");
  need(COMPANY.founder.bio, "founder.bio");
  need(COMPANY.founder.photoPath, "founder.photoPath (optional)");
  need(COMPANY.founder.linkedinUrl, "founder.linkedinUrl (optional)");
  need(COMPANY.guideReviewCycle, 'guideReviewCycle (e.g. "at least once a year")');
  need(COMPANY.paymentProvider, "paymentProvider (before payments go live)");
  return todos;
}
