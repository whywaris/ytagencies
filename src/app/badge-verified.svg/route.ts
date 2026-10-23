import { badgeResponse } from "@/lib/badge-svg";

// "Verified on YT Agencies" (lib/badge-svg.ts), offered only to verified agencies. Static.
export const dynamic = "force-static";

export const GET = () => badgeResponse("verified");
