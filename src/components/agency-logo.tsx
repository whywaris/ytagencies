"use client";

import Image from "next/image";
import { useState } from "react";

import { initials, logoSrc } from "@/lib/logo";
import { cn } from "@/lib/utils";

// Agency logo: an R2 link (MEDIA_HOSTS, set in admin) or a dashboard upload in agency-media
// (lib/logo.ts). The initials tile shows when there's no logo or the image fails to load, so a
// broken link never leaves an empty box. Client component only for that fallback.

const SIZES = {
  xs: { px: 32, className: "size-8 text-[13px]" },
  sm: { px: 48, className: "size-12 text-[17px]" },
  lg: { px: 80, className: "size-20 text-h3" },
};

// DESIGN.md: 8px radius for logos; alt text "{Agency} logo".
export function AgencyLogo({
  name,
  logoPath,
  size = "sm",
}: {
  name: string;
  logoPath: string | null;
  size?: keyof typeof SIZES;
}) {
  const { px, className } = SIZES[size];
  const src = logoSrc(logoPath);
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <Image
        src={src}
        alt={`${name} logo`}
        width={px}
        height={px}
        onError={() => setFailed(src)}
        className={cn("shrink-0 rounded-sm border border-line object-cover", className)}
      />
    );
  }
  // No logo (or it didn't load): initials tile, decorative because the name sits right next to it.
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm bg-surface font-semibold text-text-2",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
