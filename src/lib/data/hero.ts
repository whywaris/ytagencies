import "server-only";
import { cache } from "react";

import { getAgenciesForCombo, getDirectoryIndex } from "@/lib/data/agencies";
import { getPlacement } from "@/lib/data/placement";
import { getIndustries, getServices } from "@/lib/data/taxonomy";
import { formatUsd, priceSuffix } from "@/lib/directory";
import { noLockIn } from "@/lib/pricing";
import { createStaticClient } from "@/lib/supabase/server";

// Home hero product window: one tab per service that has a service × industry page with at
// least MIN_AGENCIES_TO_INDEX published agencies (the indexable combos). All real data, loaded
// here and handed to a small client component; switching tabs fetches nothing.

export type HeroAgency = {
  slug: string;
  name: string;
  logoPath: string | null;
  initials: string;
  /** "Austin, 11–50 people"; empty when neither is known. */
  meta: string;
  isVerified: boolean;
  /** Case-study channels that match the agency's verified YouTube stats (max 2). */
  channels: { title: string; subscribers: number | null }[];
  /** Shown instead of channels when there are none (max 2). */
  industries: string[];
  /** Month-to-month (lib/pricing.ts noLockIn): the "No lock-in" chip. */
  noLockIn: boolean;
  /** { amount: "$2k", suffix: "/mo" }; null without a starting price ("Price on request"). */
  price: { amount: string; suffix: string } | null;
};

export type HeroTab = {
  serviceSlug: string;
  /** "YouTube Ads" */
  serviceName: string;
  industryName: string;
  /** "/youtube-ads-agencies/for-doctors" */
  path: string;
  count: number;
  agencies: HeroAgency[];
};

const people = (teamSize: string | null) =>
  teamSize ? `${teamSize.replace("-", "–")} people` : "";

export const getHeroTabs = cache(async (): Promise<HeroTab[]> => {
  const [index, services, industries] = await Promise.all([
    getDirectoryIndex(),
    getServices(),
    getIndustries(),
  ]);

  // Per service: the doctors page if it qualifies, else the industry page with most agencies.
  const picks = services.flatMap((service) => {
    const candidates = index.combos
      .filter((c) => c.serviceSlug === service.slug && c.segment.startsWith("for-"))
      .map((c) => ({ ...c, industry: industries.find((i) => `for-${i.slug}` === c.segment) }))
      .filter((c) => c.industry !== undefined)
      .sort((a, b) => b.count - a.count || a.industry!.name.localeCompare(b.industry!.name));
    const pick = candidates.find((c) => c.industry!.slug === "doctors") ?? candidates[0];
    return pick ? [{ service, industry: pick.industry! }] : [];
  });
  if (picks.length === 0) return [];

  const [lists, placement] = await Promise.all([
    Promise.all(
      picks.map(({ service, industry }) =>
        getAgenciesForCombo(service.id, { kind: "industry", slug: industry.slug, industry }),
      ),
    ),
    getPlacement(),
  ]);

  // Case-study channel IDs for the agencies on show (anon client: published agencies only). The
  // IDs were resolved from the links when the case studies were saved: no YouTube calls here.
  const shownIds = [...new Set(lists.flatMap((l) => l.slice(0, 3).map((a) => a.id)))];
  const { data: studies, error } = await createStaticClient()
    .from("case_studies")
    .select("agency_id, channel_id, created_at")
    .in("agency_id", shownIds)
    .not("channel_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  /** Channels from the agency's case studies that its latest verified stats check covers. */
  const channelsOf = (agencyId: string) => {
    const stats = placement.channels(agencyId);
    if (!stats.length) return [];
    const ids = studies.flatMap((s) =>
      s.agency_id === agencyId && s.channel_id ? [s.channel_id] : [],
    );
    return [...new Set(ids)]
      .flatMap((id) => stats.filter((c) => c.channelId === id))
      .slice(0, 2)
      .map((c) => ({ title: c.title, subscribers: c.subscribers }));
  };

  return picks.map(({ service, industry }, i) => ({
    serviceSlug: service.slug,
    serviceName: service.name,
    industryName: industry.name,
    path: `/${service.slug}/for-${industry.slug}`,
    count: lists[i].length,
    agencies: lists[i].slice(0, 3).map((a) => ({
      slug: a.slug,
      name: a.name,
      logoPath: a.logoPath,
      initials: a.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join(""),
      meta: [a.hq?.name, people(a.teamSize)].filter(Boolean).join(", "),
      isVerified: a.isVerified,
      noLockIn: noLockIn(a.minContract),
      channels: channelsOf(a.id),
      industries: a.industries.slice(0, 2).map((t) => t.name),
      price:
        a.minBudgetUsd === null
          ? null
          : { amount: formatUsd(a.minBudgetUsd), suffix: priceSuffix(a.pricingModel) },
    })),
  }));
});
