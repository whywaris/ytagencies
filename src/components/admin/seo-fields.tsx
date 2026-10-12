"use client";

import { cn } from "@/lib/utils";

// SEO title + description with character counters and a search-result preview. Shared by the
// guide editor and the admin agency form.

const input = "h-9 w-full rounded-lg border border-line bg-bg px-3";

export function SeoFields({
  title,
  description,
  onTitle,
  onDescription,
  shownTitle,
  shownDescription,
  breadcrumb,
  titleHint,
  descriptionHint,
  titleError,
  descriptionError,
}: {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  /** What search engines will see (the fallback when the field is empty). */
  shownTitle: string;
  shownDescription: string;
  /** "ytagencies.com › agency › acme" */
  breadcrumb: string;
  titleHint: string;
  descriptionHint: string;
  titleError?: string;
  descriptionError?: string;
}) {
  return (
    <>
      <Counted
        label="SEO title"
        value={title}
        max={60}
        hard={70}
        hint={titleHint}
        error={titleError}
      >
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          maxLength={70}
          className={input}
        />
      </Counted>
      <Counted
        label="SEO description"
        value={description}
        max={160}
        hard={200}
        hint={descriptionHint}
        error={descriptionError}
      >
        <textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          maxLength={200}
          rows={3}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2"
        />
      </Counted>
      <div
        aria-label="Search result preview"
        className="flex flex-col gap-0.5 rounded-lg border border-line p-3"
      >
        <span className="text-admin-meta">{breadcrumb}</span>
        <span className="line-clamp-1 text-[16px] text-accent">{shownTitle}</span>
        <span className="line-clamp-2 text-admin-meta">
          {shownDescription || "Add a description so search results have a summary."}
        </span>
      </div>
    </>
  );
}

function Counted({
  label: name,
  value,
  max,
  hard,
  hint,
  error,
  children,
}: {
  label: string;
  value: string;
  max: number;
  hard?: number;
  hint: string;
  error?: string;
  children: React.ReactNode;
}) {
  const over = value.length > max;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{name}</span>
        <span className={cn("text-admin-meta num", over && "text-warning")}>
          {value.length} / {max}
        </span>
      </span>
      {children}
      <span className={cn("text-admin-meta", error && "text-destructive")}>
        {error ?? `${over && hard ? `Over ${max}, search engines may cut it short. ` : ""}${hint}`}
      </span>
    </label>
  );
}
