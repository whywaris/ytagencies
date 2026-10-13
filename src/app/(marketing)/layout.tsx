import { Analytics } from "@/components/analytics";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { gaId } from "@/lib/analytics";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  // GA4 on public pages in production only (lib/analytics.ts); read at build time, no cookies.
  const ga = gaId();
  return (
    <>
      {ga && <Analytics id={ga} />}
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
