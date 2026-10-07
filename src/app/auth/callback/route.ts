import { NextResponse, type NextRequest } from "next/server";

import { postLoginPath, safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

// Magic links sent with Supabase's default email template land here with a PKCE code (they only
// work in the browser that asked for them) and, if the visitor came from a gated page, ?next=.
// Without one, admins go to /admin and everyone else to /dashboard. With the token-hash template
// (docs/LAUNCH.md) links go to /auth/confirm instead; this URL is still their emailRedirectTo.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: profile } = next
        ? { data: null }
        : await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      return NextResponse.redirect(new URL(postLoginPath(next, profile?.role === "admin"), origin));
    }
  }
  return NextResponse.redirect(
    new URL(`/login?error=link${next ? `&next=${encodeURIComponent(next)}` : ""}`, origin),
  );
}
