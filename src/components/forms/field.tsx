import Link from "next/link";

import { fieldClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const textareaClasses = cn(fieldClasses, "h-auto min-h-32 py-3 leading-normal");
export const selectClasses = cn(fieldClasses, "w-full");

/** Label + control + error. Controls should set aria-invalid and aria-describedby={errorId(id)}. */
export function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-medium">
        {label}
        {optional && <span className="font-normal text-text-2"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={errorId(id)} className="text-[14px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export const errorId = (id: string) => `${id}-error`;

export function a11yProps(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId(id) : undefined,
  };
}

/** Hidden from people and assistive tech; bots tend to fill it. Server drops submissions that do. */
export function Honeypot(props: React.ComponentProps<"input">) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" tabIndex={-1} autoComplete="off" {...props} />
      </label>
    </div>
  );
}

export function PrivacyNotice({ sharedWith }: { sharedWith: string }) {
  return (
    <p className="text-small">
      We share your name, email, company and message only with {sharedWith}, so they can reply to
      you. We don&apos;t sell your details or add you to a mailing list. To have your details
      deleted, reply to our confirmation email. See our{" "}
      <Link href="/privacy" className="text-accent hover:underline">
        privacy policy
      </Link>
      .
    </p>
  );
}
