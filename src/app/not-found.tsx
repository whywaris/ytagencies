import type { Metadata } from "next";

import { Analytics } from "@/components/analytics";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { NotFoundContent } from "@/components/not-found-content";
import { gaId } from "@/lib/analytics";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `Page not found · ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

/** URLs that match no route. Outside the (marketing) layout, so it brings its own nav and footer. */
export default function NotFound() {
  // Outside the (marketing) layout, so GA (with its consent rules) is mounted here too.
  const ga = gaId();
  return (
    <>
      {ga && <Analytics id={ga} />}
      <Nav />
      <main id="main">
        <NotFoundContent />
      </main>
      <Footer />
    </>
  );
}
