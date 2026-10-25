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
const th = "border-b border-muted-foreground/40 px-3 py-2.5 font-semibold first:pl-0";
const td = "border-b border-border px-3 py-2.5 align-top first:pl-0";
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
            <tr key={i} className={cn(i === 0 && a.highlightFirst === true && "bg-primary/10 text-foreground")}>
              <th scope="row" className={cn(td, "font-semibold", i === 0 && a.highlightFirst === true && "pl-3 first:pl-3")}>
                {s(r.name)}
              </th>
              <td className={td}>{s(r.bestFor)}</td>
              <td className={cn(td, "tabular-nums")}>{s(r.price)}</td>
              <td className={td}>{s(r.difference)}</td>
              <td className={cn(td, "whitespace-nowrap")}>
                {s(r.anchor) && (
                  <a href={`#${s(r.anchor)}`} className="font-semibold text-foreground underline underline-offset-2">
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
      className="mb-10 scroll-mt-20 rounded-2xl border border-border bg-card p-6 md:p-7"
    >
      {(s(a.badge) || a.ours === true) && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold tracking-[0.06em] uppercase">
          {s(a.badge) && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-foreground">{s(a.badge)}</span>}
          {a.ours === true && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Our product</span>}
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
                <Minus className="mt-1.5 size-4 shrink-0 [stroke-width:2.5] text-muted-foreground" aria-hidden />
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
            className="h-auto w-full rounded-[12px] border border-border"
          />
          {s(a.caption) && <figcaption className="text-[14px] text-muted-foreground">{s(a.caption)}</figcaption>}
        </figure>
      )}
      {s(a.price) && (
        <p className="mb-4">
          <strong className="font-semibold">Price:</strong> {s(a.price)}
          {priceSource && (
            <>
              {" "}
              <a href={priceSource} target="_blank" rel={OUTSIDE_REL} className="text-[14px] text-primary underline underline-offset-2">
                (source)<span className="sr-only"> opens in a new tab</span>
              </a>
            </>
          )}
        </p>
      )}
      {s(a.ctaLabel) && ctaHref && (
        <Link href={ctaHref} className={cn(button, "mb-4 bg-primary text-primary-foreground hover:bg-(--accent-hover) focus-visible:outline-primary")}>
          {s(a.ctaLabel)}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
      {s(a.chooseIf) && (
        <p className="rounded-xl bg-muted px-4 py-3">
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
    <div className="rounded-2xl border border-border p-5">
      <h3 className="mb-3 text-[17px] font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2 text-[16px]">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {bad ? (
              <Minus className="mt-1 size-4 shrink-0 [stroke-width:2.5] text-muted-foreground" aria-hidden />
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
    <div className="mb-8 border-t border-border">
      {items.map((i, n) => (
        <details key={n} className="group border-b border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            {s(i.q)}
            <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-muted transition-transform duration-200 group-open:rotate-180">
              <span className="block size-[7px] -translate-y-0.5 rotate-45 border-r-2 border-b-2 border-text-2" />
            </span>
          </summary>
          <div className="pb-5 text-muted-foreground">
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
  // "banner": the hero's navy; "box": near-black.
  const banner = a.variant === "banner";
  const ink = banner ? "text-navy" : "text-[#16171a]";
  return (
    <aside
      className={cn(
        "mb-10 flex flex-col gap-4 rounded-[24px] px-6 py-8 text-white md:px-9",
        // Own colours in both themes (white text: 17:1 on the box, 10:1 on navy).
        banner ? "bg-navy" : "bg-[#16171a] site-dark:ring-1 site-dark:ring-white/15",
      )}
    >
      {s(a.heading) && <p className="text-[24px] leading-tight font-[650] tracking-[-0.02em]">{s(a.heading)}</p>}
      {lines(a.lines).map((l, i) => (
        <p key={i} className="text-[16.5px] text-white/75">
          {l}
        </p>
      ))}
      {(primary || secondary) && (
        <div className="mt-1 flex flex-wrap gap-3">
          {primary && s(a.primaryLabel) && (
            <Link href={primary} className={cn(button, "bg-white focus-visible:outline-white", ink)}>
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

/** Zero counts are hidden on the site (all zero: no block); the editor shows them with a note. */
function DirectoryStats({ stats, editing }: { stats: DirectoryStatsData | null; editing: boolean }) {
  const cells: [string, number | null][] = [
    ["Agencies listed", stats?.agencies ?? null],
    ["Verified", stats?.verified ?? null],
    [stats?.serviceName ? `Offer ${stats.serviceName}` : "Offer this service", stats?.offering ?? null],
  ];
  const shown = editing ? cells : cells.filter(([, v]) => v !== null && v > 0);
  if (!shown.length) return null;
  const cols = ["", "", "sm:grid-cols-2", "sm:grid-cols-3"][shown.length];
  return (
    <figure className="mb-8">
      <dl className={cn("grid gap-px overflow-hidden rounded-2xl border border-border bg-border", cols)}>
        {shown.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-card px-5 py-4">
            <dt className="text-[14px] text-muted-foreground">{label}</dt>
            <dd className="text-[28px] font-[650] tracking-[-0.02em] text-foreground tabular-nums">
              {value === null ? "–" : count.format(value)}
            </dd>
            {editing && value === 0 && (
              <dd className="text-[13px] text-muted-foreground">Hidden on the site while 0</dd>
            )}
          </div>
        ))}
      </dl>
      <figcaption className="mt-2 text-[14px] text-muted-foreground">Live counts from the directory.</figcaption>
    </figure>
  );
}

function StatRow({ a }: { a: BlockAttrs }) {
  const items = rows(a.items).filter((i) => s(i.value).trim());
  if (!items.length) return null;
  const cols = ["", "", "sm:grid-cols-2", "sm:grid-cols-3"][items.length];
  return (
    <dl className={cn("mb-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border", cols)}>
      {items.map((i, n) => (
        <div key={n} className="flex flex-col-reverse justify-end gap-1 bg-card px-5 py-4">
          <dt className="text-[15px] text-muted-foreground">
            {s(i.label)}
            {s(i.source) && (
              <>
                {" "}
                <a href={s(i.source)} target="_blank" rel={OUTSIDE_REL} className="text-[14px] text-primary underline underline-offset-2">
                  (source)<span className="sr-only"> opens in a new tab</span>
                </a>
              </>
            )}
          </dt>
          <dd className="text-[30px] leading-tight font-[650] tracking-[-0.02em] text-foreground tabular-nums">{s(i.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function GuideButton({ a }: { a: BlockAttrs }) {
  const href = s(a.href);
  if (!href || !s(a.label)) return null;
  return (
    <p className="mb-6">
      <Link href={href} className={cn(button, "bg-primary text-primary-foreground hover:bg-(--accent-hover) focus-visible:outline-primary")}>
        {s(a.label)}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </p>
  );
}

/** Sits right above a list; the list keeps its own spacing. */
function ListLabel({ a }: { a: BlockAttrs }) {
  if (!s(a.text).trim()) return null;
  return <p className="mb-2 text-[15px] font-semibold tracking-[0.02em] text-primary">{s(a.text)}</p>;
}

/** A named quote. No name, no quote: the page never shows an anonymous testimonial. */
function GuideQuote({ a }: { a: BlockAttrs }) {
  const name = s(a.name).trim();
  if (!name || !s(a.text).trim()) return null;
  const cite = s(a.cite);
  return (
    <figure className="mb-8 border-l-2 border-primary pl-5">
      <blockquote cite={cite || undefined} className="text-[20px] leading-normal text-foreground">
        {paragraphs(s(a.text)).map((p, i) => (
          <p key={i} className="mb-3 last:mb-0">
            {p}
          </p>
        ))}
      </blockquote>
      <figcaption className="mt-3 text-[15px] text-muted-foreground">
        <span aria-hidden>— </span>
        <span className="font-semibold text-foreground">{name}</span>
        {s(a.role) && <>, {s(a.role)}</>}
        {cite && (
          <>
            {" "}
            <a href={cite} target="_blank" rel={OUTSIDE_REL} className="text-[14px] text-primary underline underline-offset-2">
              (source)<span className="sr-only"> opens in a new tab</span>
            </a>
          </>
        )}
      </figcaption>
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
  editing = false,
}: {
  type: BlockType;
  attrs: BlockAttrs;
  id?: string;
  number?: number;
  stats?: DirectoryStatsData | null;
  /** In the editor: show what the site hides (zero counts). */
  editing?: boolean;
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
      return <DirectoryStats stats={stats} editing={editing} />;
    case "statRow":
      return <StatRow a={attrs} />;
    case "button":
      return <GuideButton a={attrs} />;
    case "listLabel":
      return <ListLabel a={attrs} />;
    case "quote":
      return <GuideQuote a={attrs} />;
  }
}
