"use client";

import { useEffect } from "react";

// Profile analytics (ADMIN_V2_SPEC §7): a view on load, and clicks on elements marked
// data-track="website_click" | "contact_open". navigator.sendBeacon keeps the page static and
// never delays navigation. The server dedupes per visitor per day and ignores bots.

type TrackedType = "profile_view" | "website_click" | "contact_open";

function send(agencyId: string, type: TrackedType) {
  const body = JSON.stringify({ agencyId, type, path: location.pathname });
  try {
    navigator.sendBeacon?.("/api/events", body);
  } catch {
    // Analytics must never break the page.
  }
}

export function AgencyTracker({ agencyId }: { agencyId: string }) {
  useEffect(() => {
    send(agencyId, "profile_view");
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
      const type = el?.dataset.track;
      if (type === "website_click" || type === "contact_open") send(agencyId, type);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [agencyId]);
  return null;
}
