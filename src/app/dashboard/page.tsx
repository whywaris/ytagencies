import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();
  const [{ data: agencies }, { data: claims }] = await Promise.all([
    supabase.from("agencies").select("id, name, status").eq("owner_id", user.id).order("name"),
    supabase
      .from("claims")
      .select("id, status, work_email, created_at, agencies(name, slug)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  // Most owners manage one listing: skip the list.
  if (agencies?.length === 1 && !claims?.length) redirect(`/dashboard/${agencies[0].id}`);

  return (
    <div className="flex flex-col gap-12">
      <h1 className="text-h1">Your listings</h1>

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
        <div className="flex max-w-reading flex-col gap-2 rounded-lg bg-surface p-6">
          <p className="font-medium">You don&apos;t manage a listing yet.</p>
          <p className="text-text-2">
            Find your agency in the directory and choose &ldquo;Claim this listing&rdquo; on its
            profile. If it isn&apos;t listed, reply to any of our emails and we&apos;ll add it.
          </p>
        </div>
      )}

      {claims && claims.length > 0 && (
        <section aria-labelledby="claims" className="flex flex-col gap-4">
          <h2 id="claims" className="text-h3">
            Open claims
          </h2>
          <ul className="flex flex-col gap-2">
            {claims.map((c) => (
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
