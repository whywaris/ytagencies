import { NextResponse, type NextRequest } from "next/server";

import { confirmEmailLink } from "@/lib/redirects";
import { absoluteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Magic link and sign-up emails land here (token_hash flow, template in docs/LAUNCH.md). Unlike
// PKCE links through /auth/callback, these work when opened in another browser or device.
// /auth/callback stays for Google OAuth.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createClient();
  const to = await confirmEmailLink(
    {
      tokenHash: searchParams.get("token_hash"),
      type: searchParams.get("type"),
      next: searchParams.get("next"),
    },
    [origin, new URL(absoluteUrl("/")).origin],
    {
      async verifyOtp(tokenHash, type) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "email" | "magiclink" | "signup",
        });
        if (error || !data.user) {
          // Code and status only: never the token or the email.
          console.error("verifyOtp failed", { code: error?.code, status: error?.status });
          return { errorCode: error?.code ?? "no_user" };
        }
        return { userId: data.user.id };
      },
      async isAdmin(userId) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        return data?.role === "admin";
      },
    },
  );
  return NextResponse.redirect(new URL(to, origin));
}
