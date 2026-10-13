"use client";

import Script from "next/script";
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

/**
 * Cloudflare Turnstile, explicit render, invisible on every form: appearance "interaction-only",
 * so visitors never see a box unless Cloudflare needs a click. Until then the container is out of
 * the layout (no reserved space); Cloudflare's before/after-interactive callbacks bring it in and
 * out. Tokens are single-use: bump `resetKey` after every server response so the visitor gets a
 * fresh one. Every submit is verified server-side (lib/forms/guard.ts), failing closed.
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
  const [ready, setReady] = useState(false);
  /** Cloudflare wants the visitor to interact: show the box in the page. */
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!ready || !container.current || !window.turnstile || !SITE_KEY) return;
    const id = window.turnstile.render(container.current, {
      sitekey: SITE_KEY,
      theme: document.documentElement.dataset.siteTheme === "dark" ? "dark" : "light",
      appearance: "interaction-only",
      size: "flexible",
      "before-interactive-callback": () => setInteractive(true),
      "after-interactive-callback": () => setInteractive(false),
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(""),
      "error-callback": () => callback.current(""),
    });
    widgetId.current = id;
    return () => {
      window.turnstile?.remove(id);
      widgetId.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) {
      window.turnstile?.reset(widgetId.current);
      callback.current("");
    }
  }, [resetKey]);

  if (!SITE_KEY) {
    return <p className="text-[14px] text-destructive">Security check isn&apos;t configured.</p>;
  }
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={container} className={interactive ? "w-full" : "absolute size-0 overflow-hidden"} />
    </>
  );
}
