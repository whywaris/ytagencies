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
  const [store, messages] = await Promise.all([
    cookies(),
    db
      .from("contact_messages")
      .select("created_at", { count: "exact" })
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  // Pending work: the sidebar badge and the notifications popover. Real counts only.
  const queues: Queue[] = [
    {
      href: "/admin/inbox",
      one: "message to answer",
      many: "messages to answer",
      count: messages.count ?? 0,
      oldest: messages.data?.[0]?.created_at ?? null,
    },
  ];

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
