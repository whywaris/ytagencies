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
 * Cloudflare Turnstile, explicit render. Tokens are single-use: bump `resetKey` after every
 * server response so the visitor gets a fresh one. The token is verified server-side only.
 * `invisible`: no box unless Cloudflare needs the visitor to interact (appearance
 * "interaction-only"), so it takes no space on the page until then.
 */
export function Turnstile({
  onToken,
  resetKey,
  invisible = false,
}: {
  onToken: (token: string) => void;
  resetKey: number;
  invisible?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callback = useRef(onToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!ready || !container.current || !window.turnstile || !SITE_KEY) return;
    const id = window.turnstile.render(container.current, {
      sitekey: SITE_KEY,
      theme: document.documentElement.dataset.siteTheme === "dark" ? "dark" : "light",
      ...(invisible && { appearance: "interaction-only", size: "flexible" }),
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(""),
      "error-callback": () => callback.current(""),
    });
    widgetId.current = id;
    return () => {
      window.turnstile?.remove(id);
      widgetId.current = null;
    };
  }, [ready, invisible]);

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
      <div ref={container} className={invisible ? undefined : "min-h-[65px]"} />
    </>
  );
}
