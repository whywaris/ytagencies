"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setWorkSampleHidden } from "@/lib/actions/admin-directory";

/** Admin → Agency → Work samples: hide a sample from the profile, or show it again. */
export function WorkSampleModeration({
  id,
  title,
  hidden,
}: {
  id: string;
  title: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setWorkSampleHidden(id, !hidden);
          if (!res.ok) alert(res.error);
          router.refresh();
        })
      }
      className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2 disabled:opacity-50"
    >
      {pending ? "Saving…" : hidden ? "Show" : "Hide"}
      <span className="sr-only"> “{title}”</span>
    </button>
  );
}
