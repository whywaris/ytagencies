"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

// Guide search: a plain GET form to /guides (works without JavaScript); with it, typing updates the
// URL 300ms after the last key, without a full reload.
export function GuideSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <form action="/guides" method="get" role="search" className="w-full">
      <label htmlFor="guide-q" className="sr-only">
        Search guides
      </label>
      <div className="flex items-center gap-2.5 rounded-[16px] border border-line bg-raised px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
        <Search className="size-5 shrink-0 text-text-2" aria-hidden />
        <input
          id="guide-q"
          type="search"
          name="q"
          defaultValue={initial}
          maxLength={100}
          placeholder="Search guides"
          onChange={(e) => {
            const q = e.target.value.trim();
            clearTimeout(timer.current);
            timer.current = setTimeout(
              () => router.replace(q ? `/guides?q=${encodeURIComponent(q)}` : "/guides", { scroll: false }),
              300,
            );
          }}
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-2"
        />
      </div>
    </form>
  );
}
