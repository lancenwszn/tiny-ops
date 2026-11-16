"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import type { NotificationItem } from "../queries";
import { NotificationRow, NotificationsEmpty } from "./notification-list";

export function NotificationsPageList({ initialItems }: { initialItems: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !i.readAt).length;

  function openItem(item: NotificationItem) {
    if (item.readAt) return;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)));
    start(async () => {
      await markNotificationReadAction(item.id);
      router.refresh();
    });
  }

  function markAll() {
    start(async () => {
      const res = await markAllNotificationsReadAction();
      if (res.ok) {
        setItems((list) => list.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-2">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} unread` : "No unread notifications"}</p>
        <Button variant="outline" size="sm" onClick={markAll} disabled={pending || unread === 0}>
          {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all as read
        </Button>
      </div>
      {items.length === 0 ? (
        <NotificationsEmpty />
      ) : (
        <div className="grid gap-1">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={openItem} />
          ))}
        </div>
      )}
    </Card>
  );
}
