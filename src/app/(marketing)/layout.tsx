import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
