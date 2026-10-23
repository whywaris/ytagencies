// Moved pages, as 301s (not Next's default 308); Next keeps the query string, so prefilled links
// (?service=&industry=&ref=) still work. No imports: next.config.ts and tests load this.

// The agency pricing page moved from /for-agencies/pricing to /pricing.
export const PRICING_REDIRECTS = [
  { source: "/for-agencies/pricing", destination: "/pricing", statusCode: 301 as const },
  // No page of its own: agencies land on pricing.
  { source: "/for-agencies", destination: "/pricing", statusCode: 301 as const },
];

// Get matched became Request proposals (we're a directory, not a broker).
export const PROPOSALS_REDIRECTS = [
  { source: "/get-matched", destination: "/request-proposals", statusCode: 301 as const },
];
