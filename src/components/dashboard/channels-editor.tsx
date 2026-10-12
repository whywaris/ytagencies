"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { selectClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addChannel, removeChannel, updateChannel } from "@/lib/actions/dashboard";
import { cn } from "@/lib/utils";

type Option = { slug: string; name: string };
export type ChannelRow = {
  id: string;
  url: string;
  title: string | null;
  subscribers: number | null;
  industry: string;
  confirmed: boolean;
};

const MAX = 6;
const subscribers = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Dashboard → Channels: up to 6 YouTube channels the agency worked on. "Confirmed by client" is
 * set by us after the client confirms; owners only add, edit and remove the links.
 */
export function ChannelsEditor({
  agencyId,
  channels,
  industries,
}: {
  agencyId: string;
  channels: ChannelRow[];
  industries: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [industry, setIndustry] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong.");
      after?.();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {channels.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {channels.map((c) => (
            <ChannelItem
              key={c.id}
              channel={c}
              industries={industries}
              pending={pending}
              onSave={(next) => run(() => updateChannel(agencyId, c.id, next))}
              onRemove={() => {
                if (window.confirm("Remove this channel from your profile?"))
                  run(() => removeChannel(agencyId, c.id));
              }}
            />
          ))}
        </ul>
      )}

      {channels.length < MAX ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addChannel(agencyId, { url, industry }),
              () => {
                setUrl("");
                setIndustry("");
              },
            );
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-[14px] font-medium">
            Channel link
            <Input
              type="url"
              required
              placeholder="https://www.youtube.com/@client"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[14px] font-medium sm:w-56">
            Client industry
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className={selectClasses}
            >
              <option value="">Not set</option>
              {industries.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add channel"}
          </Button>
        </form>
      ) : (
        <p className="text-small">You&apos;ve listed {MAX} channels, the most a profile shows.</p>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ChannelItem({
  channel: c,
  industries,
  pending,
  onSave,
  onRemove,
}: {
  channel: ChannelRow;
  industries: Option[];
  pending: boolean;
  onSave: (next: { url: string; industry: string }) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(c.url);
  const [industry, setIndustry] = useState(c.industry);
  const industryName = industries.find((i) => i.slug === c.industry)?.name;

  if (editing)
    return (
      <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-[14px] font-medium">
          Channel link
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[14px] font-medium sm:w-56">
          Client industry
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={selectClasses}
          >
            <option value="">Not set</option>
            {industries.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              onSave({ url, industry });
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button type="button" variant="link" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </li>
    );

  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-medium hover:underline"
        >
          {c.title ?? c.url}
        </a>
        <p className="text-small">
          {[
            c.subscribers !== null && `${subscribers.format(c.subscribers)} subscribers`,
            industryName,
          ]
            .filter(Boolean)
            .join(" · ") || "Channel details appear once we've looked it up."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[12.5px] font-medium",
            c.confirmed ? "bg-(--mint-soft) text-(--mint)" : "bg-surface text-text-2",
          )}
        >
          {c.confirmed ? "Confirmed by client" : "Listed by you"}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 text-accent hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onRemove}
          className="min-h-11 text-destructive hover:underline"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
