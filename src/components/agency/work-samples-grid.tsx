"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { embedUrl, thumbnailUrl } from "@/lib/work-samples";
import { cn } from "@/lib/utils";

export type ProfileSample = {
  id: string;
  videoId: string;
  title: string;
  format: "long" | "short";
  note: string | null;
  service: { slug: string; name: string };
};

const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-9 items-center rounded-full border px-3.5 text-[14px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    on ? "border-text bg-text text-bg" : "border-line text-text-2 hover:border-text-2 hover:text-text",
  );

/**
 * The profile's work samples: thumbnails (Shorts as 9:16 tiles), with service chips when they span
 * 2+ services. Click-to-play: the youtube-nocookie.com player loads only after a click, so there's
 * no iframe or YouTube request on page load (LCP, cookies).
 */
export function WorkSamplesGrid({
  samples,
  reportHref,
}: {
  samples: ProfileSample[];
  /** "/contact?topic=report&agency=<slug>": each sample adds its video id. */
  reportHref: string;
}) {
  const services = [...new Map(samples.map((s) => [s.service.slug, s.service])).values()];
  const [filter, setFilter] = useState<string | null>(null);
  const shown = filter ? samples.filter((s) => s.service.slug === filter) : samples;

  return (
    <div className="flex flex-col gap-4">
      {services.length >= 2 && (
        <div role="group" aria-label="Filter by service" className="flex flex-wrap gap-2">
          <button type="button" className={chip(filter === null)} aria-pressed={filter === null} onClick={() => setFilter(null)}>
            All
          </button>
          {services.map((s) => (
            <button
              key={s.slug}
              type="button"
              className={chip(filter === s.slug)}
              aria-pressed={filter === s.slug}
              onClick={() => setFilter(s.slug)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {shown.map((s) => (
          <li
            key={s.id}
            id={`sample-${s.videoId}`}
            className={cn("flex min-w-0 flex-col gap-2", s.format === "long" && "col-span-2 sm:col-span-1")}
          >
            <Facade sample={s} />
            <p className="line-clamp-2 text-[14.5px] font-semibold">{s.title}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-2">
              <span className="rounded-full bg-surface px-2 py-0.5">{s.service.name}</span>
              <a
                href={`${reportHref}&sample=${s.videoId}`}
                rel="nofollow"
                className="rounded hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Report<span className="sr-only"> “{s.title}”</span>
              </a>
            </p>
            {s.note && <p className="text-[13.5px] text-text-2">{s.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Facade({ sample: s }: { sample: ProfileSample }) {
  const [playing, setPlaying] = useState(false);
  const box = cn(
    "relative w-full overflow-hidden rounded-[14px] bg-surface",
    s.format === "short" ? "aspect-[9/16]" : "aspect-video",
  );
  if (playing)
    return (
      <div className={box}>
        <iframe
          src={embedUrl(s.videoId)}
          title={s.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className={cn(box, "group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent")}
    >
      <Image
        src={thumbnailUrl(s.videoId)}
        alt=""
        fill
        sizes="(min-width: 640px) 240px, 50vw"
        className="object-cover"
      />
      <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors duration-150 group-hover:bg-black/25">
        <span className="grid size-12 place-items-center rounded-full bg-black/70 text-white">
          <Play className="ml-0.5 size-5 fill-current" aria-hidden />
        </span>
      </span>
      <span className="sr-only">Play “{s.title}”</span>
    </button>
  );
}
