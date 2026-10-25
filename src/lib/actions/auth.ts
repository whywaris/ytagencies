"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { googleSignInEnabled } from "@/lib/auth-providers";
import { clientIp, rateLimitRetryAt, underRateLimit } from "@/lib/forms/guard";
import { authOrigin, callbackUrl } from "@/lib/redirects";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import type { FormResult } from "@/lib/validation/lead";

const SUPABASE_RATE_LIMITED = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

/** "in about 12 minutes" until `at` (at least a minute; an hour when unknown). */
function retryIn(at: Date | null) {
  if (!at) return "in an hour";
  const minutes = Math.max(1, Math.ceil((at.getTime() - Date.now()) / 60_000));
  return minutes >= 60 ? "in an hour" : `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** The origin this request came in on (the proxy sets x-forwarded-* on Vercel). */
async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : null;
}

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
  const { email, next } = parsed.data;

  const ip = await clientIp();
  if (!(await underRateLimit(ip, email))) {
    const at = await rateLimitRetryAt(ip, email);
    return { ok: false, error: `Too many sign-in attempts. You can try again ${retryIn(at)}.` };
  }

  const supabase = await createClient();
  const callback = authOrigin(await requestOrigin(), SITE_URL) + callbackUrl(next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback, shouldCreateUser: true },
  });
  if (error) {
    // Code and message only; Supabase messages can quote the address, so emails are masked.
    console.error("signInWithOtp failed", {
      code: error.code,
      status: error.status,
      message: error.message.replace(/[^\s"'<>@]+@[^\s"'<>@]+/g, "[email]"),
    });
    if (error.code && SUPABASE_RATE_LIMITED.has(error.code)) {
      return {
        ok: false,
        error: (await googleSignInEnabled())
          ? "Too many sign-in emails were sent. Try again in an hour or continue with Google."
          : "Too many sign-in emails were sent. Try again in an hour.",
      };
    }
    if (error.status && error.status >= 500) {
      // Supabase couldn't hand the email off (e.g. an SMTP timeout: check Auth logs in Supabase).
      return {
        ok: false,
        error: "Our email service didn't respond. Please try again in a few minutes.",
      };
    }
    if (error.code === "email_address_invalid") {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: { email: "That email address doesn't look right." },
      };
    }
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
