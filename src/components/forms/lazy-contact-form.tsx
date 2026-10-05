"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// The contact form (react-hook-form + Zod + Turnstile, ~140 KB gz) sits far below the fold on every
// profile. Load it only when the visitor scrolls near it or follows "Contact agency" (#contact).
const ContactAgencyForm = dynamic(() =>
  import("@/components/forms/contact-agency-form").then((m) => m.ContactAgencyForm),
);

// Reserve the form's height so nothing shifts when it loads (CLS).
const RESERVED = "min-h-[760px] sm:min-h-[620px]";

export function LazyContactForm(props: { agencySlug: string; agencyName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={RESERVED}>
      {show ? <ContactAgencyForm {...props} /> : null}
    </div>
  );
}
