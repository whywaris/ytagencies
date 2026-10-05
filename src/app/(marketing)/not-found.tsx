import type { Metadata } from "next";

import { NotFoundContent } from "@/components/not-found-content";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = { title: { absolute: `Page not found | ${BRAND_NAME}` } };

/**
 * notFound() inside public routes (unknown service, agency or guide). The (marketing) layout already
 * renders the nav and footer, so the root not-found (which brings its own) would show them twice.
 */
export default function MarketingNotFound() {
  return <NotFoundContent />;
}
