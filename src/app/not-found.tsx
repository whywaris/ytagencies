import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { NotFoundContent } from "@/components/not-found-content";
import { BRAND_NAME } from "@/lib/site";

// Next adds robots noindex to 404 responses itself.
export const metadata: Metadata = { title: { absolute: `Page not found | ${BRAND_NAME}` } };

/** URLs that match no route. Outside the (marketing) layout, so it brings its own nav and footer. */
export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main">
        <NotFoundContent />
      </main>
      <Footer />
    </>
  );
}
