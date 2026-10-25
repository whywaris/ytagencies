import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { GuideBlocksDemo } from "@/components/guide-blocks-demo";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Temporary review page. Delete before launch.
export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

const colors = ["bg", "surface", "text", "text-2", "line", "accent", "on-accent", "verified"];
const types = [
  ["text-display", "Display 64 / 40"],
  ["text-h1", "H1 48 / 32"],
  ["text-h2", "H2 32 / 24"],
  ["text-h3", "H3 21 / 19"],
  ["text-body", "Body 17"],
  ["text-small", "Small 14"],
] as const;
const spacing = [4, 8, 12, 16, 24, 32, 48, 80, 120];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

function Panel({ theme }: { theme: "light" | "dark" }) {
  const id = (name: string) => `${theme}-${name}`;
  return (
    <div data-theme={theme} className="min-w-0 flex-1 bg-bg text-text">
      <Nav />
      <div className="flex flex-col gap-12 px-4 py-12 md:px-6">
        <h1 className="text-h2 capitalize">{theme}</h1>

        <Section title="Colors">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {colors.map((c) => (
              <li key={c} className="flex flex-col gap-2">
                <span
                  className="h-12 rounded-md border border-line"
                  style={{ background: `var(--${c})` }}
                />
                <code className="text-small">--{c}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type scale">
          {types.map(([cls, label]) => (
            <div key={cls}>
              <p className="text-small">{label}</p>
              <p className={cls}>Find the right YouTube agency</p>
            </div>
          ))}
        </Section>

        <Section title="Spacing">
          <ul className="flex flex-col gap-2">
            {spacing.map((px) => (
              <li key={px} className="flex items-center gap-3">
                <code className="w-12 text-small">{px}</code>
                <span className="h-3 rounded-sm bg-accent" style={{ width: px }} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button>Find agencies</Button>
            <Button variant="link">Claim this listing</Button>
            <Button disabled>Send inquiry</Button>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="flex max-w-sm flex-col gap-2">
            <label htmlFor={id("email")} className="text-[14px] font-medium">
              Work email
            </label>
            <Input id={id("email")} type="email" placeholder="you@company.com" />
          </div>
          <div className="flex max-w-sm flex-col gap-2">
            <label htmlFor={id("budget")} className="text-[14px] font-medium">
              Monthly budget
            </label>
            <Select>
              <SelectTrigger id={id("budget")}>
                <SelectValue placeholder="Choose a range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1k">Under $1k</SelectItem>
                <SelectItem value="5k">$1k–$5k</SelectItem>
                <SelectItem value="10k">$5k–$10k</SelectItem>
                <SelectItem value="10k+">$10k+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title="Hero sentence (inline selects)">
          <p className="text-h1">
            I need a YouTube{" "}
            <Select defaultValue="ads">
              <SelectTrigger variant="inline" aria-label="Service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ads">Ads</SelectItem>
                <SelectItem value="seo">SEO</SelectItem>
                <SelectItem value="shorts">Shorts</SelectItem>
              </SelectContent>
            </Select>{" "}
            agency for{" "}
            <Select defaultValue="doctors">
              <SelectTrigger variant="inline" aria-label="Industry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doctors">Doctors</SelectItem>
                <SelectItem value="dentists">Dentists</SelectItem>
                <SelectItem value="saas">SaaS</SelectItem>
              </SelectContent>
            </Select>
          </p>
          <p className="text-small">
            Dropdown menus open in the site&apos;s current theme, not the panel&apos;s.
          </p>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-3">
            <Badge variant="verified">Verified</Badge>
            <Badge variant="sponsored">Sponsored</Badge>
            <Badge>Healthcare</Badge>
          </div>
        </Section>

        <Section title="Guide blocks">
          <div data-contrast={`site-${theme}`} className="max-w-reading">
            <GuideBlocksDemo />
          </div>
          <h3 className="text-[17px] font-semibold">In the editor canvas</h3>
          <div data-contrast={`editor-${theme}`} data-admin data-theme={theme} className="max-w-reading rounded-2xl bg-bg p-4 text-text">
            <GuideBlocksDemo editing />
          </div>
        </Section>
      </div>
      <Footer />
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <main className="flex flex-col lg:flex-row">
      <Panel theme="light" />
      <Panel theme="dark" />
    </main>
  );
}
