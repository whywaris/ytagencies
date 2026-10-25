import { CopyLinkButton } from "@/components/guides/copy-link";
import { cn } from "@/lib/utils";

// Share links built on the server: plain links to each network's share page, no third-party
// scripts and no share counts. Brand marks are simple monochrome glyphs (lucide has none).

const glyphs = {
  X: (
    <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.4Z" />
  ),
  LinkedIn: (
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  ),
  Facebook: (
    <path d="M24 12.04C24 5.4 18.63.04 12 .04S0 5.4 0 12.04c0 5.63 3.87 10.35 9.1 11.65v-7.98H6.63v-3.67H9.1v-1.58c0-4.09 1.85-5.98 5.86-5.98.76 0 2.07.15 2.61.3v3.32c-.28-.03-.78-.04-1.39-.04-1.97 0-2.73.74-2.73 2.68v1.3h3.92l-.67 3.67h-3.25v8.25C19.4 23.24 24 18.18 24 12.04Z" />
  ),
  Reddit: (
    <>
      <path
        fillRule="evenodd"
        d="M12 8.5c4.42 0 8 2.57 8 5.75S16.42 20 12 20s-8-2.57-8-5.75S7.58 8.5 12 8.5Zm-3 4.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm6 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm-5.2 4.04a.6.6 0 0 0-.6 1.04c.86.5 1.83.75 2.8.75s1.94-.25 2.8-.75a.6.6 0 1 0-.6-1.04c-.68.4-1.43.59-2.2.59-.77 0-1.52-.2-2.2-.59Z"
      />
      <circle cx="4.6" cy="11.2" r="1.9" />
      <circle cx="19.4" cy="11.2" r="1.9" />
      <circle cx="17.3" cy="4.4" r="1.6" />
      <path
        d="M12 8.6 13.2 3.5l4 .9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

type Network = keyof typeof glyphs;

function shareLinks(url: string, title: string): { network: Network; href: string }[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { network: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { network: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { network: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { network: "Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
  ];
}

const circle =
  "flex size-10 items-center justify-center rounded-full border border-line text-text-2 transition-colors duration-150 hover:border-text-2 hover:text-text";

/**
 * "rail": vertical icon column (sticky beside the article on wide screens).
 * "row": icons with a heading, under the article on smaller screens.
 */
export function ShareBar({
  url,
  title,
  variant,
  className,
}: {
  url: string;
  title: string;
  variant: "rail" | "row";
  className?: string;
}) {
  const rail = variant === "rail";
  return (
    // A labelled aside, not a heading: the rail and the row never show at once (display: none
    // takes the hidden one out of the accessibility tree too).
    <aside aria-labelledby={`share-${variant}`} className={cn("flex flex-col gap-3", className)}>
      <p id={`share-${variant}`} className={rail ? "sr-only" : "text-[15px] font-semibold"}>
        Share this guide
      </p>
      <ul className={cn("flex gap-2", rail ? "flex-col" : "flex-wrap")}>
        {shareLinks(url, title).map((s) => (
          <li key={s.network}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${s.network} (opens in a new tab)`}
              title={`Share on ${s.network}`}
              className={circle}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                {glyphs[s.network]}
              </svg>
            </a>
          </li>
        ))}
        <li>
          <CopyLinkButton
            label="Copy link to this guide"
            tipSide={rail ? "left" : "right"}
            className={circle}
          />
        </li>
      </ul>
    </aside>
  );
}
