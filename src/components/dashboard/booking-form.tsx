"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBooking } from "@/lib/actions/dashboard";

// Calendly link and WhatsApp number: buttons on the profile while on Pro (lib/booking.ts).
export function BookingForm({
  agencyId,
  calendlyUrl,
  whatsappNumber,
}: {
  agencyId: string;
  calendlyUrl: string;
  whatsappNumber: string;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateBooking(agencyId, {
        calendlyUrl: String(data.get("calendlyUrl") ?? ""),
        whatsappNumber: String(data.get("whatsappNumber") ?? ""),
      });
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      setStatus(res.ok ? { ok: true, message: "Saved." } : { ok: false, message: res.error });
      if (res.ok) router.refresh();
    });
  }

  const field = (name: string, label: string, hint: string, value: string, placeholder: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`booking-${name}`} className="text-[14px] font-medium">
        {label} <span className="font-normal text-text-2">(optional)</span>
      </label>
      <Input
        id={`booking-${name}`}
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        aria-invalid={!!errors[name]}
        aria-describedby={`booking-${name}-hint`}
        inputMode={name === "whatsappNumber" ? "tel" : "url"}
        maxLength={300}
      />
      <p id={`booking-${name}-hint`} className={errors[name] ? "text-destructive" : "text-text-2"}>
        {errors[name] ?? hint}
      </p>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="flex max-w-reading flex-col gap-5">
      {field(
        "calendlyUrl",
        "Calendly link",
        "A calendly.com link. Shows a “Book a call” button on your profile.",
        calendlyUrl,
        "https://calendly.com/your-agency/intro",
      )}
      {field(
        "whatsappNumber",
        "WhatsApp number",
        "With the country code, or a wa.me link. Shows a WhatsApp button on your profile.",
        whatsappNumber,
        "+1 555 123 4567",
      )}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save booking buttons"}
        </Button>
        {status && (
          <p
            role={status.ok ? "status" : "alert"}
            className={status.ok ? "text-text" : "text-destructive"}
          >
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
