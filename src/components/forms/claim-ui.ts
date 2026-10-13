// Claim card buttons, shared by the claim page (server) and its forms (client). Plain module:
// values exported from a "use client" file can't be used on the server.
export const btnPrimary =
  "inline-flex h-[46px] w-full items-center justify-center rounded-full bg-accent px-[22px] text-[15px] font-semibold text-on-accent shadow-[0_1px_2px_rgba(31,94,255,.3),0_8px_20px_-6px_rgba(31,94,255,.45)] transition-transform duration-150 motion-safe:hover:-translate-y-px disabled:opacity-60";
export const btnLight =
  "inline-flex h-[46px] w-full items-center justify-center rounded-full border border-line bg-raised px-[22px] text-[15px] font-semibold hover:border-text-2";
