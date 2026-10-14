import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import Link from "next/link";
import { Children, Fragment, isValidElement } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { CopyLinkButton } from "@/components/guides/copy-link";
import { ZoomableImage } from "@/components/guides/zoom-image";
import { guideBlocks, imageSize, type Doc } from "@/lib/guide-content";
import { guideImageAllowed } from "@/lib/guide-media";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

// Renders a guide document (Tiptap JSON, through the allowlist in lib/guide-content.ts) as React,
// never as an HTML string. Server-rendered on the public page and the admin preview: no editor
// code. The live budget box is passed in (a server component).

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
    <figure className="my-8 flex flex-col gap-3">
      {size ? (
        <ZoomableImage src={src} alt={alt ?? ""} width={size.width} height={size.height} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- size unknown, so next/image can't lay it out
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          className="w-full rounded-[12px] border border-line"
        />
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

const components: Partial<Components> = {
  h1: heading("h2", "guide-h2 mt-16 mb-4 text-h2"), // one H1 per page: the title
  h2: heading("h2", "guide-h2 mt-16 mb-4 text-h2"),
  h3: heading("h3", "mt-10 mb-3 text-h3"),
  h4: (props) => <h4 className="mt-8 mb-2 scroll-mt-20 font-semibold" {...props} />,
  h5: (props) => <h5 className="mt-6 mb-2 font-semibold" {...props} />,
  h6: (props) => <h6 className="mt-6 mb-2 font-semibold text-text-2" {...props} />,
  // A paragraph holding only an image becomes the figure itself (a <figure> can't sit in a <p>).
  p: (props) =>
    isImageOnly(props.children) ? <>{props.children}</> : <p className="mb-6" {...props} />,
  ul: (props) => <ul className="mb-6 list-disc space-y-2 pl-6 marker:text-text-2" {...props} />,
  ol: (props) => <ol className="mb-6 list-decimal space-y-2 pl-6 marker:text-text-2" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  blockquote: (props) => (
    <blockquote className="mb-6 border-l-2 border-line pl-5 text-text-2" {...props} />
  ),
  code: (props) => <code className="rounded bg-surface px-1 py-0.5 text-[0.88em]" {...props} />,
  pre: (props) => (
    <pre className="mb-6 overflow-x-auto rounded-2xl bg-surface p-5 text-[15px]" {...props} />
  ),
  hr: () => <hr className="my-12 border-line" />,
  table: (props) => (
    <div className="mb-8 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-[16px]" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border-b border-text-2/40 px-3 py-2.5 font-semibold first:pl-0" {...props} />
  ),
  td: (props) => (
    <td className="border-b border-line px-3 py-2.5 align-top first:pl-0" {...props} />
  ),
  a: ({ href = "", children }) => {
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
      <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  },
  img: Img,
};

export function GuideBody({
  doc,
  budgetRange,
}: {
  doc: Doc;
  budgetRange: (service: string) => React.ReactNode;
}) {
  const { blocks } = guideBlocks(doc, guideImageAllowed);
  return (
    <>
      {blocks.map((block, i) =>
        block.kind === "budget-range" ? (
          <Fragment key={i}>{budgetRange(block.service)}</Fragment>
        ) : (
          <Fragment key={i}>
            {toJsxRuntime(block.tree, { Fragment, jsx, jsxs, components })}
          </Fragment>
        ),
      )}
    </>
  );
}
