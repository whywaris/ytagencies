"use server";

import { redirect } from "next/navigation";

import { safeNext } from "@/lib/auth";
import { clientIp, underRateLimit, verifyTurnstile } from "@/lib/forms/guard";
import { absoluteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import type { FormResult } from "@/lib/validation/lead";

/** Magic link. Same response whether or not the email has an account (no enumeration). */
export async function sendMagicLink(raw: unknown): Promise<FormResult> {
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website) {
    return { ok: true, data: undefined };
  }
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }
  const { email, next, turnstileToken } = parsed.data;

  const ip = await clientIp();
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "The security check didn't pass. Please try it again." };
  }
  if (!(await underRateLimit(ip, email))) {
    return { ok: false, error: "Too many sign-in attempts. Please try again in an hour." };
  }

  const supabase = await createClient();
  const callback = absoluteUrl(`/auth/callback?next=${encodeURIComponent(safeNext(next))}`);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback, shouldCreateUser: true },
  });
  if (error) {
    console.error("signInWithOtp failed", { status: error.status });
    return {
      ok: false,
      error: "We couldn't send the link right now. Please try again in a minute.",
    };
  }
  return { ok: true, data: undefined };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
