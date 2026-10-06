"use client";

import {
  ArrowUpRight,
  Bell,
  Building2,
  ChevronRight,
  FolderTree,
  Inbox,
  KeyRound,
  Menu,
  Monitor,
  Moon,
  PanelLeft,
  Search,
  Star,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Dialog, DropdownMenu, Popover, Tooltip } from "radix-ui";
import { Toaster } from "sonner";

import { CommandPalette } from "@/components/admin/command-palette";
import { PortalContext, usePortalContainer } from "@/components/admin/portal";
import {
  SIDEBAR_COOKIE,
  THEME_COOKIE,
  setPrefCookie,
  type Theme,
} from "@/components/admin/shell-prefs";
import { signOut } from "@/lib/actions/auth";
import { formatCount, formatDateTime, formatRelative } from "@/lib/format";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

/** `one`/`many` read as "1 claim to review", "3 reviews to moderate". */
export type Queue = {
  href: string;
  one: string;
  many: string;
  count: number;
  oldest: string | null;
};

type Item = { href: string; label: string; icon: LucideIcon; external?: boolean };

// Only pages that exist. Later phases add Dashboard, Verification, SEO pages, Plans, Sponsored,
// Guides and Settings here as they're built (ADMIN_V2_SPEC §4, §10).
const GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Directory",
    items: [
      { href: "/admin/agencies", label: "Agencies", icon: Building2 },
      { href: "/admin/submissions", label: "Submissions", icon: Inbox },
      { href: "/admin/claims", label: "Claims", icon: KeyRound },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  { heading: "Growth", items: [{ href: "/admin/leads", label: "Leads", icon: Users }] },
  { heading: "Content", items: [{ href: "/admin/taxonomy", label: "Taxonomy", icon: FolderTree }] },
];
const VIEW_SITE: Item = { href: "/", label: "View site", icon: ArrowUpRight, external: true };

const noSubscribe = () => () => {};

const icon = "size-4 shrink-0 text-text-2 [stroke-width:1.5]";
const iconButton =
  "flex size-9 items-center justify-center rounded-lg text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text";
const floating =
  "z-50 rounded-xl outline-none border border-line bg-bg p-1 text-text shadow-lg duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]";
const menuRow =
  "flex h-8 cursor-default items-center gap-2 rounded-md px-2 outline-none select-none data-[highlighted]:bg-surface-2";

export function AdminShell({
  email,
  queues,
  initialTheme,
  initialCollapsed,
  children,
}: {
  email: string;
  queues: Queue[];
  initialTheme: Theme;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [theme, setTheme] = useState(initialTheme);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const pathname = usePathname();
  const counts = Object.fromEntries(queues.map((q) => [q.href, q.count]));

  // ⌘K on Apple devices, Ctrl K elsewhere. The server can't know, so it renders "Ctrl K".
  const shortcut = useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );

  const toggleCollapsed = () => {
    setPrefCookie(SIDEBAR_COOKIE, collapsed ? null : "1");
    setCollapsed(!collapsed);
  };
  const changeTheme = (t: Theme) => {
    setTheme(t);
    setPrefCookie(THEME_COOKIE, t === "system" ? null : t);
    const root = document.querySelector<HTMLElement>("[data-admin]");
    if (root) {
      if (t === "system") delete root.dataset.theme;
      else root.dataset.theme = t;
    }
  };

  return (
    <PortalContext.Provider value={portal}>
      <Tooltip.Provider delayDuration={300}>
        <div className="flex min-h-dvh">
          <aside
            className={cn(
              "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line transition-[width] duration-200 ease-out min-[900px]:flex",
              collapsed ? "w-16" : "w-62",
            )}
          >
            <SidebarContent
              collapsed={collapsed}
              counts={counts}
              pathname={pathname}
              onToggle={toggleCollapsed}
            />
          </aside>

          <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
            <Dialog.Portal container={portal ?? undefined}>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 min-[900px]:hidden" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-bg text-text shadow-lg outline-none min-[900px]:hidden">
                <Dialog.Title className="sr-only">Admin navigation</Dialog.Title>
                {/* Close the sheet when a link inside it is followed. */}
                <div
                  className="flex min-h-0 flex-1 flex-col"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) setSheetOpen(false);
                  }}
                >
                  <SidebarContent collapsed={false} counts={counts} pathname={pathname} touch />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg px-4 md:px-6">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="Open navigation"
                className={cn(iconButton, "-ml-2 size-11 min-[900px]:hidden")}
              >
                <Menu className={icon} aria-hidden />
              </button>
              <Breadcrumbs pathname={pathname} />
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="mr-1 hidden h-9 w-56 items-center gap-2 rounded-lg border border-line px-3 text-text-2 transition-colors duration-150 hover:border-text-2 md:flex"
                >
                  <Search className={icon} aria-hidden />
                  Search
                  <kbd className="ml-auto font-sans text-[12px] text-text-2">{shortcut}</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search"
                  className={cn(iconButton, "md:hidden")}
                >
                  <Search className={icon} aria-hidden />
                </button>
                <ThemeMenu theme={theme} onChange={changeTheme} />
                <Notifications queues={queues} />
                <ProfileMenu email={email} />
              </div>
            </header>
            <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <Toaster
          theme={theme}
          position="bottom-right"
          toastOptions={{
            className: "!rounded-xl !border-line !bg-bg !text-text !text-[14px] !font-[inherit]",
          }}
        />
        <div ref={setPortal} />
      </Tooltip.Provider>
    </PortalContext.Provider>
  );
}

function SidebarContent({
  collapsed,
  counts,
  pathname,
  onToggle,
  touch = false,
}: {
  collapsed: boolean;
  counts: Record<string, number>;
  pathname: string;
  onToggle?: () => void;
  touch?: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-line px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed && (
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 font-semibold tracking-[-0.01em]"
          >
            <span className="truncate">{BRAND_NAME}</span>
            <span className="text-admin-meta font-normal">Admin</span>
          </Link>
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(iconButton, !collapsed && "ml-auto")}
          >
            <PanelLeft className={icon} aria-hidden />
          </button>
        )}
      </div>
      <nav aria-label="Admin" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {GROUPS.map((g) => (
          <div key={g.heading} className="flex flex-col gap-0.5">
            <p
              className={cn(
                "px-2 pb-1 text-admin-meta transition-opacity duration-200",
                collapsed && "sr-only",
              )}
            >
              {g.heading}
            </p>
            {g.items.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                count={counts[item.href] ?? 0}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                collapsed={collapsed}
                touch={touch}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-3 py-3">
        <NavItem item={VIEW_SITE} count={0} active={false} collapsed={collapsed} touch={touch} />
      </div>
    </>
  );
}

function NavItem({
  item,
  count,
  active,
  collapsed,
  touch,
}: {
  item: Item;
  count: number;
  active: boolean;
  collapsed: boolean;
  touch: boolean;
}) {
  const Icon = item.icon;
  const container = usePortalContainer();
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      {...(item.external ? { target: "_blank", rel: "noopener" } : {})}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-2 text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text",
        touch ? "h-11" : "h-8",
        collapsed && "justify-center px-0",
        active && "bg-surface-2 font-medium text-text",
      )}
    >
      {active && (
        <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
      )}
      <Icon className={cn(icon, active && "text-text")} aria-hidden />
      <span className={cn("truncate transition-opacity duration-200", collapsed && "sr-only")}>
        {item.label}
      </span>
      {count > 0 &&
        (collapsed ? (
          <span aria-hidden className="absolute top-1.5 right-2 size-1.5 rounded-full bg-accent" />
        ) : (
          <span className="ml-auto text-[12px] text-text-2 num">{formatCount(count)}</span>
        ))}
      {count > 0 && collapsed && <span className="sr-only">, {count} pending</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal container={container}>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-50 rounded-md border border-line bg-bg px-2 py-1 text-[12px] text-text shadow-lg"
        >
          {item.label}
          {count > 0 && <span className="text-text-2 num">, {count} pending</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// Segment labels for breadcrumbs. Ids (uuid) read as "Edit".
const CRUMBS: Record<string, string> = {
  admin: "Admin",
  agencies: "Agencies",
  new: "New",
  submissions: "Submissions",
  claims: "Claims",
  reviews: "Reviews",
  leads: "Leads",
  taxonomy: "Taxonomy",
  combo: "Combination copy",
};

function Breadcrumbs({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((p, i) => ({
    href: "/" + parts.slice(0, i + 1).join("/"),
    label: CRUMBS[p] ?? (/^[0-9a-f-]{36}$/i.test(p) ? "Edit" : p),
  }));
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-text-2">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li
              key={c.href}
              className={cn("flex min-w-0 items-center gap-1", !last && "max-sm:hidden")}
            >
              {i > 0 && (
                <ChevronRight
                  className="size-3.5 shrink-0 [stroke-width:1.5] max-sm:hidden"
                  aria-hidden
                />
              )}
              {last ? (
                <span aria-current="page" className="truncate text-text">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="truncate rounded px-1 hover:text-text">
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function ThemeMenu({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const Current = THEMES.find((t) => t.value === theme)!.icon;
  const container = usePortalContainer();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger aria-label={`Theme: ${theme}`} className={iconButton}>
        <Current className={icon} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container}>
        <DropdownMenu.Content align="end" sideOffset={6} className={cn(floating, "w-40")}>
          <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => onChange(v as Theme)}>
            {THEMES.map((t) => (
              <DropdownMenu.RadioItem key={t.value} value={t.value} className={menuRow}>
                <t.icon className={icon} aria-hidden />
                {t.label}
                <DropdownMenu.ItemIndicator className="ml-auto size-1.5 rounded-full bg-accent" />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Notifications({ queues }: { queues: Queue[] }) {
  const pending = queues.filter((q) => q.count > 0);
  const total = pending.reduce((n, q) => n + q.count, 0);
  const container = usePortalContainer();
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={total ? `Notifications, ${total} waiting` : "Notifications"}
        className={cn(iconButton, "relative")}
      >
        <Bell className={icon} aria-hidden />
        {total > 0 && (
          <span aria-hidden className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />
        )}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content align="end" sideOffset={6} className={cn(floating, "w-80 p-0")}>
          <p className="border-b border-line px-4 py-3 text-admin-section">Waiting for you</p>
          {pending.length ? (
            <ul className="p-1">
              {pending.map((q) => (
                <li key={q.href}>
                  <Popover.Close asChild>
                    <Link
                      href={q.href}
                      className="flex items-baseline gap-3 rounded-md px-3 py-2.5 hover:bg-surface-2"
                    >
                      <span>
                        <span className="num">{formatCount(q.count)}</span>{" "}
                        {q.count === 1 ? q.one : q.many}
                      </span>
                      {q.oldest && (
                        <time
                          dateTime={q.oldest}
                          title={formatDateTime(q.oldest)}
                          className="ml-auto shrink-0 text-admin-meta num"
                        >
                          oldest {formatRelative(q.oldest)}
                        </time>
                      )}
                    </Link>
                  </Popover.Close>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-text-2">Nothing is waiting for review.</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ProfileMenu({ email }: { email: string }) {
  const [, startTransition] = useTransition();
  const container = usePortalContainer();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="ml-1 flex size-8 items-center justify-center rounded-full border border-line text-[13px] font-medium uppercase transition-colors duration-150 hover:border-text-2"
      >
        {email.charAt(0) || "A"}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container}>
        <DropdownMenu.Content align="end" sideOffset={6} className={cn(floating, "w-60")}>
          <DropdownMenu.Label className="truncate px-2 py-1.5 text-admin-meta">
            {email}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={menuRow}>
            <a href="/" target="_blank" rel="noopener">
              View site
              <ArrowUpRight className={cn(icon, "ml-auto")} aria-hidden />
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuRow} onSelect={() => startTransition(() => signOut())}>
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
