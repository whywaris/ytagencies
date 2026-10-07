import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { imageSize, parseGuide } from "@/lib/markdown";
import { SITE_URL } from "@/lib/site";

// Renders sanitized guide Markdown (lib/markdown.ts) as React, never as an HTML string. Used by
// the public guide page (server) and the editor preview (browser). The live budget box is passed
// in, because it's a server component the browser preview can't run.

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/guides/`;
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

const components: Partial<Components> = {
  h1: (props) => <h2 className="mt-12 mb-4 text-h2" {...props} />, // one H1 per page: the title
  h2: (props) => <h2 className="mt-12 mb-4 text-h2" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-h3" {...props} />,
  h4: (props) => <h4 className="mt-6 mb-2 font-semibold" {...props} />,
  p: (props) => <p className="mb-5" {...props} />,
  ul: (props) => <ul className="mb-5 list-disc space-y-2 pl-6" {...props} />,
  ol: (props) => <ol className="mb-5 list-decimal space-y-2 pl-6" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  blockquote: (props) => (
    <blockquote className="mb-5 border-l-2 border-line pl-4 text-text-2" {...props} />
  ),
  code: (props) => <code className="rounded bg-surface px-1 py-0.5 text-[0.9em]" {...props} />,
  pre: (props) => (
    <pre className="mb-5 overflow-x-auto rounded-lg bg-surface p-4 text-[15px]" {...props} />
  ),
  hr: () => <hr className="my-10 border-line" />,
  table: (props) => (
    <div className="mb-5 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[15px]" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b border-line px-3 py-2 font-medium" {...props} />,
  td: (props) => <td className="border-b border-line px-3 py-2 align-top" {...props} />,
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
  img: ({ src, alt }) => {
    // Only images uploaded through the editor (the site's CSP would block any other host).
    if (typeof src !== "string" || !src.startsWith(STORAGE_PREFIX)) return null;
    const size = imageSize(src);
    if (size) {
      return (
        <Image
          src={src}
          alt={alt ?? ""}
          width={size.width}
          height={size.height}
          sizes="(min-width: 720px) 680px, 100vw"
          className="my-6 h-auto w-full rounded-lg"
        />
      );
    }
    // eslint-disable-next-line @next/next/no-img-element -- size unknown, so next/image can't lay it out
    return <img src={src} alt={alt ?? ""} loading="lazy" className="my-6 w-full rounded-lg" />;
  },
};

export function GuideBody({
  md,
  budgetRange,
}: {
  md: string;
  budgetRange: (service: string) => React.ReactNode;
}) {
  return (
    <>
      {parseGuide(md).map((block, i) =>
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
