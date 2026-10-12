"use client";

import { CircleAlert, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Honeypot } from "@/components/forms/field";
import { Turnstile } from "@/components/forms/turnstile";
import { sendMagicLink } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { loginSchema } from "@/lib/validation/auth";
import type { FormResult } from "@/lib/validation/lead";

// Sign in and create account are the same flow (magic link, or Google when it's switched on in
// Supabase); the mode only changes the copy. Sending swaps the card to "Check your email" without
// a reload. The card is a polite live region, and focus moves to the new title on each switch.

type Mode = "signin" | "signup";

const COPY = {
  signin: { title: "Welcome back", subtitle: "Sign in to manage your agency." },
  signup: {
    title: "Create your account",
    subtitle: "List your agency for free. It takes about two minutes.",
  },
} as const;

const RESEND_SECONDS = 60;
const VERIFY_FAILED = "Verification failed. Refresh the page and try again.";

const secondary =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line bg-raised px-4 font-semibold transition-colors duration-150 hover:border-text-2 disabled:cursor-not-allowed disabled:text-text-2 disabled:hover:border-line";

export function LoginCard({
  next,
  initialMode,
  initialError,
  google,
}: {
  next: string;
  initialMode: Mode;
  initialError: string | null;
  google: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const token = useRef("");
  const honeypot = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const switched = useRef(false);

  // Move focus to the new title when the card changes view (not on first load).
  useEffect(() => {
    if (switched.current) title.current?.focus();
    switched.current = true;
  }, [view]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** Invisible Turnstile usually has a token within a second; wait up to 10s for it. */
  async function turnstileToken() {
    for (let i = 0; i < 100 && !token.current; i++) await new Promise((r) => setTimeout(r, 100));
    return token.current;
  }

  async function send(address: string) {
    setError(null);
    const valid = loginSchema.shape.email.safeParse(address);
    if (!valid.success) return setError(valid.error.issues[0].message);
    setPending(true);
    const turnstile = await turnstileToken();
    const result: FormResult = turnstile
      ? await sendMagicLink({
          email: valid.data,
          next,
          turnstileToken: turnstile,
          website: honeypot.current?.value ?? "",
        })
      : { ok: false, error: VERIFY_FAILED };
    // Tokens are single-use: get a fresh one for the next send.
    token.current = "";
    setResetKey((k) => k + 1);
    setPending(false);
    if (!result.ok) {
      const fields = result.fieldErrors;
      return setError(fields?.email ?? (fields?.turnstileToken ? VERIFY_FAILED : result.error));
    }
    setSentTo(valid.data);
    setCooldown(RESEND_SECONDS);
    setView("sent");
  }

  const googleHref = next ? `/auth/google?next=${encodeURIComponent(next)}` : "/auth/google";
  const errorBox = error && (
    <div
      id="login-error"
      className="flex items-start gap-2.5 rounded-[12px] bg-(--coral-soft) px-3.5 py-3 text-[14.5px] text-(--coral-on-soft)"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 [stroke-width:2]" aria-hidden />
      <p>{error}</p>
    </div>
  );

  return (
    <section
      aria-live="polite"
      aria-labelledby="login-title"
      className="rise-sm mx-auto w-full max-w-[440px] rounded-[24px] border border-line bg-raised px-5 py-6 shadow-[0_1px_2px_rgba(20,25,40,.05),0_12px_32px_-12px_rgba(20,25,40,.14),0_40px_80px_-32px_rgba(20,25,40,.2)] sm:p-8"
    >
      {/* Mounted in both views, so "Resend link" has a token ready too. */}
      <Turnstile invisible resetKey={resetKey} onToken={(t) => (token.current = t)} />

      {view === "form" ? (
        <div className="flex flex-col gap-6">
          <div
            role="group"
            aria-label="Account"
            className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1"
          >
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-10 rounded-full text-[15px] font-semibold transition-colors duration-150",
                  mode === m
                    ? "bg-raised text-text shadow-[0_1px_2px_rgba(20,25,40,.08),0_2px_6px_-2px_rgba(20,25,40,.12)]"
                    : "text-text-2 hover:text-text",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <h2
              id="login-title"
              ref={title}
              tabIndex={-1}
              className="text-[26px] leading-tight font-[650] tracking-[-0.03em] outline-none"
            >
              {COPY[mode].title}
            </h2>
            <p className="text-text-2">{COPY[mode].subtitle}</p>
          </div>

          {google && (
            <>
              {/* Plain link: a GET to our route, which redirects to Google. */}
              <a href={googleHref} className={secondary}>
                <GoogleLogo />
                Continue with Google
              </a>
              <div className="flex items-center gap-4 text-[14px] text-text-2" aria-hidden>
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form
            noValidate
            className="relative flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(email);
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="login-email" className="text-[15px] font-semibold">
                Work email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@youragency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error login-hint" : "login-hint"}
                className={cn(
                  "h-12 w-full rounded-[12px] border bg-bg px-4 text-[16px] transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-text-2 focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)]",
                  error ? "border-(--coral)" : "border-line",
                )}
              />
              <p id="login-hint" className="text-[14px] text-text-2">
                We&apos;ll email you a link. No password needed.
              </p>
            </div>
            <Honeypot ref={honeypot} name="website" />
            {errorBox}
            <button
              type="submit"
              disabled={pending}
              className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-4 font-semibold text-on-accent transition-colors duration-150 hover:bg-(--accent-hover) disabled:cursor-wait disabled:opacity-80"
            >
              {pending ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>

          {mode === "signup" && (
            <p className="text-[14px] text-text-2">
              By creating an account you agree to our{" "}
              <Link href="/terms" className="text-accent hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-[18px] bg-(--accent-soft) text-(--accent-on-soft)"
          >
            <Mail className="size-7 [stroke-width:1.75]" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2
              id="login-title"
              ref={title}
              tabIndex={-1}
              className="text-[26px] leading-tight font-[650] tracking-[-0.03em] outline-none"
            >
              Check your email
            </h2>
            <p className="text-text-2">
              We sent a sign-in link to <strong className="text-text [overflow-wrap:anywhere]">{sentTo}</strong>.
            </p>
          </div>
          <ol className="flex flex-col gap-2.5 rounded-[14px] bg-surface p-4 text-[15px]">
            {[
              "Open the email from YT Agencies.",
              "Click the sign-in link. It works for one hour.",
              "Can't find it? Check your spam folder.",
            ].map((line, i) => (
              <li key={line} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-[13px] font-semibold"
                >
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
          {errorBox}
          <div className="grid gap-3 min-[400px]:grid-cols-2">
            <button
              type="button"
              disabled={cooldown > 0 || pending}
              onClick={() => send(sentTo)}
              className={secondary}
            >
              {pending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setView("form");
              }}
              className={secondary}
            >
              Use another email
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Google's "G", as Google's sign-in branding asks. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
