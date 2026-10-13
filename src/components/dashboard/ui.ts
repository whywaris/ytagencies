import { absoluteUrl, BRAND_NAME } from "@/lib/site";

// Dashboard look (docs/mockups/agency-dashboard.html), on the public tokens.
export const btn =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-full px-[18px] text-[14.5px] font-semibold whitespace-nowrap transition-[transform,border-color] duration-150";
export const btnPrimary = `${btn} bg-accent text-on-accent shadow-[0_1px_2px_rgba(31,94,255,.3),0_8px_20px_-6px_rgba(31,94,255,.45)] motion-safe:hover:-translate-y-px`;
export const btnLight = `${btn} border border-line bg-raised text-text hover:border-text-2`;
export const card = "min-w-0 rounded-[18px] border border-line bg-raised px-[22px] py-5";
export const cardTitle = "text-[16.5px] font-[650] tracking-[-0.01em]";
export const cardSub = "mt-1 text-[13.5px] text-text-2";
export const linkCls = "font-semibold text-accent hover:underline";

/** The embed code for the "Listed on" badge (/badge.svg), linking to the agency's profile. */
export const badgeCode = (slug: string) =>
  `<a href="${absoluteUrl(`/agency/${slug}`)}"><img src="${absoluteUrl("/badge.svg")}" alt="Listed on ${BRAND_NAME}" width="180" height="40"></a>`;
