"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/workspace/active";
import { listNotifications, type NotificationItem } from "./queries";

export async function fetchNotificationsAction(): Promise<
  { ok: true; items: NotificationItem[] } | { ok: false; error: string }
> {
  try {
    const { workspace } = await getActiveMembership();
    return { ok: true, items: await listNotifications(workspace.id, 20) };
  } catch {
    return { ok: false, error: "We couldn't load your notifications." };
  }
}

const idSchema = z.uuid();

export async function markNotificationReadAction(id: string): Promise<{ ok: boolean }> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  // RLS also restricts updates to the recipient; the filter makes intent explicit.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/app", "layout");
  return { ok: !error };
}

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const { workspace } = await getActiveMembership();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
    .or(`workspace_id.eq.${workspace.id},type.eq.invitation`);
  revalidatePath("/app", "layout");
  return { ok: !error };
}
