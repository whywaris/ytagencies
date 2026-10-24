import { Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** The gold Pro badge: an active Pro plan. Paid, so never called "verified" (that's earned). */
export function ProBadge() {
  return (
    <Badge variant="pro" title="Pro member: paid plan">
      <Crown aria-hidden />
      Pro
      <span className="sr-only"> member: paid plan</span>
    </Badge>
  );
}
