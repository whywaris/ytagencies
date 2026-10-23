import { type NextRequest } from "next/server";

import { readVerificationToken } from "@/lib/claims";
import { createAdminClient } from "@/lib/supabase/admin";

// The work-email link for the Verified badge (lib/actions/dashboard.ts requestVerification).
// Valid 24 hours (signed token) and once: only an 'email_pending' request moves to 'requested',
// which is the admin queue; the click time is kept as proof of the domain. Then back to the
// dashboard's Verification tab (sign-in first if needed).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const id = token.length <= 300 ? readVerificationToken(token) : null;
  const back = (path: string) => Response.redirect(new URL(path, request.nextUrl.origin), 303);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    return back("/dashboard?status=verification-link-invalid");

  const { data } = await createAdminClient()
    .from("verifications")
    .update({ status: "requested", verified_email_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "email_pending")
    .select("agencies(slug)")
    .maybeSingle();
  const slug = (data?.agencies as { slug: string } | null)?.slug;
  return slug
    ? back(`/dashboard/${slug}/verification?status=email-confirmed`)
    : back("/dashboard?status=verification-link-invalid");
}
