import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

// SECURITY.md public-form checks that need the server: Turnstile and rate limiting.

const RATE_LIMIT = 5;
const RATE_WINDOW = "1 hour";
const RATE_WINDOW_MS = 60 * 60 * 1000; // same as RATE_WINDOW

export async function clientIp() {
  const h = await headers();
  // Vercel sets x-forwarded-for; the first entry is the client.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set");
    return false;
  }
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // fail closed
  }
}

// Hashed so the table never holds raw IPs or email addresses.
const hashKey = (kind: string, value: string) =>
  `${kind}:${createHash("sha256").update(value.toLowerCase()).digest("hex")}`;

/** Records one submission per IP and per email; false if either is over 5 in the last hour. */
export async function underRateLimit(ip: string, email: string) {
  const supabase = createAdminClient();
  const results = await Promise.all(
    [hashKey("ip", ip), hashKey("email", email)].map((key) =>
      supabase.rpc("hit_rate_limit", { p_key: key, p_limit: RATE_LIMIT, p_window: RATE_WINDOW }),
    ),
  );
  for (const r of results) if (r.error) throw r.error;
  return results.every((r) => r.data === true);
}

/**
 * After underRateLimit refused: when the sender may try again, i.e. when the oldest hit of each
 * over-limit key leaves the window. Null if it can't tell (the caller then says "in an hour").
 */
export async function rateLimitRetryAt(ip: string, email: string) {
  const keys = [hashKey("ip", ip), hashKey("email", email)];
  const { data, error } = await createAdminClient()
    .from("rate_limits")
    .select("key, created_at")
    .in("key", keys)
    .order("created_at", { ascending: true });
  if (error) return null;
  const retry = keys
    .map((k) => data.filter((r) => r.key === k))
    .filter((hits) => hits.length >= RATE_LIMIT)
    .map((hits) => new Date(hits[0].created_at).getTime() + RATE_WINDOW_MS);
  return retry.length ? new Date(Math.max(...retry)) : null;
}

/** One hashed bucket (e.g. "beacon" per IP) with its own limit; false once it's over. Fails closed. */
export async function hitRateLimit(kind: string, value: string, limit: number, window: string) {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: hashKey(kind, value),
    p_limit: limit,
    p_window: window,
  });
  return !error && data === true;
}
