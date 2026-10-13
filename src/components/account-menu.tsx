"use client";

import Image from "next/image";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useState, useTransition } from "react";

import { signOut } from "@/lib/actions/auth";
import type { Account } from "@/lib/account";

// The signed-in header: a 32px avatar that opens the account menu (name and email, Dashboard,
// Admin for admins, Sign out). Used by the public nav and the dashboard header. The email only
// ever appears inside the menu. Whether Admin shows is decided by the caller from the database
// role (the dashboard on the server; the public nav from the profiles row), and /admin itself is
// gated on the server.

const item =
  "flex min-h-10 cursor-pointer items-center rounded-lg px-2.5 text-[14.5px] outline-none select-none data-[highlighted]:bg-surface";

/** The avatar: the Google photo if there is one and it loads, else the initial. */
export function Avatar({ account }: { account: Account }) {
  const [failed, setFailed] = useState(false);
  return account.avatarUrl && !failed ? (
    <Image
      src={account.avatarUrl}
      alt=""
      width={32}
      height={32}
      className="size-8 rounded-full object-cover"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      aria-hidden
      className="grid size-8 place-items-center rounded-full bg-(--accent-soft) text-[14px] font-semibold text-(--accent-on-soft)"
    >
      {account.initial}
    </span>
  );
}

/** Same footprint as the avatar, while the session is still being read: no layout shift. */
export function AvatarPlaceholder() {
  return <span aria-hidden className="block size-8 rounded-full bg-surface" />;
}

export function AccountMenu({ account, admin }: { account: Account; admin: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <Avatar account={account} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-60 rounded-[14px] border border-line bg-raised p-1.5 text-text shadow-[0_1px_2px_rgba(20,25,40,.06),0_12px_32px_-12px_rgba(20,25,40,.2)]"
        >
          <DropdownMenu.Label className="px-2.5 pt-2 pb-2.5">
            <span className="block truncate text-[14.5px] font-medium">{account.name}</span>
            {account.email && (
              <span className="block truncate text-[13px] text-text-2">{account.email}</span>
            )}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={item}>
            <Link href="/dashboard">Dashboard</Link>
          </DropdownMenu.Item>
          {admin && (
            <DropdownMenu.Item asChild className={item}>
              <Link href="/admin">Admin</Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={item} onSelect={() => startTransition(() => signOut())}>
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
