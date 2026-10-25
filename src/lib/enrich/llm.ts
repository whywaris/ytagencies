// Optional LLM step of the enrichment script, used only when ANTHROPIC_API_KEY is set: Claude
// picks industries from our list and quotes the sentence that shows it. Any suggestion whose quote
// isn't a literal piece of a fetched page is dropped (filterLlm). Tested (tests/enrich.test.mjs).
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { pageWithQuote, type Page, type Suggestion } from "./match.ts";

export const LLM_MODEL = "claude-opus-5-5";
// The budget per agency: the pages' text beyond this isn't sent (keywords still see all of it).
const MAX_CHARS = 60_000;

const Result = z.object({
  industries: z.array(z.object({ slug: z.string(), quote: z.string() })),
});
export type LlmResult = z.infer<typeof Result>;

/** Keeps known industries whose quote is literally on one of the pages; the quote's page is the source. */
export function filterLlm(result: LlmResult, pages: Page[], slugs: Set<string>): Suggestion[] {
  const out: Suggestion[] = [];
  for (const r of result.industries) {
    if (!slugs.has(r.slug)) continue;
    const page = pageWithQuote(r.quote, pages);
    if (!page) continue;
    out.push({
      industry: r.slug,
      evidence: r.quote.replace(/\s+/g, " ").trim(),
      sourceUrl: page.url,
      method: "llm",
      confidence: 0.7,
    });
  }
  return out;
}

export async function classifyWithClaude(
  client: Anthropic,
  industries: { slug: string; name: string }[],
  pages: Page[],
): Promise<LlmResult | null> {
  const text = pages.map((p) => `### ${p.url}\n${p.text}`).join("\n\n").slice(0, MAX_CHARS);
  const response = await client.messages.parse({
    model: LLM_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Result) },
    system:
      "You classify which industries a YouTube marketing agency serves, using only its own website text. " +
      "Pick from the given industry slugs only. Include an industry only when the text clearly says the agency " +
      "works with clients in it (a client list, case study, or a stated specialism), not a passing mention. " +
      "For each, copy one sentence from the text exactly, character for character, as the quote (under 300 characters). " +
      "Return an empty list when nothing is clear.",
    messages: [
      {
        role: "user",
        content:
          `Industries (slug: name):\n${industries.map((i) => `${i.slug}: ${i.name}`).join("\n")}\n\n` +
          `Website text:\n<website>\n${text}\n</website>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}
