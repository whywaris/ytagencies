import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// A GET link rather than a form post: CSP form-action 'self' would block a form redirecting to Google.
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    return NextResponse.redirect(
      new URL(`/login?error=google&next=${encodeURIComponent(next)}`, request.url),
    );
  }
  return NextResponse.redirect(data.url);
}
