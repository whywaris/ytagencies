import { FooterBottom } from "@/components/footer-bottom";
import { Nav } from "@/components/nav";

// Sign-in: the site nav, the page filling the viewport, and only the footer's bottom row (no
// disclaimer) instead of the full footer. The glow sits behind the content area only
// (.auth-page tokens in globals.css).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Nav />
      <main id="main" className="auth-page relative isolate flex flex-1 overflow-clip">
        <div
          aria-hidden
          className="home-hero-glow pointer-events-none absolute [inset:-10%_-10%_10%_-10%] -z-10 blur-[60px]"
        />
        {children}
      </main>
      <footer className="print:hidden">
        <div className="mx-auto max-w-content px-4 md:px-6">
          <FooterBottom disclaimer={false} cookieSettings={false} />
        </div>
      </footer>
    </div>
  );
}
