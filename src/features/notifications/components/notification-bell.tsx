"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import type { NotificationItem } from "../queries";
import { NotificationRow, NotificationsEmpty } from "./notification-list";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(unreadCount);
  const [syncedCount, setSyncedCount] = useState(unreadCount);
  const [pending, startTransition] = useTransition();

  // Keep the badge in sync when the server sends a fresh count (after navigation).
  if (unreadCount !== syncedCount) {
    setSyncedCount(unreadCount);
    setUnread(unreadCount);
  }

  async function load() {
    setError(null);
    const res = await fetchNotificationsAction();
    if (res.ok) {
      setItems(res.items);
      setUnread(res.items.filter((i) => !i.readAt).length);
    } else setError(res.error);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  function openItem(item: NotificationItem) {
    if (!item.readAt) {
      setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) ?? null);
      setUnread((n) => Math.max(0, n - 1));
      void markNotificationReadAction(item.id);
    }
    if (item.url) setOpen(false);
  }

  function markAll() {
    startTransition(async () => {
      const res = await markAllNotificationsReadAction();
      if (res.ok) {
        setItems((list) => list?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? null);
        setUnread(0);
        router.refresh();
      }
    });
  }

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={label}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              className="absolute right-1 top-1 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10.5px] font-bold leading-[18px] text-white ring-2 ring-card"
              data-testid="unread-badge"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={pending || unread === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {error ? (
            <div className="px-3 py-6 text-center text-sm">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : items === null ? (
            <div className="grid gap-2 p-1" aria-busy="true" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <NotificationsEmpty />
          ) : (
            items.map((item) => <NotificationRow key={item.id} item={item} onOpen={openItem} compact />)
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}>
            <Link href="/app/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
