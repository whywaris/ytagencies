"use client";

import { useEffect, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatCount, formatDelta } from "@/lib/format";
import type { PeriodId } from "@/lib/periods";

// Leads over time (ADMIN_V2_SPEC §3 Charts): current period in the accent, previous period as a
// dashed --text-2 line at 60%. Draws in once per session (700ms); later period changes crossfade
// (the parent keys a fade wrapper) instead of redrawing from zero.

export type Point = { start: string; current: number; previous: number };

const config = {
  current: { label: "This period", color: "var(--accent)" },
  previous: { label: "Previous period", color: "var(--text-2)" },
} satisfies ChartConfig;

// Per browser session: once the chart has drawn in, later mounts (period changes) just appear.
const session = { drawn: false };

function label(start: string, period: PeriodId, long = false) {
  const d = new Date(start);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    ...(period === "12m" ? (long ? { year: "numeric" } : {}) : { day: "numeric" }),
  });
}

export default function LeadsChart({ data, period }: { data: Point[]; period: PeriodId }) {
  const [animate] = useState(
    () => !session.drawn && !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    session.drawn = true;
  }, []);
  const tick = { fontSize: 12, fill: "var(--text-2)", fontVariantNumeric: "tabular-nums" };

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.5} />
        <XAxis
          dataKey="start"
          tickFormatter={(v: string) => label(v, period)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tick={tick}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={32}
          tick={tick}
          tickFormatter={(v: number) => formatCount(v)}
        />
        <Tooltip
          cursor={{ stroke: "var(--text-2)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
            if (!p) return null;
            const change = p.previous === 0 ? null : (p.current - p.previous) / p.previous;
            return (
              <div className="rounded-lg border border-line bg-bg px-3 py-2 text-[12px] leading-4 shadow-lg">
                <p className="text-text-2 num">{label(p.start, period, true)}</p>
                <p className="mt-1 text-[14px] leading-5 font-medium">
                  <span className="num">{formatCount(p.current)}</span>{" "}
                  {p.current === 1 ? "lead" : "leads"}
                </p>
                <p className="text-text-2 num">
                  {change === null
                    ? `${formatCount(p.previous)} in the previous period`
                    : `${formatDelta(change)} vs ${formatCount(p.previous)} before`}
                </p>
              </div>
            );
          }}
        />
        <Line
          dataKey="previous"
          type="monotone"
          stroke="var(--color-previous)"
          strokeOpacity={0.6}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
          activeDot={false}
          isAnimationActive={animate}
          animationDuration={700}
          animationEasing="ease-out"
        />
        <Area
          dataKey="current"
          type="monotone"
          stroke="var(--color-current)"
          strokeWidth={2}
          fill="var(--color-current)"
          fillOpacity={0.08}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
          isAnimationActive={animate}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </ComposedChart>
    </ChartContainer>
  );
}
