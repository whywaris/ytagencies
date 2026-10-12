"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

// The theme lives on <html data-site-theme> (set before paint by app/layout.tsx) and in
// localStorage "yta-theme". Icons switch with CSS so the server HTML is right in both themes;
// the label follows after hydration.
const KEY = "yta-theme";
const root = () => document.documentElement;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ["data-site-theme"] });
  return () => observer.disconnect();
}
const isDark = () => root().dataset.siteTheme === "dark";

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return (
    <button
      type="button"
      data-keep-open=""
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = !isDark();
        if (next) root().dataset.siteTheme = "dark";
        else delete root().dataset.siteTheme;
        try {
          localStorage.setItem(KEY, next ? "dark" : "light");
        } catch {}
      }}
      className={cn(
        "flex size-[38px] shrink-0 items-center justify-center rounded-full border border-line bg-raised text-text transition-colors duration-150 hover:border-text-2",
        className,
      )}
    >
      <Moon aria-hidden className="size-[18px] [stroke-width:1.75] site-dark:hidden" />
      <Sun aria-hidden className="hidden size-[18px] [stroke-width:1.75] site-dark:block" />
    </button>
  );
}
