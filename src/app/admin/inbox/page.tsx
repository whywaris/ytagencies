import Link from "next/link";

import { Empty, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { INBOX_TOPICS, topicOf } from "@/lib/contact-topics";
import { formatCount, formatRelative } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inbox" };

const STATUSES = [
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
] as const;

export default async function AdminInboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  await requireAdmin("/admin/inbox");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s.id === sp.status)?.id ?? "open";
  const topic = INBOX_TOPICS.find((t) => t.id === sp.topic)?.id ?? "";

  const db = createAdminClient();
  let query = db
    .from("contact_messages")
    .select("id, topic, name, email, message, status, created_at")
    .order("created_at", { ascending: status === "open" }) // open: oldest first, like the queues
    .limit(200); // ponytail: no paging; add it past a few hundred messages
  if (status !== "all") query = query.eq("status", status);
  if (topic) query = query.eq("topic", topic);
  const [{ data, error }, ...counts] = await Promise.all([
    query,
    ...STATUSES.map((s) => {
      let q = db.from("contact_messages").select("id", { count: "exact", head: true });
      if (s.id !== "all") q = q.eq("status", s.id);
      if (topic) q = q.eq("topic", topic);
      return q;
    }),
  ]);
  if (error) throw new Error("Couldn't load messages");

  const href = (next: { status?: string; topic?: string }) => {
    const p = new URLSearchParams(
      Object.entries({ status, topic, ...next }).filter(
        ([k, v]) => v && !(k === "status" && v === "open"),
      ),
    );
    return p.size ? `/admin/inbox?${p}` : "/admin/inbox";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-admin-title">Inbox</h1>
        <p className="text-text-2">
          Messages from the contact form. Reply by email, then close them.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line">
        <nav aria-label="Filter by status" className="flex gap-1">
          {STATUSES.map((s, i) => (
            <Link
              key={s.id}
              href={href({ status: s.id })}
              aria-current={s.id === status ? "page" : undefined}
              className="-mb-px flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-text-2 transition-colors duration-150 hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
            >
              {s.label}
              <span className="text-[12px] text-text-2 num">
                {formatCount(counts[i].count ?? 0)}
              </span>
            </Link>
          ))}
        </nav>
        <nav aria-label="Filter by topic" className="flex flex-wrap gap-1 pb-2">
          {[{ id: "", label: "All topics" }, ...INBOX_TOPICS].map((t) => (
            <Link
              key={t.id || "all"}
              href={href({ topic: t.id })}
              aria-current={t.id === topic ? "page" : undefined}
              className={cn(
                "flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors duration-150",
                t.id === topic ? "bg-surface-2 text-text" : "text-text-2 hover:text-text",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {data.length === 0 ? (
        <Empty>
          {status === "open" ? "No open messages. You're all caught up." : "No messages here."}
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">Topic</th>
              <th scope="col">Message</th>
              <th scope="col">Received</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.id}>
                <td className="min-w-48">
                  <Link href={`/admin/inbox/${m.id}`} className="font-medium hover:underline">
                    {m.name}
                  </Link>
                  <div className="text-admin-meta">{m.email}</div>
                </td>
                <td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {m.status === "open" && (
                      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                    )}
                    {topicOf(m.topic).label}
                    {m.status === "closed" && <span className="text-text-2"> (closed)</span>}
                  </span>
                </td>
                <td className="max-w-md">
                  <span className="line-clamp-1 text-text-2">{m.message}</span>
                </td>
                <td className="whitespace-nowrap text-text-2 num">
                  {formatRelative(m.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
