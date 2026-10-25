import { ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";

import { imageSize } from "@/lib/guide-content";
import type { BlockAttrs, BlockType } from "@/lib/guide-blocks";
import { cn } from "@/lib/utils";

// Guide blocks (lib/guide-blocks.ts), rendered the same way on the public guide page and inside the
// editor (as node views): one component per block, no data fetching here. Text is plain text
// (React escapes it), buttons link only within the site, outside links are nofollow.

export type DirectoryStatsData = {
  agencies: number;
  verified: number;
  offering: number;
  serviceName: string | null;
};

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const rows = (v: unknown): Row[] =>
  Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object") : [];
const lines = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
const paragraphs = (text: string) => text.split(/\n\s*\n/).filter((p) => p.trim());

/** rel for links to other platforms: never pass ranking credit, never leak the referrer. */
export const OUTSIDE_REL = "nofollow noopener noreferrer";
const count = new Intl.NumberFormat("en-US");

const tableWrap = "mb-8 overflow-x-auto";
const table = "w-full min-w-[560px] border-collapse text-left text-[16px]";
const th = "border-b border-text-2/40 px-3 py-2.5 font-semibold first:pl-0";
const td = "border-b border-line px-3 py-2.5 align-top first:pl-0";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2";

function ComparisonTable({ a }: { a: BlockAttrs }) {
  const list = rows(a.rows);
  if (!list.length) return null;
  return (
    <div className={tableWrap} role="region" aria-label="Comparison table" tabIndex={0}>
      <table className={table}>
        <thead>
          <tr>
            <th scope="col" className={th}>Name</th>
            <th scope="col" className={th}>Best for</th>
            <th scope="col" className={th}>Starting price</th>
            <th scope="col" className={th}>Key difference</th>
            <th scope="col" className={th}><span className="sr-only">Read more</span></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={i} className={cn(i === 0 && a.highlightFirst === true && "bg-(--accent-soft)")}>
              <th scope="row" className={cn(td, "font-semibold", i === 0 && a.highlightFirst === true && "pl-3 first:pl-3")}>
                {s(r.name)}
              </th>
              <td className={td}>{s(r.bestFor)}</td>
              <td className={cn(td, "tabular-nums")}>{s(r.price)}</td>
              <td className={td}>{s(r.difference)}</td>
              <td className={cn(td, "whitespace-nowrap")}>
                {s(r.anchor) && (
                  <a href={`#${s(r.anchor)}`} className="font-semibold text-accent hover:underline">
                    Read<span className="sr-only"> about {s(r.name)}</span>
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductCard({ a, id, number }: { a: BlockAttrs; id?: string; number?: number }) {
  const points = rows(a.points).filter((p) => s(p.text).trim());
  const image = s(a.image);
  const size = image ? imageSize(image) : null;
  const priceSource = s(a.priceSource);
  const ctaHref = s(a.ctaHref);
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="mb-10 scroll-mt-20 rounded-2xl border border-line bg-raised p-6 md:p-7"
    >
      {(s(a.badge) || a.ours === true) && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold tracking-[0.06em] uppercase">
          {s(a.badge) && <span className="rounded-full bg-(--accent-soft) px-2.5 py-1 text-(--accent-on-soft)">{s(a.badge)}</span>}
          {a.ours === true && <span className="rounded-full bg-surface px-2.5 py-1 text-text-2">Our product</span>}
        </p>
      )}
      <h2 id={id ? `${id}-title` : undefined} className="mb-3 text-h2">
        {number ? `${number}. ` : ""}
        {s(a.title)}
      </h2>
      {paragraphs(s(a.description)).map((p, i) => (
        <p key={i} className="mb-4">
          {p}
        </p>
      ))}
      {points.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5">
              {p.kind === "caveat" ? (
                <Minus className="mt-1.5 size-4 shrink-0 [stroke-width:2.5] text-text-2" aria-hidden />
              ) : (
                <Check className="mt-1.5 size-4 shrink-0 [stroke-width:2.5] text-(--mint)" aria-hidden />
              )}
              <span>
                <span className="sr-only">{p.kind === "caveat" ? "Caveat: " : "Good: "}</span>
                {s(p.text)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {image && (
        <figure className="mb-5 flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- guide media; same rule as images in the text */}
          <img
            src={image}
            alt={s(a.imageAlt)}
            width={size?.width}
            height={size?.height}
            loading="lazy"
            className="h-auto w-full rounded-[12px] border border-line"
          />
          {s(a.caption) && <figcaption className="text-small">{s(a.caption)}</figcaption>}
        </figure>
      )}
      {s(a.price) && (
        <p className="mb-4">
          <strong className="font-semibold">Price:</strong> {s(a.price)}
          {priceSource && (
            <>
              {" "}
              <a href={priceSource} target="_blank" rel={OUTSIDE_REL} className="text-small text-accent underline underline-offset-2">
                (source)<span className="sr-only"> opens in a new tab</span>
              </a>
            </>
          )}
        </p>
      )}
      {s(a.ctaLabel) && ctaHref && (
        <Link href={ctaHref} className={cn(button, "mb-4 bg-accent text-on-accent hover:bg-(--accent-hover) focus-visible:outline-accent")}>
          {s(a.ctaLabel)}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
      {s(a.chooseIf) && (
        <p className="rounded-xl bg-surface px-4 py-3">
          <strong className="font-semibold">Choose this if</strong> {s(a.chooseIf).replace(/^choose this if\s*/i, "")}
        </p>
      )}
    </section>
  );
}

function AbTable({ a }: { a: BlockAttrs }) {
  const list = rows(a.rows);
  const b = s(a.bLabel) || "B";
  return (
    <>
      <div className={tableWrap} role="region" aria-label={`${s(a.aLabel) || "A"} vs ${b}`} tabIndex={0}>
        <table className={table}>
          <thead>
            <tr>
              <th scope="col" className={th}><span className="sr-only">Compared on</span></th>
              <th scope="col" className={th}>{s(a.aLabel) || "A"}</th>
              <th scope="col" className={th}>{b}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={i}>
                <th scope="row" className={cn(td, "font-semibold")}>{s(r.label)}</th>
                <td className={td}>{s(r.a)}</td>
                <td className={td}>{s(r.b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s(a.bBetter).trim() && (
        <p className="mb-6">
          <strong className="font-semibold">When {b} is better:</strong> {s(a.bBetter)}
        </p>
      )}
    </>
  );
}

function ProsCons({ a }: { a: BlockAttrs }) {
  const good = lines(a.good);
  const watch = lines(a.watch);
  if (!good.length && !watch.length) return null;
  const column = (title: string, items: string[], bad: boolean) => (
    <div className="rounded-2xl border border-line p-5">
      <h3 className="mb-3 text-[17px] font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2 text-[16px]">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {bad ? (
              <Minus className="mt-1 size-4 shrink-0 [stroke-width:2.5] text-text-2" aria-hidden />
            ) : (
              <Check className="mt-1 size-4 shrink-0 [stroke-width:2.5] text-(--mint)" aria-hidden />
            )}
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2">
      {column("Good", good, false)}
      {column("Watch out", watch, true)}
    </div>
  );
}

function Faq({ a }: { a: BlockAttrs }) {
  const items = rows(a.items).filter((i) => s(i.q).trim());
  if (!items.length) return null;
  return (
    <div className="mb-8 border-t border-line">
      {items.map((i, n) => (
        <details key={n} className="group border-b border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
            {s(i.q)}
            <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-surface transition-transform duration-200 group-open:rotate-180">
              <span className="block size-[7px] -translate-y-0.5 rotate-45 border-r-2 border-b-2 border-text-2" />
            </span>
          </summary>
          <div className="pb-5 text-text-2">
            {paragraphs(s(i.a)).map((p, k) => (
              <p key={k} className="mb-3 last:mb-0">
                {p}
              </p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function CtaBox({ a }: { a: BlockAttrs }) {
  const primary = s(a.primaryHref);
  const secondary = s(a.secondaryHref);
  return (
    <aside className="mb-10 flex flex-col gap-4 rounded-[24px] bg-[#16171a] px-6 py-8 text-white md:px-9 site-dark:border site-dark:border-line site-dark:bg-raised">
      {s(a.heading) && <p className="text-[24px] leading-tight font-[650] tracking-[-0.02em]">{s(a.heading)}</p>}
      {lines(a.lines).map((l, i) => (
        <p key={i} className="text-[16.5px] text-white/75">
          {l}
        </p>
      ))}
      {(primary || secondary) && (
        <div className="mt-1 flex flex-wrap gap-3">
          {primary && s(a.primaryLabel) && (
            <Link href={primary} className={cn(button, "bg-white text-[#16171a] focus-visible:outline-white")}>
              {s(a.primaryLabel)}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
          {secondary && s(a.secondaryLabel) && (
            <Link href={secondary} className={cn(button, "border border-white/40 text-white hover:border-white focus-visible:outline-white")}>
              {s(a.secondaryLabel)}
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}

function DirectoryStats({ stats }: { stats: DirectoryStatsData | null }) {
  const cells: [string, number | null][] = [
    ["Agencies listed", stats?.agencies ?? null],
    ["Verified", stats?.verified ?? null],
    [stats?.serviceName ? `Offer ${stats.serviceName}` : "Offer this service", stats?.offering ?? null],
  ];
  return (
    <figure className="mb-8">
      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {cells.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-raised px-5 py-4">
            <dt className="text-small">{label}</dt>
            <dd className="text-[28px] font-[650] tracking-[-0.02em] tabular-nums">
              {value === null ? "–" : count.format(value)}
            </dd>
          </div>
        ))}
      </dl>
      <figcaption className="mt-2 text-small">Live counts from the directory.</figcaption>
    </figure>
  );
}

/** One guide block. `stats` is the live directory count (directory stats only). */
export function GuideBlockView({
  type,
  attrs,
  id,
  number,
  stats = null,
}: {
  type: BlockType;
  attrs: BlockAttrs;
  id?: string;
  number?: number;
  stats?: DirectoryStatsData | null;
}) {
  switch (type) {
    case "comparisonTable":
      return <ComparisonTable a={attrs} />;
    case "productCard":
      return <ProductCard a={attrs} id={id} number={number} />;
    case "abTable":
      return <AbTable a={attrs} />;
    case "prosCons":
      return <ProsCons a={attrs} />;
    case "faq":
      return <Faq a={attrs} />;
    case "ctaBox":
      return <CtaBox a={attrs} />;
    case "directoryStats":
      return <DirectoryStats stats={stats} />;
  }
}
