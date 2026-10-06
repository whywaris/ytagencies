"use client";

import { useEffect, useState } from "react";

import { formatCount } from "@/lib/format";

/**
 * KPI number (ADMIN_V2_SPEC §3): counts up from 0 once on first mount (600ms, ease-out), then
 * shows new values in place without animating again. No motion with prefers-reduced-motion.
 * The server renders the real value, so it's right before JavaScript runs too.
 */
export function CountUp({ value }: { value: number }) {
  const [progress, setProgress] = useState(1); // 1 = finished: show the value as is

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(t) {
      const p = Math.min(1, (t - start) / 600);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []); // first mount only

  const eased = 1 - (1 - progress) ** 3;
  return <span className="num">{formatCount(Math.round(value * eased))}</span>;
}
