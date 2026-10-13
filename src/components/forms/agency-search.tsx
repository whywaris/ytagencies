"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { searchAgencies, type FoundAgency } from "@/lib/actions/listing";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
const host = (url: string | null) => url?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
const count = new Intl.NumberFormat("en-US");

const btnPrimary =
  "inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-[15.5px] font-semibold whitespace-nowrap text-on-accent shadow-[0_1px_2px_rgba(31,94,255,.3),0_8px_20px_-6px_rgba(31,94,255,.45)] transition-transform duration-150 motion-safe:hover:-translate-y-px disabled:opacity-60";
const btnSm =
  "inline-flex h-[38px] items-center justify-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap";

/** /list-your-agency hero: find an existing listing to manage, or add a new one. */
export function AgencySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; agencies: FoundAgency[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    startTransition(async () => setResults({ query: q, agencies: await searchAgencies(q) }));
  };

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <form
        role="search"
        onSubmit={onSubmit}
        className="mt-8 flex flex-col gap-2 rounded-[20px] border border-line bg-raised p-1.5 shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.16)] focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--accent-soft)] sm:flex-row sm:rounded-full"
      >
        <label htmlFor="agency-search" className="sr-only">
          Your agency name or website
        </label>
        <input
          id="agency-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Your agency name or website"
          minLength={2}
          maxLength={100}
          autoComplete="organization"
          className="h-12 min-w-0 flex-1 bg-transparent px-[18px] text-[16px] outline-none placeholder:text-text-2"
        />
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Searching…" : "Find my agency"}
        </button>
      </form>
      <p className="mt-3.5 text-[14.5px] text-text-2">
        {results?.agencies.length
          ? "Not the right one?"
          : "We may have listed you already. Not listed?"}{" "}
        <Link href="/list-your-agency/new" className="font-semibold text-accent hover:underline">
          Add your agency
        </Link>
      </p>

      <div aria-live="polite" className="mt-4 text-left">
        {results &&
          (results.agencies.length === 0 ? (
            <p className="rounded-2xl border border-line bg-raised px-4 py-3.5 text-[15px]">
              Nothing matches &ldquo;{results.query}&rdquo;. Add your agency instead: it&apos;s
              free.
            </p>
          ) : (
            <ul className="grid gap-2">
              {results.agencies.map((a) => (
                <li
                  key={a.slug}
                  className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-line bg-raised px-4 py-3.5"
                >
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-(--violet-soft) text-[14px] font-[650] text-(--violet-on-soft)"
                  >
                    {initials(a.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/agency/${a.slug}`}
                      className="block truncate text-[15px] font-semibold hover:underline"
                    >
                      {a.name}
                    </Link>
                    <span className="block truncate text-[13px] text-text-2">
                      {[host(a.website), a.service].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="ml-auto text-right">
                    {a.ownership === "mine" ? (
                      <Link
                        href={`/dashboard/${a.agencyId}`}
                        className={`${btnSm} border border-line bg-raised hover:border-text-2`}
                      >
                        Go to dashboard
                      </Link>
                    ) : a.ownership === "other" ? (
                      <p className="text-[13.5px] text-text-2">
                        Already managed
                        <br />
                        <Link
                          href={`/claim/${a.slug}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          Is this your agency? Request access
                        </Link>
                      </p>
                    ) : (
                      <>
                        {a.views !== null && (
                          <span className="mb-1.5 block text-[12.5px] text-text-2 tabular-nums">
                            {count.format(a.views)} businesses viewed this profile in the last 30
                            days
                          </span>
                        )}
                        <Link
                          href={`/claim/${a.slug}`}
                          className={`${btnSm} bg-accent text-on-accent`}
                        >
                          Manage this listing<span className="sr-only">: {a.name}</span>
                        </Link>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
