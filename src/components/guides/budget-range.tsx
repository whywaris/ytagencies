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
    <aside className="mb-6 rounded-lg bg-surface p-5">
      <p className="mb-2 font-medium">From our directory today</p>
      <p className="mb-0 text-text-2">
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
