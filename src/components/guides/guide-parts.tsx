import Image, { getImageProps } from "next/image";
import Link from "next/link";

import { mediaUrl, type Author, type GuideSummary } from "@/lib/data/guides";
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
}: {
  slug: string;
  coverPath: string | null;
  /** Set to draw the no-cover fallback in HTML (admin preview of drafts) instead of the image. */
  title?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
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
          alt=""
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
 * The generated typographic cover, light or dark to match the page (a <picture> source the
 * browser picks with prefers-color-scheme; getImageProps keeps next/image's optimization).
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
  const common = { alt: "", width: COVER_SIZE.width, height: COVER_SIZE.height, sizes };
  const dark = getImageProps({ ...common, src: `/og/guide/${slug}/cover/dark` }).props;
  const light = getImageProps({
    ...common,
    src: `/og/guide/${slug}/cover`,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : undefined,
  }).props;
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={dark.srcSet} sizes={sizes} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- getImageProps output (alt is in it) */}
      <img {...light} className="absolute inset-0 size-full object-cover" />
    </picture>
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

/** End-of-article author box. */
export function AuthorBox({ author }: { author: Author }) {
  return (
    <section
      aria-labelledby="about-author"
      className="flex flex-col gap-4 rounded-2xl border border-line p-6 sm:flex-row sm:gap-5"
    >
      <AuthorAvatar author={author} size={64} />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="about-author" className="text-[19px] font-semibold">
          <Link href={`/authors/${author.slug}`} className="hover:underline">
            {author.name}
          </Link>
        </h2>
        {author.role && <p className="text-small">{author.role}</p>}
        {author.bio && <p className="mt-2 text-[16px] leading-relaxed">{author.bio}</p>}
        <AuthorLinks author={author} />
      </div>
    </section>
  );
}

/** Author name and read time under a card title. */
export function GuideMeta({
  guide,
  showAuthor = true,
}: {
  guide: GuideSummary;
  showAuthor?: boolean;
}) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-small">
      {showAuthor && guide.author && <span>{guide.author.name}</span>}
      <span>{guide.readMinutes} min read</span>
    </p>
  );
}

/** A guide in a grid: cover, title, optional excerpt, meta. The whole card is one link. */
export function GuideCard({
  guide,
  excerpt = false,
  showAuthor = true,
  as: Heading = "h3",
}: {
  guide: GuideSummary;
  excerpt?: boolean;
  showAuthor?: boolean;
  as?: "h2" | "h3";
}) {
  return (
    <article className="group relative flex flex-col gap-3">
      <GuideCover
        slug={guide.slug}
        coverPath={guide.coverPath}
        sizes="(min-width: 1100px) 340px, (min-width: 640px) 50vw, 100vw"
      />
      <Heading className="text-[19px] leading-snug font-semibold">
        <Link
          href={`/guides/${guide.slug}`}
          className="group-hover:underline after:absolute after:inset-0 after:rounded-2xl"
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
