import { buildLlmsTxt } from "@/lib/sitemap";

// /llms.txt (llmstxt.org): what the site is and its main indexable pages, for AI tools. Served in
// every environment but linked from nowhere; robots.txt still controls crawling. ISR hourly.
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
