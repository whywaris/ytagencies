// Turnstile keys must be real in production. Cloudflare's documented test keys (site keys and
// secrets starting "1x0000", "2x0000", "3x0000") always pass or always fail, so they must never
// ship. Local and preview may use them. No imports: next.config.ts (build check), the server
// (lib/forms/guard.ts) and tests use it.

const TEST_KEY = /^[123]x0000/;

/** What's wrong with the Turnstile keys for this environment; empty when fine. */
export function turnstileKeyProblems(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV !== "production") return [];
  const problems: string[] = [];
  for (const name of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]) {
    const value = env[name]?.trim();
    if (!value) problems.push(`${name} is not set`);
    else if (TEST_KEY.test(value))
      problems.push(`${name} is a Cloudflare test key; production needs the real key`);
  }
  return problems;
}
