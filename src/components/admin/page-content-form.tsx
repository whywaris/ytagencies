"use client";

import { useState, useTransition } from "react";

import { textareaClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePageContent } from "@/lib/actions/admin-page-content";

/** Summary and intro for one directory page; empty both to go back to the data-built intro. */
export function PageContentForm({
  path,
  summary,
  intro,
  dataIntro,
}: {
  path: string;
  summary: string;
  intro: string;
  /** What the page shows until an intro is written. */
  dataIntro: string;
}) {
  const [values, setValues] = useState({ summary, intro });
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const words = values.intro.trim().split(/\s+/).filter(Boolean).length;

  return (
    <form
      className="flex max-w-reading flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await savePageContent(path, values);
          setStatus(res.ok ? { ok: true, message: "Saved." } : { ok: false, message: res.error });
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="pc-summary" className="font-medium">
          Summary <span className="font-normal text-text-2">(one line under the H1, optional)</span>
        </label>
        <Input
          id="pc-summary"
          maxLength={300}
          value={values.summary}
          onChange={(e) => setValues((v) => ({ ...v, summary: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pc-intro" className="font-medium">
          Intro
        </label>
        <textarea
          id="pc-intro"
          rows={8}
          maxLength={4000}
          value={values.intro}
          onChange={(e) => setValues((v) => ({ ...v, intro: e.target.value }))}
          aria-describedby="pc-intro-hint"
          className={textareaClasses}
        />
        <p id="pc-intro-hint" className="text-small">
          {words} words. Real facts about this page only; no filler. Until you write one, the page
          says: &ldquo;{dataIntro || "nothing yet"}&rdquo;
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {status && (
          <p role={status.ok ? "status" : "alert"} className={status.ok ? "" : "text-destructive"}>
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
