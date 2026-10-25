import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import Link from "next/link";
import { Children, Fragment, isValidElement } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import type { Element, Root } from "hast";

import { GuideBlockView, OUTSIDE_REL, type DirectoryStatsData } from "@/components/guide-blocks";
import { CopyLinkButton } from "@/components/guides/copy-link";
import { ZoomableImage } from "@/components/guides/zoom-image";
import { guideBlocks, imageSize, type Doc } from "@/lib/guide-content";
import { guideImageAllowed } from "@/lib/guide-media";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

// Renders a guide document (Tiptap JSON, through the allowlist in lib/guide-content.ts) as React,
// never as an HTML string. Server-rendered on the public page and the admin preview: no editor
// code. Typography comes from the shared .guide-content stylesheet (app/globals.css), the same one
// the editor canvas uses; guide blocks use the same components as the editor. The live budget box
// and the live directory counts are passed in (server components).

const SITE_HOST = new URL(SITE_URL).host;

/** Internal: /path or an absolute link to this site. */
function internalPath(href: string) {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.host === SITE_HOST ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}

const link = "text-accent underline underline-offset-2";

/** Heading with a stable id (lib/guide-content.ts) and a copy-link button that shows on hover/focus. */
function heading(Tag: "h2" | "h3", className: string) {
  function Heading({ id, children }: { id?: string; children?: React.ReactNode }) {
    return (
      <Tag id={id} className={cn("group scroll-mt-20", className)}>
        {children}
        {id && (
          <CopyLinkButton
            hash={id}
            label="Copy link to this section"
            className="ml-2 inline-flex size-8 translate-y-[-0.1em] items-center justify-center rounded-full align-middle text-text-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-text focus-visible:opacity-100"
          />
        )}
      </Tag>
    );
  }
  return Heading;
}

/** An uploaded guide image: rounded, hairline border, caption from its title (else alt), zoomable. */
function Figure({ src, alt, title }: { src?: unknown; alt?: string; title?: string }) {
  // Only images uploaded through the editor (the site's CSP would block any other host).
  if (typeof src !== "string" || !guideImageAllowed(src)) return null;
  const size = imageSize(src);
  const caption = title || alt;
  return (
    <figure className="guide-figure">
      {size ? (
        <ZoomableImage src={src} alt={alt ?? ""} width={size.width} height={size.height} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- size unknown, so next/image can't lay it out
        <img src={src} alt={alt ?? ""} loading="lazy" />
      )}
      {caption && (
        // Same text as the alt: screen readers already heard it.
        <figcaption aria-hidden={caption === alt || undefined} className="text-small">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

const Img = ({ src, alt, title }: { src?: unknown; alt?: string; title?: string }) => (
  <Figure src={src} alt={alt} title={title} />
);

/** A paragraph whose only content is an image. */
const isImageOnly = (children: React.ReactNode) => {
  const parts = Children.toArray(children).filter((c) => !(typeof c === "string" && !c.trim()));
  return parts.length === 1 && isValidElement(parts[0]) && parts[0].type === Img;
};

// Element styles live in .guide-content (app/globals.css); these only add behaviour: heading ids
// with a copy-link button, figures, the table's scroll wrapper and link handling.
const baseComponents: Partial<Components> = {
  h1: heading("h2", "guide-h2"), // one H1 per page: the title
  h2: heading("h2", "guide-h2"),
  h3: heading("h3", ""),
  // A paragraph holding only an image becomes the figure itself (a <figure> can't sit in a <p>).
  p: (props) => (isImageOnly(props.children) ? <>{props.children}</> : <p {...props} />),
  table: (props) => (
    <div className="guide-table">
      <table {...props} />
    </div>
  ),
  img: Img,
};

/** Links: ours stay in the app, anchors in the page, everything else opens in a new tab. */
const linkFor = (outsideRel: string): Components["a"] =>
  function GuideLink({ href = "", children }) {
    const path = internalPath(href);
    if (path) {
      return (
        <Link href={path} className={link}>
          {children}
        </Link>
      );
    }
    if (href.startsWith("#")) {
      return (
        <a href={href} className={link}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel={outsideRel} className={link}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  };

const DEFAULT_COMPONENTS = { ...baseComponents, a: linkFor("noopener noreferrer") };
const NOFOLLOW_COMPONENTS = { ...baseComponents, a: linkFor(OUTSIDE_REL) };

export function GuideBody({
  doc,
  budgetRange,
  directoryStats = () => null,
  nofollowOutside = false,
  afterLead,
}: {
  doc: Doc;
  budgetRange: (service: string) => React.ReactNode;
  /** Live directory counts for a directory stats block (a server component). */
  directoryStats?: (service: string) => React.ReactNode;
  /** Links to other sites get rel="nofollow" too (the Alternatives template). */
  nofollowOutside?: boolean;
  /** Shown right after the lead (the first paragraph), or first when the guide opens otherwise. */
  afterLead?: React.ReactNode;
}) {
  const { blocks } = guideBlocks(doc, guideImageAllowed);
  const components = nofollowOutside ? NOFOLLOW_COMPONENTS : DEFAULT_COMPONENTS;
  const render = (tree: Root) => toJsxRuntime(tree, { Fragment, jsx, jsxs, components });

  // Split the first chunk after its opening paragraph, so afterLead lands between the two.
  const first = blocks[0]?.kind === "html" ? blocks[0].tree : null;
  const leadEnd = first ? first.children.findIndex((c) => c.type === "element") + 1 : 0;
  const hasLead = !!first && leadEnd > 0 && (first.children[leadEnd - 1] as Element).tagName === "p";

  return (
    <div className="guide-content">
      {afterLead && !hasLead && afterLead}
      {blocks.map((block, i) =>
        i === 0 && hasLead && first ? (
          <Fragment key={i}>
            {render({ type: "root", children: first.children.slice(0, leadEnd) })}
            {afterLead}
            {render({ type: "root", children: first.children.slice(leadEnd) })}
          </Fragment>
        ) :
        block.kind === "budget-range" ? (
          <Fragment key={i}>{budgetRange(block.service)}</Fragment>
        ) : block.kind === "block" ? (
          <div key={i} className="guide-block" data-guide-block={block.type}>
            {block.type === "directoryStats" ? (
              directoryStats(String(block.attrs.service ?? ""))
            ) : (
              <GuideBlockView type={block.type} attrs={block.attrs} id={block.id} number={block.number} />
            )}
          </div>
        ) : (
          <Fragment key={i}>{render(block.tree)}</Fragment>
        ),
      )}
    </div>
  );
}

export type { DirectoryStatsData };
