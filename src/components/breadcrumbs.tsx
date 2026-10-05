import Link from "next/link";

export type Crumb = { name: string; path: string };

/** Visible breadcrumb; pair with breadcrumbJsonLd() using the same items. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-small">
        {items.map((c, i) => (
          <li key={c.path} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {i < items.length - 1 ? (
              <Link href={c.path} className="flex min-h-11 items-center hover:text-text">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page">{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
