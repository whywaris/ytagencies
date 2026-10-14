// The agency pricing page moved from /for-agencies/pricing to /pricing. 301s (not Next's default
// 308) as asked; Next keeps the query string. No imports: next.config.ts and tests load this.
export const PRICING_REDIRECTS = [
  { source: "/for-agencies/pricing", destination: "/pricing", statusCode: 301 as const },
  // No page of its own: agencies land on pricing.
  { source: "/for-agencies", destination: "/pricing", statusCode: 301 as const },
];
