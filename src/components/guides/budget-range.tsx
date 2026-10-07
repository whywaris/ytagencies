import { ChartColumn } from "lucide-react";
import Link from "next/link";

import { getAgenciesForService } from "@/lib/data/agencies";
import { getServiceBySlug } from "@/lib/data/taxonomy";
import { formatUsd } from "@/lib/directory";

/** Live minimum-budget range for a service, from published listings. Used inside guides. */
export async function BudgetRange({ service }: { service: string }) {
  const s = await getServiceBySlug(service);
  if (!s) return null;
  const budgets = (await getAgenciesForService(s.id)).flatMap((a) =>
    a.minBudgetUsd === null ? [] : [a.minBudgetUsd],
  );
  if (budgets.length < 3) return null; // too few listings to say anything useful
  const sorted = [...budgets].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return (
    <aside className="my-8 flex flex-col gap-2 rounded-2xl border border-accent/25 bg-accent/5 p-6">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-accent">
        <ChartColumn className="size-4 [stroke-width:1.75]" aria-hidden />
        From our directory today
      </p>
      <p className="mb-0 text-[18px]">
        The {budgets.length} {s.name} agencies listed with a minimum budget ask for between{" "}
        {formatUsd(sorted[0])} and {formatUsd(sorted[sorted.length - 1])} to start, with a middle
        figure of {formatUsd(median)}.{" "}
        <Link href={`/${s.slug}`} className="text-accent underline underline-offset-2">
          Compare them
        </Link>
        .
      </p>
    </aside>
  );
}
