"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { checkboxRow, selectClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addWorkSample, deleteWorkSample, moveWorkSample } from "@/lib/actions/work-samples";
import type { FormResult } from "@/lib/validation/lead";
import { NOTE_MAX, thumbnailUrl } from "@/lib/work-samples";
import { cn } from "@/lib/utils";

export type EditorSample = {
  id: string;
  videoId: string;
  title: string;
  format: string;
  service: string | null;
  note: string | null;
  hidden: boolean;
  /** Past the plan's limit: saved, not on the profile. */
  overLimit: boolean;
};

const button =
  "grid size-9 place-items-center rounded-lg border border-line transition-colors duration-150 hover:bg-surface disabled:opacity-40";

// Dashboard → Work samples: paste a YouTube link, pick the service, confirm, reorder, delete.
// At the plan's limit the add form gives way to `upgrade` (the existing upgrade dialog).
export function WorkSamplesEditor({
  agencyId,
  samples,
  services,
  limit,
  upgrade,
}: {
  agencyId: string;
  samples: EditorSample[];
  services: { slug: string; name: string }[];
  limit: number;
  upgrade: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const run = (fn: () => Promise<FormResult>, done?: string) =>
    startTransition(async () => {
      const res = await fn();
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      setMessage(res.ok ? (done ? { ok: true, text: done } : null) : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });

  const full = samples.length >= limit;

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-text" : "text-destructive"}>
          {message.text}
        </p>
      )}

      {samples.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {samples.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 p-3">
              <Image
                src={thumbnailUrl(s.videoId)}
                alt=""
                width={96}
                height={54}
                className="h-[54px] w-24 shrink-0 rounded-md object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.title}</span>
                <span className="block text-small">
                  {[s.format === "short" ? "Short" : "Video", s.service].filter(Boolean).join(" · ")}
                  {s.hidden && " · Hidden by our team"}
                  {!s.hidden && s.overLimit && " · Not shown: over your plan's limit"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={button}
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveWorkSample(agencyId, s.id, "up"))}
                  aria-label={`Move “${s.title}” up`}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={pending || i === samples.length - 1}
                  onClick={() => run(() => moveWorkSample(agencyId, s.id, "down"))}
                  aria-label={`Move “${s.title}” down`}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="h-9 rounded-lg border border-line px-3 text-destructive hover:bg-surface disabled:opacity-40"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Remove “${s.title}”?`)) run(() => deleteWorkSample(agencyId, s.id), "Removed.");
                  }}
                >
                  Remove<span className="sr-only"> “{s.title}”</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <div className="flex max-w-reading flex-col items-start gap-3 rounded-xl bg-surface p-4">
          <p>
            You&apos;ve added {samples.length} of {limit} work samples on your plan. Remove one to add
            another{limit < 12 ? ", or get Pro for up to 12" : ""}.
          </p>
          {limit < 12 && upgrade}
        </div>
      ) : (
        <form
          key={formKey}
          className="flex max-w-reading flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await addWorkSample(agencyId, {
                url: String(data.get("url") ?? ""),
                service: String(data.get("service") ?? ""),
                note: String(data.get("note") ?? ""),
                workedOnIt: data.get("workedOnIt") === "on",
              });
              setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
              setMessage(res.ok ? { ok: true, text: "Added." } : { ok: false, text: res.error });
              if (res.ok) {
                setFormKey((k) => k + 1);
                router.refresh();
              }
            });
          }}
        >
          <h3 className="text-h3">Add a video</h3>
          <Field name="url" label="YouTube link" error={errors.url}>
            <Input
              id="ws-url"
              name="url"
              inputMode="url"
              maxLength={500}
              placeholder="https://www.youtube.com/watch?v=… or a Shorts link"
              aria-invalid={!!errors.url}
              aria-describedby="ws-url-hint"
            />
          </Field>
          <Field name="service" label="Service" error={errors.service}>
            <select
              id="ws-service"
              name="service"
              defaultValue={services.length === 1 ? services[0].slug : ""}
              aria-invalid={!!errors.service}
              aria-describedby="ws-service-hint"
              className={selectClasses}
            >
              <option value="">Choose a service</option>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field name="note" label="Note (optional)" error={errors.note} hint={`What you did, in ${NOTE_MAX} characters or fewer.`}>
            <Input
              id="ws-note"
              name="note"
              maxLength={NOTE_MAX}
              aria-invalid={!!errors.note}
              aria-describedby="ws-note-hint"
            />
          </Field>
          <div className="flex flex-col gap-1">
            <label className={checkboxRow}>
              <input
                type="checkbox"
                name="workedOnIt"
                aria-invalid={!!errors.workedOnIt}
                aria-describedby={errors.workedOnIt ? "ws-workedOnIt-hint" : undefined}
              />
              <span>We worked on this video</span>
            </label>
            {errors.workedOnIt && (
              <p id="ws-workedOnIt-hint" className="text-[14px] text-destructive">
                {errors.workedOnIt}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Checking with YouTube…" : "Add video"}
          </Button>
        </form>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`ws-${name}`} className="text-[14px] font-medium">
        {label}
      </label>
      {children}
      {(error || hint) && (
        <p id={`ws-${name}-hint`} className={cn(error ? "text-destructive" : "text-text-2")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
