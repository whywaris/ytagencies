import { notFound } from "next/navigation";

import { InboxActions } from "@/components/admin/inbox-actions";
import { DetailList } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { topicOf } from "@/lib/contact-topics";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Message" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InboxMessagePage({ params }: PageProps<"/admin/inbox/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/inbox/${id}`);
  if (!UUID.test(id)) notFound();
  const { data: m } = await createAdminClient()
    .from("contact_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();
  const topic = topicOf(m.topic);
  const reply = `mailto:${m.email}?subject=${encodeURIComponent(`Re: your message to us (${topic.label.toLowerCase()})`)}`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-admin-title">{topic.label}</h1>
          <p className="text-text-2">
            From {m.name}, {m.status === "open" ? "open" : "closed"}
          </p>
        </div>
        <InboxActions id={m.id} name={m.name} status={m.status === "closed" ? "closed" : "open"} />
      </div>

      <DetailList
        rows={[
          ["From", m.name],
          [
            "Email",
            <a key="email" href={reply} className="text-accent hover:underline">
              {m.email}
            </a>,
          ],
          [
            "Received",
            <span key="at" className="num">
              {formatDateTime(m.created_at)}
            </span>,
          ],
          ...(m.agency_url
            ? ([
                [
                  "Listing",
                  <a
                    key="listing"
                    href={m.agency_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-accent hover:underline"
                  >
                    {m.agency_url}
                  </a>,
                ],
              ] as [string, React.ReactNode][])
            : []),
          ...(m.closed_at
            ? ([
                [
                  "Closed",
                  <span key="closed" className="num">
                    {formatDateTime(m.closed_at)}
                  </span>,
                ],
              ] as [string, React.ReactNode][])
            : []),
        ]}
      />

      <section aria-label="Message" className="rounded-xl border border-line p-5">
        <p className="whitespace-pre-wrap">{m.message}</p>
      </section>

      <a
        href={reply}
        className="h-9 self-start rounded-lg border border-line px-3 leading-9 font-medium transition-colors duration-150 hover:bg-surface-2"
      >
        Reply by email
      </a>
    </div>
  );
}
