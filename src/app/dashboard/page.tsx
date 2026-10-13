import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const status = (await searchParams).status;
  const user = await requireUser("/dashboard");
  const supabase = await createClient();
  const [{ data: agencies }, { data: claims }, { data: submissions }] = await Promise.all([
    supabase.from("agencies").select("id, name, status").eq("owner_id", user.id).order("name"),
    supabase
      .from("claims")
      .select("id, status, work_email, created_at, agencies(id, name, slug)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    // Agencies they added via /list-your-agency that they don't own yet (owned ones are above).
    supabase
      .from("agencies")
      .select("id, name")
      .eq("submitted_by", user.id)
      .eq("status", "draft")
      .is("owner_id", null)
      .order("created_at", { ascending: false }),
  ]);
  // A submission's own claim is covered by "Waiting for review".
  const submittedIds = new Set(submissions?.map((s) => s.id));
  const openClaims = claims?.filter((c) => !submittedIds.has(c.agencies?.id ?? "")) ?? [];

  // Most owners manage one listing: skip the list.
  if (agencies?.length === 1 && !openClaims.length && !submissions?.length && !status)
    redirect(`/dashboard/${agencies[0].id}`);

  return (
    <div className="flex flex-col gap-12">
      <h1 className="text-h1">Your listings</h1>
      {status === "subscribed" && (
        <p role="status" className="max-w-reading rounded-lg bg-surface p-4">
          Payment received. Pro starts as soon as we approve your listing; we&apos;ll email you.
        </p>
      )}
      {status === "checkout-failed" && (
        <p
          role="alert"
          className="max-w-reading rounded-lg border border-destructive p-4 text-destructive"
        >
          We couldn&apos;t open the payment page. Your listing was submitted; you can subscribe once
          it&apos;s approved.
        </p>
      )}

      {agencies && agencies.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {agencies.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/${a.id}`}
                className="flex min-h-11 items-center justify-between rounded-lg border border-line px-5 py-4 transition-colors duration-150 hover:border-text-2"
              >
                <span className="font-medium">{a.name}</span>
                {a.status !== "published" && <span className="text-small">{a.status}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex max-w-reading flex-col gap-4 rounded-lg bg-surface p-6">
          <div className="flex flex-col gap-2">
            <p className="font-medium">You don&apos;t manage a listing yet.</p>
            <p className="text-text-2">
              If your agency is already listed, claim it. If not, add it and we&apos;ll review it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild>
              <Link href="/list-your-agency">Find and claim your agency</Link>
            </Button>
            <Button asChild variant="link">
              <Link href="/list-your-agency/new">Add your agency</Link>
            </Button>
          </div>
        </div>
      )}

      {submissions && submissions.length > 0 && (
        <section aria-labelledby="submissions" className="flex flex-col gap-4">
          <h2 id="submissions" className="text-h3">
            Waiting for review
          </h2>
          <ul className="flex flex-col gap-2">
            {submissions.map((s) => (
              <li key={s.id} className="text-text-2">
                {s.name} · we&apos;ll email you when it&apos;s published
              </li>
            ))}
          </ul>
        </section>
      )}

      {openClaims.length > 0 && (
        <section aria-labelledby="claims" className="flex flex-col gap-4">
          <h2 id="claims" className="text-h3">
            Open claims
          </h2>
          <ul className="flex flex-col gap-2">
            {openClaims.map((c) => (
              <li key={c.id} className="text-text-2">
                {c.agencies?.name} · {c.work_email} · waiting for email confirmation or our review
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
