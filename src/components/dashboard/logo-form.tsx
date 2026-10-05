"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { AgencyLogo } from "@/components/agency-logo";
import { Button } from "@/components/ui/button";
import { uploadLogo } from "@/lib/actions/dashboard";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

// Client checks are for quick feedback only; the server re-checks size and the real file type.
export function LogoForm({
  agencyId,
  name,
  logoPath,
}: {
  agencyId: string;
  name: string;
  logoPath: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return setStatus({ ok: false, message: "Choose an image to upload." });
    if (file.size > MAX_BYTES) return setStatus({ ok: false, message: "Use an image under 2 MB." });
    const data = new FormData();
    data.set("logo", file);
    startTransition(async () => {
      const res = await uploadLogo(agencyId, data);
      setStatus(
        res.ok ? { ok: true, message: "Logo updated." } : { ok: false, message: res.error },
      );
      if (res.ok) {
        if (input.current) input.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <AgencyLogo name={name} logoPath={logoPath} size="lg" />
      <div className="flex flex-col gap-3">
        <label htmlFor="logo-file" className="text-[14px] font-medium">
          Logo{" "}
          <span className="font-normal text-text-2">
            (PNG, JPG or WebP, up to 2 MB, square works best)
          </span>
        </label>
        <input
          ref={input}
          id="logo-file"
          type="file"
          accept={ACCEPT}
          className="text-small file:mr-4 file:h-11 file:cursor-pointer file:rounded-full file:border file:border-line file:bg-bg file:px-5 file:font-medium file:text-text"
        />
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Upload logo"}
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
      </div>
    </form>
  );
}
