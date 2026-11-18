"use client";

import Link from "next/link";
import { Mail, UserPlus, UserCog, Bell, ShieldCheck, BookOpenText, type LucideIcon } from "lucide-react";
import { RelativeTime } from "@/components/shared/relative-time";
import type { NotificationItem } from "../queries";
import { cn } from "@/lib/utils";

const ICONS: Record<string, { icon: LucideIcon; tint: string }> = {
  invitation: { icon: Mail, tint: "bg-tint-violet text-tint-violet-fg" },
  "member.joined": { icon: UserPlus, tint: "bg-tint-green text-tint-green-fg" },
  "member.role_changed": { icon: UserCog, tint: "bg-tint-sky text-tint-sky-fg" },
  "sop.ack_required": { icon: ShieldCheck, tint: "bg-tint-amber text-tint-amber-fg" },
  "sop.owner_assigned": { icon: BookOpenText, tint: "bg-tint-violet text-tint-violet-fg" },
};

export function NotificationRow({
  item,
  onOpen,
  compact,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  compact?: boolean;
}) {
  const meta = ICONS[item.type] ?? { icon: Bell, tint: "bg-muted text-muted-foreground" };
  const Icon = meta.icon;
  const unread = !item.readAt;
  const content = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", meta.tint)}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-snug", unread ? "font-semibold" : "font-medium text-foreground/80")}>{item.title}</span>
        {item.body && <span className={cn("mt-0.5 block text-[13px] text-muted-foreground", compact && "line-clamp-2")}>{item.body}</span>}
        <RelativeTime iso={item.createdAt} className="mt-1 block text-xs text-muted-foreground" />
      </span>
      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
    </>
  );
  const className = cn(
    "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
    unread ? "bg-secondary/50 hover:bg-secondary" : "hover:bg-muted",
  );

  return item.url ? (
    <Link href={item.url} className={className} onClick={() => onOpen(item)} data-testid="notification">
      {content}
    </Link>
  ) : (
    <button type="button" className={cn(className, "cursor-pointer")} onClick={() => onOpen(item)} data-testid="notification">
      {content}
    </button>
  );
}

export function NotificationsEmpty() {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Bell className="size-6" />
      </span>
      <p className="mt-3 font-semibold">You&apos;re all caught up</p>
      <p className="mt-1 text-sm text-muted-foreground">Invitations, new teammates, role changes and SOPs to review will show up here.</p>
    </div>
  );
}
