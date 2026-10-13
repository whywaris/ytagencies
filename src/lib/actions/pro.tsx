"use server";

import { after } from "next/server";

import { ContactAdminEmail, ContactConfirmationEmail } from "@/emails/contact";
import { PRO_TOPIC } from "@/lib/contact-topics";
import { getMailer, oneLine } from "@/lib/email";
import { clientIp, rateLimitRetryAt, underRateLimit, verifyTurnstile } from "@/lib/forms/guard";
import { absoluteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormResult } from "@/lib/validation/lead";
import { proRequestSchema } from "@/lib/validation/pro";

// "Request Pro" while PAYMENTS_ENABLED is off. Same path as /contact (lib/actions/contact.tsx):
// honeypot → Zod → Turnstile → rate limit → saved to Admin → Inbox (topic "pro") → emailed to
// help@. The admin grants Pro by hand (Change plan, source manual).

const GENERIC_ERROR = "Something went wrong on our side. Please try again in a minute.";

export async function requestPro(raw: unknown): Promise<FormResult> {
  if (typeof raw === "object" && raw !== null && "website" in raw && raw.website) {
    return { ok: true, data: undefined };
  }
  const parsed = proRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const ip = await clientIp();
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return {
      ok: false,
      error: "The security check didn't pass. Please try it again.",
      fieldErrors: { turnstileToken: "Complete the security check again." },
    };
  }
  if (!(await underRateLimit(ip, input.email))) {
    const at = await rateLimitRetryAt(ip, input.email);
    const minutes = at ? Math.max(1, Math.ceil((at.getTime() - Date.now()) / 60_000)) : 60;
    return {
      ok: false,
      error: `You've sent several requests in the last hour. You can send another in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const message = `Agency: ${input.agency}\nBilling: ${input.period}`;
  const { data, error } = await createAdminClient()
    .from("contact_messages")
    .insert({ topic: PRO_TOPIC.id, name: input.name, email: input.email, message })
    .select("id")
    .single();
  if (error || !data) {
    console.error("pro request insert failed", { code: error?.code }); // no payload in logs
    return { ok: false, error: GENERIC_ERROR };
  }

  const mail = getMailer();
  if (mail) {
    after(async () => {
      const results = await Promise.all([
        mail.send({
          from: mail.from,
          to: PRO_TOPIC.inbox,
          replyTo: input.email,
          subject: oneLine(`${PRO_TOPIC.label}: ${input.name}`),
          react: (
            <ContactAdminEmail
              topic={PRO_TOPIC.label}
              name={input.name}
              email={input.email}
              message={message}
              agencyUrl={null}
              inboxUrl={absoluteUrl(`/admin/inbox/${data.id}`)}
            />
          ),
        }),
        mail.send({
          from: mail.from,
          to: input.email,
          subject: "We've received your Pro request",
          react: <ContactConfirmationEmail topic={PRO_TOPIC.label} response={PRO_TOPIC.response} />,
        }),
      ]);
      if (results.some((r) => r.error)) console.error("pro request emails failed", { id: data.id });
    });
  }
  return { ok: true, data: undefined };
}
