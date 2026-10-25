"use server";

import { after } from "next/server";

import { ContactAdminEmail, ContactConfirmationEmail } from "@/emails/contact";
import { topicOf } from "@/lib/contact-topics";
import { getMailer, oneLine } from "@/lib/email";
import { clientIp, rateLimitRetryAt, underRateLimit } from "@/lib/forms/guard";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactSchema } from "@/lib/validation/contact";
import type { FormResult } from "@/lib/validation/lead";

// /contact. Order (SECURITY.md): honeypot → Zod → rate limit → write. The message is
// saved first (Admin → Inbox), then emailed to the topic's inbox, with a short confirmation to the
// sender. Emails go out after the response; a mail failure never loses the message.

const GENERIC_ERROR = "Something went wrong on our side. Please try again in a minute.";

export async function submitContact(raw: unknown): Promise<FormResult> {
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website) {
    return { ok: true, data: undefined };
  }
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const ip = await clientIp();
  if (!(await underRateLimit(ip, input.email))) {
    const at = await rateLimitRetryAt(ip, input.email);
    const minutes = at ? Math.max(1, Math.ceil((at.getTime() - Date.now()) / 60_000)) : 60;
    return {
      ok: false,
      error: `You've sent several messages in the last hour. You can send another in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const topic = topicOf(input.topic);
  const agencyUrl = input.topic === "report" ? input.agencyUrl || null : null;
  const { data, error } = await createAdminClient()
    .from("contact_messages")
    .insert({
      topic: topic.id,
      name: input.name,
      email: input.email,
      message: input.message,
      agency_url: agencyUrl,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("contact message insert failed", { code: error?.code }); // no payload in logs
    return { ok: false, error: GENERIC_ERROR };
  }

  const mail = getMailer();
  if (mail) {
    after(async () => {
      const results = await Promise.all([
        mail.send({
          from: mail.from,
          to: topic.inbox,
          replyTo: input.email,
          subject: oneLine(`${topic.label}: ${input.name}`),
          react: (
            <ContactAdminEmail
              topic={topic.label}
              name={input.name}
              email={input.email}
              message={input.message}
              agencyUrl={agencyUrl}
              inboxUrl={absoluteUrl(`/admin/inbox/${data.id}`)}
            />
          ),
        }),
        mail.send({
          from: mail.from,
          to: input.email,
          subject: "We've received your message",
          react: <ContactConfirmationEmail topic={topic.label} response={topic.response} />,
        }),
      ]);
      if (results.some((r) => r.error)) console.error("contact emails failed", { id: data.id });
    });
  }
  return { ok: true, data: undefined };
}
