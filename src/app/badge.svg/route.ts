import { badgeResponse } from "@/lib/badge-svg";

// "Listed on YT Agencies" (lib/badge-svg.ts). Static.
export const dynamic = "force-static";

export const GET = () => badgeResponse("listed");
