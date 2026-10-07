import { Plus } from "lucide-react";

import { SponsoredSlotDialog, type SlotValues } from "@/components/admin/sponsored-slot-dialog";
import { Empty, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getIndustries, getLocations, getServices } from "@/lib/data/taxonomy";
import { formatCurrency, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sponsored" };

const DAY = 86_400_000;
const POSITIONS = [1, 2, 3] as const;
const STATUS = {
  active: { label: "Active", dot: "bg-success" },
  scheduled: { label: "Scheduled", dot: "bg-accent" },
  expired: { label: "Expired", dot: "bg-text-2" },
} as const;

const ymd = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export default async function AdminSponsoredPage() {
  await requireAdmin("/admin/sponsored");
  const db = createAdminClient();
  const now = new Date();
  const [slots, eligible, services, industries, locations] = await Promise.all([
    db
      .from("sponsored_slots")
      .select(
        "id, service_id, industry_id, location_id, agency_id, position, starts_at, ends_at, price_usd, agencies(name)",
      )
      // Active, scheduled, and anything that ended in the last 30 days.
      .gte("ends_at", new Date(now.getTime() - 30 * DAY).toISOString())
      .order("starts_at"),
    db
      .from("admin_agency_list")
      .select("id, name")
      .eq("status", "published")
      .eq("is_verified", true)
      .in("plan", ["founding", "verified"])
      .order("name"),
    getServices(),
    getIndustries(),
    getLocations(),
  ]);
  if (slots.error || eligible.error) throw new Error("Couldn't load sponsored slots");

  const svc = new Map(services.map((s) => [s.id, s]));
  const ind = new Map(industries.map((i) => [i.id, i]));
  const loc = new Map(locations.map((l) => [l.id, l]));
  const status = (s: { starts_at: string; ends_at: string }) =>
    new Date(s.starts_at) > now ? "scheduled" : new Date(s.ends_at) > now ? "active" : "expired";

  type Row = (typeof slots.data)[number];
  const pages = new Map<
    string,
    {
      label: string;
      values: Omit<SlotValues, "agencyId" | "position" | "startsOn" | "endsOn" | "price">;
      slots: Row[];
    }
  >();
  for (const s of slots.data) {
    const service = svc.get(s.service_id);
    if (!service) continue;
    const i = s.industry_id ? ind.get(s.industry_id) : null;
    const l = s.location_id ? loc.get(s.location_id) : null;
    const key = `${s.service_id}|${s.industry_id ?? 0}|${s.location_id ?? 0}`;
    const page = pages.get(key) ?? {
      label: i
        ? `${service.name} for ${i.name}`
        : l
          ? `${service.name} in ${l.name}`
          : `${service.name} (hub)`,
      values: {
        service: service.slug,
        kind: i ? ("industry" as const) : l ? ("location" as const) : ("hub" as const),
        segment: i?.slug ?? l?.slug ?? "",
      },
      slots: [],
    };
    page.slots.push(s);
    pages.set(key, page);
  }

  const options = {
    services: services.map((s) => ({ value: s.slug, label: s.name })),
    industries: industries.map((i) => ({ value: i.slug, label: i.name })),
    locations: locations.map((l) => ({ value: l.slug, label: l.name })),
    agencies: eligible.data.map((a) => ({ value: a.id, label: a.name })),
  };
  const blank: SlotValues = {
    service: "",
    kind: "industry",
    segment: "",
    agencyId: "",
    position: "1",
    startsOn: ymd(now),
    endsOn: ymd(new Date(now.getTime() + 30 * DAY)),
    price: "",
  };
  const valuesOf = (
    s: Row,
    page: {
      values:
        SlotValues | Omit<SlotValues, "agencyId" | "position" | "startsOn" | "endsOn" | "price">;
    },
  ): SlotValues => ({
    ...page.values,
    agencyId: s.agency_id,
    position: String(s.position),
    startsOn: ymd(s.starts_at),
    endsOn: ymd(s.ends_at),
    price: s.price_usd === null ? "" : String(s.price_usd),
  });
  const expiring = slots.data
    .filter(
      (s) => status(s) === "active" && new Date(s.ends_at).getTime() - now.getTime() <= 14 * DAY,
    )
    .sort((a, b) => a.ends_at.localeCompare(b.ends_at));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-reading flex-col gap-1">
          <h1 className="text-admin-title">Sponsored</h1>
          <p className="text-text-2">
            Up to 3 sponsored agencies per directory page, shown first and labeled Sponsored.
            Holders need a paid plan and the Verified badge; a slot whose agency loses either stops
            showing.
          </p>
        </div>
        <SponsoredSlotDialog
          slotId={null}
          initial={blank}
          options={options}
          trigger={
            <button
              type="button"
              className="h-9 rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90"
            >
              New slot
            </button>
          }
        />
      </div>

      <section aria-labelledby="expiring" className="flex flex-col gap-4">
        <h2 id="expiring" className="text-admin-section">
          Ending in the next 14 days
        </h2>
        {expiring.length === 0 ? (
          <p className="text-text-2">No active slots end in the next 14 days.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {expiring.map((s) => {
              const page = pages.get(`${s.service_id}|${s.industry_id ?? 0}|${s.location_id ?? 0}`);
              return (
                <li key={s.id} className="flex h-11 items-center gap-3 px-4">
                  <span className="min-w-0 flex-1 truncate">
                    {s.agencies?.name ?? "Deleted agency"}{" "}
                    <span className="text-text-2">
                      on {page?.label}, position {s.position}
                    </span>
                  </span>
                  <span className="shrink-0 text-text-2 num">Ends {formatDate(s.ends_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="pages" className="flex flex-col gap-4">
        <h2 id="pages" className="text-admin-section">
          Pages with slots
        </h2>
        {pages.size === 0 ? (
          <Empty>
            No sponsored slots yet.{" "}
            {options.agencies.length === 0 &&
              "No agency is eligible yet: give one a paid plan in Plans and verify it."}
          </Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th scope="col">Page</th>
                {POSITIONS.map((p) => (
                  <th key={p} scope="col">
                    Position {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...pages.values()]
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((page) => (
                  <tr key={page.label}>
                    <td className="min-w-48 font-medium">{page.label}</td>
                    {POSITIONS.map((pos) => {
                      const here = page.slots.filter((s) => s.position === pos);
                      return (
                        <td key={pos} className="min-w-52 align-top">
                          <div className="flex flex-col gap-1.5 py-1">
                            {here.map((s) => {
                              const st = STATUS[status(s)];
                              return (
                                <SponsoredSlotDialog
                                  key={s.id}
                                  slotId={s.id}
                                  initial={valuesOf(s, page)}
                                  options={options}
                                  trigger={
                                    <button
                                      type="button"
                                      className={cn(
                                        "flex flex-col items-start rounded-md px-2 py-1 text-left transition-colors duration-150 hover:bg-surface-2",
                                        status(s) === "expired" && "text-text-2",
                                      )}
                                    >
                                      <span className="font-medium">
                                        {s.agencies?.name ?? "Deleted agency"}
                                      </span>
                                      <span className="flex items-center gap-1.5 text-admin-meta num">
                                        <span
                                          aria-hidden
                                          className={cn("size-1.5 rounded-full", st.dot)}
                                        />
                                        {st.label}, {formatDate(s.starts_at)} to{" "}
                                        {formatDate(s.ends_at)}
                                        {s.price_usd !== null &&
                                          `, ${formatCurrency(Number(s.price_usd))}`}
                                      </span>
                                    </button>
                                  }
                                />
                              );
                            })}
                            {!here.some((s) => status(s) !== "expired") && (
                              <SponsoredSlotDialog
                                slotId={null}
                                initial={{ ...blank, ...page.values, position: String(pos) }}
                                options={options}
                                trigger={
                                  <button
                                    type="button"
                                    className="flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-text-2 hover:bg-surface-2 hover:text-text"
                                  >
                                    <Plus className="size-4 [stroke-width:1.5]" aria-hidden />
                                    Add slot
                                    <span className="sr-only">
                                      {" "}
                                      to {page.label}, position {pos}
                                    </span>
                                  </button>
                                }
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
