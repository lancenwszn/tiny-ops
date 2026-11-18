import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEntry } from "./activity";
import type { OperationsInputs } from "./metrics";
import type { UpcomingTask } from "./components/upcoming-tasks";
import type { SopSummary } from "./components/recent-sops";
import type { CalendarEvent } from "./components/operations-calendar";
import { modules } from "@/lib/modules";
import { getSopStats, recentSops, type SopStats } from "@/features/sops/queries";

/**
 * Dashboard read model. Every query is RLS-scoped through the user's session
 * and keyed by the server-validated active workspace. Wrapped in React
 * `cache` so widgets that share data trigger a single request per render.
 */

export type TeamSnapshot = {
  activeCount: number;
  pendingInvites: number;
  members: { id: string; name: string; avatarPath: string | null }[];
};

export const getTeamSnapshot = cache(async (workspaceId: string): Promise<TeamSnapshot> => {
  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("user_id, profile:profiles!workspace_members_user_id_fkey!inner(full_name, email, avatar_path)", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("joined_at", { ascending: true })
      .limit(5),
    // Invitations are visible to owners/admins only (RLS); members get 0.
    supabase
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  if (members.error) throw new Error("Could not load team");

  return {
    activeCount: members.count ?? 0,
    pendingInvites: invites.count ?? 0,
    members: (members.data ?? []).map((m) => {
      const p = m.profile as { full_name: string; email: string; avatar_path: string | null };
      return { id: m.user_id, name: p.full_name || p.email, avatarPath: p.avatar_path };
    }),
  };
});

export const getRecentActivity = cache(async (workspaceId: string, limit = 6): Promise<ActivityEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, action, metadata, created_at, entity_type, entity_id, actor:profiles(full_name, email, avatar_path)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load activity");

  // Titles come from the live SOP rows the viewer may read (RLS), never from the log.
  const sopIds = [...new Set((data ?? []).filter((r) => r.entity_type === "sop" && r.entity_id).map((r) => r.entity_id as string))];
  const titles = new Map<string, string>();
  if (sopIds.length) {
    const { data: sops } = await supabase.from("sop_documents").select("id, title").in("id", sopIds);
    for (const s of sops ?? []) titles.set(s.id, s.title);
  }

  return (data ?? []).map((row) => {
    const actor = row.actor as { full_name: string; email: string; avatar_path: string | null } | null;
    return {
      id: row.id,
      action: row.action,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
      actorName: actor ? actor.full_name || actor.email.split("@")[0] : null,
      actorAvatarPath: actor?.avatar_path ?? null,
      entityTitle: row.entity_type === "sop" && row.entity_id ? (titles.get(row.entity_id) ?? null) : null,
    };
  });
});

/**
 * Operational inputs from live modules. Tasks (Stage 4) and checklists
 * (Stage 5) plug in here; until then they are undefined, never zero-filled.
 */
export const getOperationsInputs = cache(async (_workspaceId: string): Promise<OperationsInputs> => {
  void _workspaceId;
  const inputs: OperationsInputs = {};
  if (modules.tasks.available) {
    // Stage 4: aggregate task counts for the workspace.
  }
  if (modules.checklists.available) {
    // Stage 5: aggregate today's checklist instances.
  }
  return inputs;
});

export const getUpcomingTasks = cache(async (_workspaceId: string): Promise<UpcomingTask[] | null> => {
  void _workspaceId;
  return modules.tasks.available ? [] : null;
});

export const getRecentSops = cache(async (workspaceId: string): Promise<SopSummary[] | null> => {
  if (!modules.sops.available) return null;
  // RLS-scoped: members only get published SOPs they are allowed to read.
  const sops = await recentSops(workspaceId, 5);
  return sops.map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category?.name ?? null,
    ownerName: s.owner?.name ?? null,
    updatedAt: s.updatedAt,
    status: s.status,
  }));
});

export const getSopCounts = cache(async (workspaceId: string): Promise<SopStats | null> => {
  return modules.sops.available ? getSopStats(workspaceId) : null;
});

export const getCalendarEvents = cache(async (_workspaceId: string): Promise<CalendarEvent[]> => {
  void _workspaceId;
  return [];
});
