import Image from "next/image";
import Link from "next/link";

import { mediaUrl, type Author, type GuideSummary } from "@/lib/data/guides";
import { colorHex } from "@/lib/guide-categories";
import { COVER_SIZE } from "@/lib/seo/og";
import { cn } from "@/lib/utils";

// Building blocks shared by the guide page, the /guides index and author pages.

/**
 * A guide's 16:9 cover: the uploaded one, else the typographic cover generated for it. The box
 * reserves its space (no layout shift); the image fills it.
 */
export function GuideCover({
  slug,
  coverPath,
  title,
  sizes,
  priority = false,
  className,
  alt = "",
}: {
  slug: string;
  coverPath: string | null;
  /** Set to draw the no-cover fallback in HTML (admin preview of drafts) instead of the image. */
  title?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** The cover's alt text (set in the editor); empty when it only decorates. */
  alt?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-2xl border border-line bg-surface",
        className,
      )}
    >
      {!coverPath && title ? (
        <div aria-hidden className="flex h-full flex-col justify-end p-[7%]">
          <p className="text-[clamp(20px,4.5vw,40px)] leading-tight font-semibold tracking-[-0.02em]">
            {title}
          </p>
        </div>
      ) : coverPath ? (
        <Image
          src={mediaUrl(coverPath)}
          alt={alt}
          fill
          sizes={sizes}
          // Next 16: preload replaces the deprecated priority (LCP image).
          preload={priority}
          fetchPriority={priority ? "high" : undefined}
          className="object-cover"
        />
      ) : (
        <GeneratedCover slug={slug} sizes={sizes} priority={priority} />
      )}
    </div>
  );
}

/**
 * The generated typographic cover, light or dark to match the site theme (data-site-theme, set
 * client-side, so CSS picks the image; the hidden dark one is lazy, so light pages never load it).
 */
function GeneratedCover({
  slug,
  sizes,
  priority,
}: {
  slug: string;
  sizes: string;
  priority: boolean;
}) {
  const common = { width: COVER_SIZE.width, height: COVER_SIZE.height, sizes };
  const cover = "absolute inset-0 size-full object-cover";
  return (
    <>
      <Image
        alt=""
        {...common}
        src={`/og/guide/${slug}/cover`}
        preload={priority}
        className={cn(cover, "site-dark:hidden")}
      />
      <Image
        alt=""
        {...common}
        src={`/og/guide/${slug}/cover/dark`}
        loading="lazy"
        className={cn(cover, "hidden site-dark:block")}
      />
    </>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** Round author photo; initials on the surface colour when there's no photo. */
export function AuthorAvatar({ author, size }: { author: Author; size: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-medium text-text-2"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {author.avatarPath ? (
        <Image
          src={mediaUrl(author.avatarPath)}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span aria-hidden>{initials(author.name)}</span>
      )}
    </span>
  );
}

/** "LinkedIn", "X", "Website" as plain links (new tab). */
export function AuthorLinks({ author }: { author: Author }) {
  if (!author.links.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-5">
      {author.links.map((l) => (
        <li key={l.label}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer me"
            className="flex min-h-11 items-center text-accent hover:underline"
          >
            {l.label}
            <span className="sr-only"> of {author.name} (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** End-of-article author box. Not a heading: the article outline is only its own sections. */
export function AuthorBox({ author }: { author: Author }) {
  return (
    <aside
      aria-label="About the author"
      className="flex flex-col gap-4 rounded-2xl border border-line p-6 sm:flex-row sm:gap-5"
    >
      <AuthorAvatar author={author} size={64} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[19px] font-semibold">
          <Link href={`/authors/${author.slug}`} className="hover:underline">
            {author.name}
          </Link>
        </p>
        {author.role && <p className="text-small">{author.role}</p>}
        {author.bio && <p className="mt-2 text-[16px] leading-relaxed">{author.bio}</p>}
        <AuthorLinks author={author} />
      </div>
    </aside>
  );
}

/** "{n} min read · {author}" under a card title. */
export function GuideMeta({
  guide,
  showAuthor = true,
}: {
  guide: GuideSummary;
  showAuthor?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small">
      <span>{guide.readMinutes} min read</span>
      {/* Above the card's full-size link (GuideCard), so the author link stays clickable. Author
          pages exist for every author with a live guide. */}
      {showAuthor && guide.author && (
        <>
          <span aria-hidden>·</span>
          <Link
            href={`/authors/${guide.author.slug}`}
            className="relative z-10 rounded hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {guide.author.name}
          </Link>
        </>
      )}
    </p>
  );
}

export type CardCategory = { name: string; slug: string; color: string };

/**
 * The cover for a guide without an uploaded one: its category colour (AA with white text) with
 * the category name and the title. Decorative; the title is also the card's heading.
 */
export function CategoryCover({
  category,
  title,
  label,
  large = false,
  className,
}: {
  category: CardCategory;
  title: string;
  /** e.g. "Featured", shown before the category. */
  label?: string;
  large?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-video flex-col justify-between overflow-hidden rounded-2xl p-[6%] text-white",
        className,
      )}
      style={{ background: colorHex(category.color) }}
    >
      <p className="flex flex-wrap gap-2 text-[12.5px] font-semibold tracking-[0.06em] uppercase">
        {label && <span className="rounded-full bg-white/20 px-2.5 py-1">{label}</span>}
        <span className="rounded-full bg-white/20 px-2.5 py-1">{category.name}</span>
      </p>
      <p
        className={cn(
          "line-clamp-3 font-[650] leading-tight tracking-[-0.02em]",
          large ? "text-[clamp(24px,3vw,38px)]" : "text-[clamp(18px,2vw,22px)]",
        )}
      >
        {title}
      </p>
    </div>
  );
}

/** A guide in a grid: cover, title, optional excerpt, meta. The whole card is one link. */
export function GuideCard({
  guide,
  excerpt = false,
  showAuthor = true,
  as: Heading = "h3",
  category,
}: {
  guide: GuideSummary;
  excerpt?: boolean;
  showAuthor?: boolean;
  as?: "h2" | "h3";
  /** Without an uploaded cover, the card uses the category colour cover. */
  category?: CardCategory | null;
}) {
  return (
    <article className="group relative flex flex-col gap-3 transition-transform duration-200 ease-out motion-safe:hover:-translate-y-1">
      {!guide.coverPath && category ? (
        <CategoryCover category={category} title={guide.title} />
      ) : (
        <GuideCover
          slug={guide.slug}
          coverPath={guide.coverPath}
          sizes="(min-width: 1100px) 340px, (min-width: 640px) 50vw, 100vw"
        />
      )}
      <Heading className="text-[19px] leading-snug font-semibold">
        <Link
          href={`/guides/${guide.slug}`}
          className="transition-colors duration-150 group-hover:text-accent after:absolute after:inset-0 after:rounded-2xl"
        >
          {guide.title}
        </Link>
      </Heading>
      {excerpt && guide.excerpt && (
        <p className="line-clamp-3 text-[16px] text-text-2">{guide.excerpt}</p>
      )}
      <GuideMeta guide={guide} showAuthor={showAuthor} />
    </article>
  );
}
