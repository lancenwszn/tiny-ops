import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

const COLUMNS = "id, type, title, body, url, read_at, created_at";

// Inbox = notifications for the active workspace, plus personal invitations
// from other workspaces (the user isn't a member there yet). RLS enforces it.
function inboxFilter(workspaceId: string) {
  return `workspace_id.eq.${workspaceId},type.eq.invitation`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getUnreadNotificationCount = cache(async (workspaceId: string): Promise<number> => {
  if (!UUID.test(workspaceId)) return 0;
  const user = await requireUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null)
    .or(inboxFilter(workspaceId));
  return count ?? 0;
});

export async function listNotifications(workspaceId: string, limit = 20): Promise<NotificationItem[]> {
  if (!UUID.test(workspaceId)) return [];
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .or(inboxFilter(workspaceId))
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error("Could not load notifications");
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}
