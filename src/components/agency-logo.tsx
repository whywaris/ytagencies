import Image from "next/image";

import { cn } from "@/lib/utils";

// Public bucket for agency logos; owners upload to agencies/<agency_id>/ (SECURITY.md).
const LOGO_BUCKET = "agency-media";

export function logoUrl(logoPath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${logoPath}`;
}

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
  if (logoPath) {
    return (
      <Image
        src={logoUrl(logoPath)}
        alt={`${name} logo`}
        width={px}
        height={px}
        className={cn("shrink-0 rounded-sm border border-line object-cover", className)}
      />
    );
  }
  // No logo yet: initials tile, decorative because the name sits right next to it.
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm bg-surface font-semibold text-text-2",
        className,
      )}
    >
      {initials}
    </span>
  );
}
