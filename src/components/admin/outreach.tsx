"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  importContacts,
  previewContactImport,
  queueOutreachInvites,
  removeOutreachContact,
  saveOutreachContact,
  saveOutreachSettings,
  sendOutreachTest,
  setOutreachPaused,
  type OutreachSettingsInput,
} from "@/lib/actions/admin-outreach";
import { renderTemplate, VARIABLES, type ImportRow, type Template, type Variables } from "@/lib/outreach-rules";
import { cn } from "@/lib/utils";

// Admin → Growth → Outreach, the interactive parts. Every action re-checks the admin on the server.

const btn =
  "inline-flex h-9 items-center justify-center rounded-lg border border-line px-3 text-[14px] font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent";
const primary =
  "inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-[14px] font-medium text-on-accent hover:bg-(--accent-hover) disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const input = "h-9 w-full rounded-lg border border-line bg-bg px-3 text-[14px]";
const label = "flex flex-col gap-1 text-[13px] font-medium";

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<Result>, done?: string) =>
    start(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      if (done) toast.success(done);
      router.refresh();
    });
  return { pending, run };
}

/** The big switch: nothing is sent while paused. */
export function PauseSwitch({ paused, problems }: { paused: boolean; problems: string[] }) {
  const { pending, run } = useAction();
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4", paused ? "border-warning" : "border-line")}>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{paused ? "Outreach is paused" : "Outreach is sending"}</p>
        <p className="text-admin-meta">
          {problems.length ? problems.join(" ") : "Weekdays 09:00–17:00 UTC, within the daily cap."}
        </p>
      </div>
      <button
        type="button"
        className={paused ? primary : btn}
        disabled={pending}
        onClick={() => run(() => setOutreachPaused(!paused), paused ? "Outreach resumed" : "Outreach paused")}
      >
        {paused ? "Resume outreach" : "Pause outreach"}
      </button>
    </div>
  );
}

/** Templates and sending settings, with a live preview for a real agency and "Send test to me". */
export function OutreachSettingsForm({
  initial,
  agencies,
  previewVars,
}: {
  initial: OutreachSettingsInput;
  agencies: { id: string; name: string }[];
  /** Per agency id: the real variables (claim link shown with a sample token). */
  previewVars: Record<string, Omit<Variables, "sender_name" | "business_address">>;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState<Template>("invite");
  const [agencyId, setAgencyId] = useState(agencies[0]?.id ?? "");
  const { pending, run } = useAction();
  const set = (k: keyof OutreachSettingsInput) => (e: { target: { value: string } }) =>
    setV((s) => ({ ...s, [k]: e.target.value }));
  const field = (k: keyof OutreachSettingsInput, text: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={label}>
      {text}
      <input className={input} value={String(v[k] ?? "")} onChange={set(k)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <span className="text-[13px] text-destructive">{errors[k]}</span>}
    </label>
  );
  const vars = previewVars[agencyId];
  const subject = template === "invite" ? v.inviteSubject : v.reminderSubject;
  const body = template === "invite" ? v.inviteBody : v.reminderBody;
  const full: Variables | null = vars
    ? { ...vars, sender_name: v.senderName, business_address: v.businessAddress || "[business address]" }
    : null;

  const save = () =>
    run(async () => {
      const res = await saveOutreachSettings(v);
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      return res;
    }, "Saved");

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-semibold">Sending</legend>
          {field("senderName", "Sender name")}
          {field("from", "From address", { placeholder: "hello@mail.ytagencies.com", type: "email" })}
          {field("replyTo", "Reply-to (optional)", { type: "email" })}
          {field("businessAddress", "Business postal address (required to send)")}
          {field("dailyCap", "Daily cap", { type: "number", min: 1, max: 200 })}
          {field("reminderDays", "Reminder after (days)", { type: "number", min: 3, max: 60 })}
        </fieldset>
        {(["invite", "reminder"] as const).map((t) => (
          <fieldset key={t} className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">{t === "invite" ? "Invite" : "Reminder"}</legend>
            {field(t === "invite" ? "inviteSubject" : "reminderSubject", "Subject")}
            <label className={label}>
              Body
              <textarea
                className="min-h-56 rounded-lg border border-line bg-bg p-3 font-mono text-[13px]"
                value={t === "invite" ? v.inviteBody : v.reminderBody}
                onChange={set(t === "invite" ? "inviteBody" : "reminderBody")}
              />
            </label>
          </fieldset>
        ))}
        <p className="text-admin-meta">Variables: {VARIABLES.map((n) => `{${n}}`).join(" ")}. A “Remove my listing” link is always added at the end.</p>
        <button type="submit" className={cn(primary, "self-start")} disabled={pending}>
          Save
        </button>
      </form>

      <section aria-label="Preview" className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <select className={cn(input, "w-auto")} value={template} onChange={(e) => setTemplate(e.target.value as Template)} aria-label="Template">
            <option value="invite">Invite</option>
            <option value="reminder">Reminder</option>
          </select>
          <select className={cn(input, "w-auto max-w-64")} value={agencyId} onChange={(e) => setAgencyId(e.target.value)} aria-label="Agency">
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btn}
            disabled={pending || !agencyId}
            onClick={() => run(() => sendOutreachTest(template, agencyId), "Test sent to your email")}
          >
            Send test to me
          </button>
        </div>
        <p className="text-admin-meta">The test uses the saved settings: save first.</p>
        {full ? (
          <div className="rounded-xl border border-line p-4">
            <p className="mb-3 font-semibold">{renderTemplate(subject, full)}</p>
            <pre className="font-sans text-[14px] whitespace-pre-wrap">{renderTemplate(body, full)}</pre>
          </div>
        ) : (
          <p className="text-text-2">No unclaimed agency to preview with.</p>
        )}
      </section>
    </div>
  );
}

/** One agency's address: edit inline, or remove it. */
export function ContactRow({ agencyId, email }: { agencyId: string; email: string }) {
  const [value, setValue] = useState(email);
  const { pending, run } = useAction();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveOutreachContact(agencyId, value), "Saved");
      }}
    >
      <input className={cn(input, "min-w-56")} type="email" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Email" />
      <button type="submit" className={btn} disabled={pending || value === email}>
        Save
      </button>
      {email && (
        <button type="button" className={btn} disabled={pending} onClick={() => run(() => removeOutreachContact(agencyId), "Removed")}>
          Remove
        </button>
      )}
    </form>
  );
}

/** CSV import (agency slug, email) with a preview before anything is saved. */
export function ContactImport() {
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const counts = rows?.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
  const savable = rows?.filter((r) => r.status === "matched" || r.status === "updated").length ?? 0;
  return (
    <div className="flex flex-col gap-3">
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          setRows(null);
          setCsv(f ? await f.text() : "");
        }}
      />
      <p className="text-admin-meta">Two columns: agency slug, email. A header row is fine.</p>
      <div className="flex gap-2">
        <button
          type="button"
          className={btn}
          disabled={!csv || pending}
          onClick={() =>
            start(async () => {
              const res = await previewContactImport(csv);
              if (!res.ok) return void toast.error(res.error);
              setRows(res.data);
            })
          }
        >
          Preview
        </button>
        <button
          type="button"
          className={primary}
          disabled={!savable || pending}
          onClick={() =>
            start(async () => {
              const res = await importContacts(csv);
              if (!res.ok) return void toast.error(res.error);
              toast.success(`Saved ${res.data.saved} address${res.data.saved === 1 ? "" : "es"}`);
              setRows(null);
              setCsv("");
              router.refresh();
            })
          }
        >
          Save {savable || ""}
        </button>
      </div>
      {rows && (
        <>
          <p className="text-[14px]">
            {Object.entries(counts ?? {})
              .map(([k, n]) => `${n} ${k}`)
              .join(" · ")}
          </p>
          <div className="max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-text-2">
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-t border-line">
                    <td className="num px-3 py-1.5">{r.line}</td>
                    <td className="px-3 py-1.5">{r.slug}</td>
                    <td className="px-3 py-1.5">{r.email}</td>
                    <td className={cn("px-3 py-1.5", r.status === "matched" || r.status === "updated" ? "text-success" : "text-text-2")}>
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export type QueueRow = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  status: string;
  canQueue: boolean;
};

/** Unclaimed agencies with checkboxes → "Queue invite". */
export function AgenciesQueue({ rows }: { rows: QueueRow[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { pending, run } = useAction();
  const queueable = rows.filter((r) => r.canQueue);
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primary}
          disabled={!picked.size || pending}
          onClick={() =>
            run(async () => {
              const res = await queueOutreachInvites([...picked]);
              if (res.ok) {
                toast.success(`Queued ${res.data.queued}${res.data.skipped ? `, skipped ${res.data.skipped}` : ""}`);
                setPicked(new Set());
              }
              return res;
            })
          }
        >
          Queue invite{picked.size ? ` (${picked.size})` : ""}
        </button>
        <button type="button" className={btn} disabled={!queueable.length} onClick={() => setPicked(new Set(queueable.map((r) => r.id)))}>
          Select all on this page that can be invited
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="text-[12px] text-text-2">
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-3 py-2">Agency</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    disabled={!r.canQueue}
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Select ${r.name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <a href={`/agency/${r.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.name}
                  </a>
                </td>
                <td className="px-3 py-2 text-text-2">{r.email ?? "None"}</td>
                <td className="px-3 py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
