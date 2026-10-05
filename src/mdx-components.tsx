import type { MDXComponents } from "mdx/types";
import Link from "next/link";

// Guide typography (DESIGN.md): reading width is set by the page; these map Markdown to the type scale.
const components: MDXComponents = {
  h2: (props) => <h2 className="mt-12 mb-4 text-h2" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-h3" {...props} />,
  p: (props) => <p className="mb-5" {...props} />,
  ul: (props) => <ul className="mb-5 list-disc space-y-2 pl-6" {...props} />,
  ol: (props) => <ol className="mb-5 list-decimal space-y-2 pl-6" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: ({ href = "", ...props }) =>
    href.startsWith("/") ? (
      <Link href={href} className="text-accent underline underline-offset-2" {...props} />
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="text-accent underline underline-offset-2"
        {...props}
      />
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
