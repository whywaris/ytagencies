"use client";

import { useEffect } from "react";

// Directory page views for the agency dashboard ("Where businesses are looking"). Same beacon as
// profile views (/api/events): deduped per visitor per day, bots ignored, the page stays static.
export function PageTracker() {
  useEffect(() => {
    try {
      navigator.sendBeacon?.(
        "/api/events",
        JSON.stringify({ type: "page_view", path: location.pathname }),
      );
    } catch {
      // Analytics must never break the page.
    }
  }, []);
  return null;
}
