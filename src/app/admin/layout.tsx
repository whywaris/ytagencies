import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { AdminShell, type Queue } from "@/components/admin/shell";
import { SIDEBAR_COOKIE, THEME_COOKIE, parseTheme } from "@/components/admin/shell-prefs";
import { requireAdmin } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

// Inter is scoped to admin (ADMIN_V2_SPEC §2); the public site keeps the system stack.
const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { absolute: `Admin | ${BRAND_NAME}`, template: `%s | Admin | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const db = createAdminClient();
  const oldestFirst = { ascending: true } as const;
  const [store, submissions, claims, reviews] = await Promise.all([
    cookies(),
    db
      .from("agencies")
      .select("created_at", { count: "exact" })
      .eq("status", "draft")
      .not("submitted_by", "is", null)
      .order("created_at", oldestFirst)
      .limit(1),
    // Claims on new submissions are decided in Submissions instead.
    db
      .from("claims")
      .select("created_at, agencies!inner(status)", { count: "exact" })
      .eq("status", "pending")
      .neq("agencies.status", "draft")
      .order("created_at", oldestFirst)
      .limit(1),
    db
      .from("reviews")
      .select("created_at", { count: "exact" })
      .eq("status", "pending")
      .order("created_at", oldestFirst)
      .limit(1),
  ]);

  // Pending work: sidebar badges and the notifications popover. Real counts only.
  const queues: Queue[] = [
    {
      href: "/admin/submissions",
      one: "new agency to review",
      many: "new agencies to review",
      res: submissions,
    },
    { href: "/admin/claims", one: "claim to review", many: "claims to review", res: claims },
    {
      href: "/admin/reviews",
      one: "review to moderate",
      many: "reviews to moderate",
      res: reviews,
    },
  ].map(({ res, ...q }) => ({
    ...q,
    count: res.count ?? 0,
    oldest: res.data?.[0]?.created_at ?? null,
  }));

  const theme = parseTheme(store.get(THEME_COOKIE)?.value);
  return (
    <div
      data-admin=""
      data-theme={theme === "system" ? undefined : theme}
      className={cn(inter.className, "min-h-dvh bg-bg text-text")}
    >
      <AdminShell
        email={user.email ?? ""}
        queues={queues}
        initialTheme={theme}
        initialCollapsed={store.get(SIDEBAR_COOKIE)?.value === "1"}
      >
        {children}
      </AdminShell>
    </div>
  );
}
