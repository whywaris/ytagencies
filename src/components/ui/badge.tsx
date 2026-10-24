import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// DESIGN.md: small text pills. Verified = green (earned). Pro = gold (paid plan). Sponsored = neutral
// outline, says it's paid placement. Verified and Pro are separate badges, never combined.
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 text-[14px] font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-surface text-text",
        verified: "border-verified text-verified",
        sponsored: "border-line text-text-2",
        pro: "border-(--amber)/50 bg-(--amber-soft) text-(--amber-on-soft)",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
