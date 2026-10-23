"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { refreshSitemap } from "@/lib/actions/admin-sitemap";

// Admin → Settings: refresh /sitemap.xml, its child sitemaps and /llms.txt now, and show how many
// URLs each child sitemap lists (indexable pages only, docs/SEO.md).
export function RefreshSitemap({ initial }: { initial: Record<string, number> }) {
  const [counts, setCounts] = useState(initial);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full max-w-[360px] text-[14px]">
        <caption className="sr-only">URLs per child sitemap</caption>
        <tbody>
          {Object.entries(counts).map(([file, n]) => (
            <tr key={file} className="border-b border-line-2">
              <th scope="row" className="py-1.5 text-left font-normal">
                <a href={`/sitemaps/${file}.xml`} className="text-accent hover:underline">
                  {file}.xml
                </a>
              </th>
              <td className="py-1.5 text-right tabular-nums">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await refreshSitemap();
              if (res.ok) setCounts(res.data);
              setStatus(
                res.ok
                  ? { ok: true, message: "Sitemap refreshed." }
                  : { ok: false, message: res.error },
              );
            })
          }
        >
          {pending ? "Refreshing…" : "Refresh sitemap"}
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
  );
}
