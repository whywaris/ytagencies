"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  removeAuthorPhoto,
  saveAuthor,
  uploadAuthorPhoto,
  type AuthorInput,
} from "@/lib/actions/admin-authors";
import { cn } from "@/lib/utils";

export type EditorAuthor = AuthorInput & {
  id: string | null;
  avatarPath: string | null;
  /** Has live guides: its page is public, so a slug change breaks old links. */
  live: boolean;
};

const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-media/`;
const input = "h-9 w-full rounded-lg border border-line bg-bg px-3";
const secondary =
  "h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Create or edit a guide author (admin → Authors). */
export function AuthorForm({ author }: { author: EditorAuthor }) {
  const router = useRouter();
  const [values, setValues] = useState<AuthorInput>({
    name: author.name,
    slug: author.slug,
    role: author.role,
    bio: author.bio,
    linkedinUrl: author.linkedinUrl,
    xUrl: author.xUrl,
    websiteUrl: author.websiteUrl,
  });
  // New authors: the slug follows the name until it's edited by hand.
  const [slugTouched, setSlugTouched] = useState(author.id !== null);
  const [avatarPath, setAvatarPath] = useState(author.avatarPath);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  const set = (k: keyof AuthorInput, v: string) =>
    setValues((s) => ({
      ...s,
      [k]: v,
      ...(k === "name" && !slugTouched ? { slug: slugify(v) } : {}),
    }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveAuthor(author.id, values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setErrors({});
      toast.success(author.id ? "Author saved" : "Author created");
      if (author.id) router.refresh();
      else router.replace(`/admin/authors/${res.data.id}`);
    });
  };

  const onFile = (f: File | undefined) => {
    if (!f || !author.id) return;
    const id = author.id;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("image", f);
      const res = await uploadAuthorPhoto(id, fd);
      if (!res.ok) return void toast.error(res.error);
      setAvatarPath(res.data.path);
      toast.success("Photo updated");
    });
    if (file.current) file.current.value = "";
  };

  const removePhoto = () => {
    if (!author.id) return;
    const id = author.id;
    startTransition(async () => {
      const res = await removeAuthorPhoto(id);
      if (!res.ok) return void toast.error(res.error);
      setAvatarPath(null);
    });
  };

  const field = (
    k: keyof AuthorInput,
    label: string,
    opts: { hint?: string; placeholder?: string; max?: number; type?: string } = {},
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      <input
        type={opts.type ?? "text"}
        value={values[k]}
        onChange={(e) => {
          if (k === "slug") setSlugTouched(true);
          set(k, e.target.value);
        }}
        maxLength={opts.max}
        placeholder={opts.placeholder}
        aria-invalid={!!errors[k]}
        className={input}
      />
      {(errors[k] || opts.hint) && (
        <span className={cn("text-admin-meta", errors[k] && "text-destructive")}>
          {errors[k] ?? opts.hint}
        </span>
      )}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex max-w-xl flex-col gap-5">
        {field("name", "Name", { max: 100 })}
        {field("slug", "URL", {
          max: 80,
          hint: author.live
            ? `/authors/${values.slug}. This page is live: changing it breaks links to the old URL.`
            : `/authors/${values.slug || "name"}`,
        })}
        {field("role", "Role", { max: 100, placeholder: "e.g. YouTube ads consultant" })}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-medium">Bio</span>
            <span
              className={cn("text-admin-meta num", values.bio.length > 300 && "text-destructive")}
            >
              {values.bio.length} / 300
            </span>
          </span>
          <textarea
            value={values.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={300}
            rows={4}
            aria-invalid={!!errors.bio}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2"
          />
          <span className={cn("text-admin-meta", errors.bio && "text-destructive")}>
            {errors.bio ?? "Plain text. Shown on the author page and under each guide."}
          </span>
        </label>
        {field("linkedinUrl", "LinkedIn", {
          type: "url",
          placeholder: "https://www.linkedin.com/in/…",
        })}
        {field("xUrl", "X", { type: "url", placeholder: "https://x.com/…" })}
        {field("websiteUrl", "Website", { type: "url", placeholder: "https://…" })}
        <button
          type="submit"
          disabled={pending}
          className="h-9 self-start rounded-lg bg-accent px-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : author.id ? "Save author" : "Create author"}
        </button>
      </div>

      <section aria-label="Photo" className="flex flex-col gap-3">
        <p className="font-medium">Photo</p>
        <span className="relative flex size-24 items-center justify-center overflow-hidden rounded-full bg-surface text-text-2">
          {avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an upload
            <img src={STORAGE + avatarPath} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-admin-meta">No photo</span>
          )}
        </span>
        {author.id ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => file.current?.click()}
              className={secondary}
            >
              {avatarPath ? "Replace" : "Upload photo"}
            </button>
            {avatarPath && (
              <button type="button" disabled={pending} onClick={removePhoto} className={secondary}>
                Remove
              </button>
            )}
          </div>
        ) : (
          <p className="text-admin-meta">Create the author first, then add a photo.</p>
        )}
        <p className="text-admin-meta">Square, at least 256 × 256. PNG, JPG or WebP under 2 MB.</p>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </section>
    </form>
  );
}
