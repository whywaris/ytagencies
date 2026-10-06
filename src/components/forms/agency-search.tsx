"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchAgencies, type FoundAgency } from "@/lib/actions/listing";

/** Step 1 of /list-your-agency: find an existing listing to claim. */
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
    <div className="flex flex-col gap-6">
      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="agency-search" className="sr-only">
          Agency name or website
        </label>
        <Input
          id="agency-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Agency name or website"
          minLength={2}
          maxLength={100}
          autoComplete="organization"
          className="sm:flex-1"
        />
        <Button type="submit" disabled={pending} className="sm:w-auto">
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>

      <div aria-live="polite">
        {results &&
          (results.agencies.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-text-2">
                {results.agencies.length === 1
                  ? "1 listing matches"
                  : `${results.agencies.length} listings match`}{" "}
                &ldquo;{results.query}&rdquo;.
              </p>
              <ul className="flex flex-col gap-3">
                {results.agencies.map((a) => (
                  <li
                    key={a.slug}
                    className="flex flex-col gap-3 rounded-lg border border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link href={`/agency/${a.slug}`} className="font-medium hover:underline">
                        {a.name}
                      </Link>
                      {a.website && (
                        <p className="truncate text-small">
                          {a.website.replace(/^https?:\/\/(www\.)?/, "")}
                        </p>
                      )}
                    </div>
                    {a.isClaimed ? (
                      <span className="text-small">Already claimed</span>
                    ) : (
                      <Button asChild variant="link" className="shrink-0 self-start sm:self-auto">
                        <Link href={`/agency/${a.slug}/claim`}>
                          Claim this listing<span className="sr-only">: {a.name}</span>
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-lg bg-surface p-5">
              No listing matches &ldquo;{results.query}&rdquo;.{" "}
              <Link href="/list-your-agency/new" className="text-accent hover:underline">
                Add your agency
              </Link>{" "}
              instead.
            </p>
          ))}
      </div>
    </div>
  );
}
