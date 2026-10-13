"use client";

import { useEffect } from "react";

import { track } from "@/lib/track";

/**
 * One GA event per 404: "page_not_found" with the path only (no query string). track() applies
 * the consent and signed-in rules; GA may load a moment after the page, so this waits briefly.
 */
export function NotFoundTracker() {
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      const ready = "gtag" in window;
      if (ready) track("page_not_found", { path: location.pathname });
      if (ready || ++tries >= 10) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, []);
  return null;
}
