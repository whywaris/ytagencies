import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";

import { BRAND_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Public font (DESIGN.md). Variable weight plus the width axis, for 90% headings. The admin sets
// Inter on its own root.
const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: BRAND_NAME, template: `%s | ${BRAND_NAME}` },
  applicationName: BRAND_NAME,
};

// DESIGN.md light --bg: light is the default whatever the OS says.
export const viewport: Viewport = { themeColor: "#fbfbfd" };

// Applies the visitor's saved theme before first paint (no flash). localStorage, not a cookie, so
// public pages stay static. The nav toggle writes the same key (components/theme-toggle.tsx).
const themeScript = `try{if(localStorage.getItem("yta-theme")==="dark")document.documentElement.dataset.siteTheme="dark"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={instrument.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
