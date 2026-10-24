"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** No token, no challenge and no error after this long: say so and offer a retry. */
const SLOW_MS = 20_000;

// One script for every form on the page. A failed load clears the promise, so Retry loads again.
let loading: Promise<void> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve() : reject(new Error("no turnstile")));
    s.onerror = () => {
      s.remove();
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(s);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

type Status = "loading" | "ready" | "done" | "failed" | "error" | "slow";

/**
 * Cloudflare Turnstile, explicit render, invisible on every form: appearance "interaction-only",
 * so visitors never see a box unless Cloudflare needs a click. Until then the container is out of
 * the layout; Cloudflare's before/after-interactive callbacks bring it in and out. If the script
 * can't load (blocked, offline), Cloudflare reports an error, or nothing happens for 20 seconds,
 * the visitor gets a plain message and a Try again button instead of a silent "complete the
 * security check". Tokens are single-use: bump `resetKey` after every server response. Every
 * submit is verified server-side (lib/forms/guard.ts), failing closed.
 */
export function Turnstile({
  onToken,
  resetKey,
}: {
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callback = useRef(onToken);
  const [status, setStatus] = useState<Status>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Cloudflare wants the visitor to interact: show the box in the page. */
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  // Load the script (again, after Try again) and render the widget.
  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadTurnstile().then(
      () => {
        if (cancelled || !container.current || !window.turnstile) return;
        setStatus("ready");
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: SITE_KEY,
          theme: document.documentElement.dataset.siteTheme === "dark" ? "dark" : "light",
          appearance: "interaction-only",
          size: "flexible",
          "before-interactive-callback": () => setInteractive(true),
          "after-interactive-callback": () => setInteractive(false),
          callback: (token: string) => {
            setStatus("done");
            setCode(null);
            callback.current(token);
          },
          "expired-callback": () => {
            setStatus("ready");
            callback.current("");
          },
          "error-callback": (errorCode: string) => {
            setStatus("error");
            setCode(String(errorCode ?? "").slice(0, 12) || null);
            callback.current("");
            // Handled: we show the message and the retry ourselves.
            return true;
          },
        });
      },
      () => {
        if (!cancelled) setStatus("failed");
      },
    );
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [attempt]);

  // Nothing at all after a while (no token, no challenge, no error): offer a retry.
  useEffect(() => {
    if (status !== "loading" && status !== "ready") return;
    if (interactive) return;
    const t = setTimeout(() => setStatus((s) => (s === "loading" || s === "ready" ? "slow" : s)), SLOW_MS);
    return () => clearTimeout(t);
  }, [status, interactive, attempt]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) {
      window.turnstile?.reset(widgetId.current);
      setStatus("ready");
      callback.current("");
    }
  }, [resetKey]);

  const retry = () => {
    setStatus("loading");
    setCode(null);
    setInteractive(false);
    setAttempt((n) => n + 1);
  };

  if (!SITE_KEY) {
    return (
      <p role="alert" className="text-[14px] text-destructive">
        The security check isn&apos;t set up, so this form can&apos;t be sent. Please email us
        instead.
      </p>
    );
  }
  const problem =
    status === "failed"
      ? "The security check didn't load. An ad blocker or a slow connection can stop it."
      : status === "error"
        ? `The security check ran into a problem${code ? ` (code ${code})` : ""}.`
        : status === "slow"
          ? "The security check is taking longer than usual."
          : null;
  return (
    <div data-turnstile-status={status} className="contents">
      <div ref={container} className={interactive ? "w-full" : "absolute size-0 overflow-hidden"} />
      {problem && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
          <span className="text-destructive">{problem}</span>
          <button
            type="button"
            onClick={retry}
            className="rounded font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
