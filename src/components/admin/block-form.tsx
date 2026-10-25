"use client";

import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { BlockAttrs, Field } from "@/lib/guide-blocks";
import { cn } from "@/lib/utils";

// The form for a guide block, built from its field list (lib/guide-blocks.ts). The server cleans
// every value again on save (sanitizeBlock), so this only helps people get it right.

export type FormContext = {
  /** Sections of this guide a comparison row can link to. */
  anchors: { id: string; label: string }[];
  services: { slug: string; name: string }[];
  /** Uploads an image to guide media; null when it couldn't. */
  upload: (file: File) => Promise<string | null>;
};

const input = "h-9 w-full rounded-lg border border-line bg-bg px-3";
const small =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-40";
const icon = "size-4 [stroke-width:1.5]";

type Value = Record<string, unknown>;

export function BlockForm({
  fields,
  value,
  onChange,
  context,
}: {
  fields: Field[];
  value: BlockAttrs;
  onChange: (v: BlockAttrs) => void;
  context: FormContext;
}) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={value[f.key]}
          onChange={(v) => onChange({ ...value, [f.key]: v })}
          context={context}
        />
      ))}
    </div>
  );
}

function FieldInput({
  field: f,
  value,
  onChange,
  context,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  context: FormContext;
}) {
  const id = useId();
  const str = typeof value === "string" ? value : "";
  const label = (
    <label htmlFor={id} className="font-medium">
      {f.label}
    </label>
  );
  switch (f.kind) {
    case "text":
    case "internalUrl":
    case "externalUrl": {
      const max = f.kind === "text" ? f.max : f.kind === "externalUrl" ? 500 : 300;
      const bad =
        str &&
        ((f.kind === "internalUrl" && !/^\/(?!\/)/.test(str)) ||
          (f.kind === "externalUrl" && !/^https?:\/\//i.test(str)));
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <input
            id={id}
            value={str}
            maxLength={max}
            onChange={(e) => onChange(e.target.value)}
            placeholder={"placeholder" in f ? f.placeholder : undefined}
            aria-invalid={bad || undefined}
            inputMode={f.kind === "text" ? undefined : "url"}
            className={cn(input, bad && "border-destructive")}
          />
          {bad && (
            <span className="text-admin-meta text-destructive">
              {f.kind === "internalUrl"
                ? "Use a path on this site, like /agencies."
                : "Use a full link starting with https://"}
            </span>
          )}
          {"hint" in f && f.hint && <span className="text-admin-meta">{f.hint}</span>}
        </div>
      );
    }
    case "textarea":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <textarea
            id={id}
            value={str}
            maxLength={f.max}
            rows={4}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2"
          />
          {f.hint && <span className="text-admin-meta">{f.hint}</span>}
        </div>
      );
    case "boolean":
      return (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1 size-4 accent-(--accent)"
          />
          <span className="flex flex-col">
            <span className="font-medium">{f.label}</span>
            {f.hint && <span className="text-admin-meta">{f.hint}</span>}
          </span>
        </label>
      );
    case "select":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <select id={id} value={str || f.options[0].value} onChange={(e) => onChange(e.target.value)} className={input}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "anchor":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <select id={id} value={str} onChange={(e) => onChange(e.target.value)} className={input}>
            <option value="">No link</option>
            {str && !context.anchors.some((a) => a.id === str) && <option value={str}>#{str} (not found)</option>}
            {context.anchors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "service":
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <select id={id} value={str} onChange={(e) => onChange(e.target.value)} className={input}>
            <option value="">Every service (no service count)</option>
            {context.services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      );
    case "image":
      return <ImageInput id={id} label={f.label} value={str} onChange={onChange} upload={context.upload} />;
    case "list": {
      const items = Array.isArray(value) ? value.map((x) => (typeof x === "string" ? x : "")) : [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{f.label}</legend>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                aria-label={`${f.label} ${i + 1}`}
                value={item}
                maxLength={f.itemMax}
                onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
                className={input}
              />
              <RowButtons i={i} count={items.length} list={items} onChange={onChange} name={`${f.label} ${i + 1}`} />
            </div>
          ))}
          {items.length < f.max && (
            <button type="button" onClick={() => onChange([...items, ""])} className="flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-accent hover:bg-surface-2">
              <Plus className={icon} aria-hidden />
              Add a line
            </button>
          )}
        </fieldset>
      );
    }
    case "rows": {
      const list = Array.isArray(value)
        ? value.filter((r): r is Value => !!r && typeof r === "object")
        : [];
      const blank = () => Object.fromEntries(f.fields.map((s) => [s.key, s.kind === "boolean" ? false : s.kind === "select" ? s.options[0].value : ""]));
      return (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium">{f.label}</legend>
          {list.map((row, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-admin-meta num">#{i + 1}</span>
                <span className="flex">
                  <RowButtons i={i} count={list.length} list={list} onChange={onChange} name={`row ${i + 1}`} />
                </span>
              </div>
              <BlockForm fields={f.fields} value={row} onChange={(v) => onChange(list.map((r, k) => (k === i ? v : r)))} context={context} />
            </div>
          ))}
          {list.length < f.max && (
            <button type="button" onClick={() => onChange([...list, blank()])} className="flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-accent hover:bg-surface-2">
              <Plus className={icon} aria-hidden />
              {f.addLabel}
            </button>
          )}
        </fieldset>
      );
    }
  }
}

function RowButtons<T>({
  i,
  count,
  list,
  onChange,
  name,
}: {
  i: number;
  count: number;
  list: T[];
  onChange: (v: T[]) => void;
  name: string;
}) {
  const move = (to: number) => {
    const next = [...list];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };
  return (
    <>
      <button type="button" className={small} disabled={i === 0} onClick={() => move(i - 1)} aria-label={`Move ${name} up`}>
        <ArrowUp className={icon} aria-hidden />
      </button>
      <button type="button" className={small} disabled={i === count - 1} onClick={() => move(i + 1)} aria-label={`Move ${name} down`}>
        <ArrowDown className={icon} aria-hidden />
      </button>
      <button type="button" className={small} onClick={() => onChange(list.filter((_, k) => k !== i))} aria-label={`Remove ${name}`}>
        <Trash2 className={icon} aria-hidden />
      </button>
    </>
  );
}

function ImageInput({
  id,
  label,
  value,
  onChange,
  upload,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  upload: (file: File) => Promise<string | null>;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="font-medium">
        {label}
      </span>
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-labelledby={id}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          const url = await upload(f);
          setBusy(false);
          if (url) onChange(url);
        }}
      />
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of the upload
        <img src={value} alt="" className="max-h-40 w-full rounded-lg border border-line object-contain" />
      )}
      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={() => file.current?.click()} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-accent hover:bg-surface-2 disabled:opacity-50">
          <ImagePlus className={icon} aria-hidden />
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-text-2 hover:text-text hover:underline">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
