import Link from "next/link";

import { Nav } from "@/components/nav";
import { copyrightName } from "@/lib/company";

// Sign-in: the site nav, the page filling the viewport, and a one-line footer instead of the full
// one. The glow sits behind the content area only (.auth-page tokens in globals.css).
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
      <footer className="border-t border-line print:hidden">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-[14px] text-text-2 md:px-6">
          <p>
            © {new Date().getFullYear()} {copyrightName()}
          </p>
          <nav aria-label="Legal" className="flex gap-5">
            {[
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/contact", label: "Contact" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex min-h-11 items-center transition-colors duration-150 hover:text-text"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
