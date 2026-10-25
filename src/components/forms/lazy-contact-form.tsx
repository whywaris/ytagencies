"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { ContactAgencyForm as ContactAgencyFormType } from "@/components/forms/contact-agency-form";

// The contact form (react-hook-form + Zod) sits far below the fold on every
// profile. Load it only when the visitor scrolls near it or follows "Request a quote" (#contact).
const ContactAgencyForm = dynamic(() =>
  import("@/components/forms/contact-agency-form").then((m) => m.ContactAgencyForm),
);

// Reserve the form's height so nothing shifts when it loads (CLS).
const RESERVED = "min-h-[1180px] sm:min-h-[900px]";

export function LazyContactForm(props: React.ComponentProps<typeof ContactAgencyFormType>) {
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
