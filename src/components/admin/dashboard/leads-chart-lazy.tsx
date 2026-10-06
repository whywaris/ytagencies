"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/admin/ui";
import type { PeriodId } from "@/lib/periods";

import type { Point } from "./leads-chart";

// Recharts is only loaded on the dashboard, after the page shell (§3: lazy-load charts).
const LeadsChart = dynamic(() => import("./leads-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

export function LeadsChartLazy({ data, period }: { data: Point[]; period: PeriodId }) {
  // Keyed on the period: new data fades in over 200ms rather than redrawing from zero.
  return (
    <div key={period} className="animate-in duration-200 fade-in-0 motion-reduce:animate-none">
      <LeadsChart data={data} period={period} />
    </div>
  );
}
