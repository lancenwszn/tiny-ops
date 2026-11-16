import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { Database } from "@/types/database";

export type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];

export type Membership = {
  role: WorkspaceRole;
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string;
    logo_path: string | null;
    timezone: string;
  };
};

export const ACTIVE_WORKSPACE_COOKIE = "tinyops_ws";

export const activeWorkspaceCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** All active memberships of the signed-in user (RLS-scoped). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces!inner(id, name, slug, description, logo_path, timezone)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) throw new Error("Could not load your workspaces");
  return (data ?? []) as Membership[];
});

/**
 * The workspace the user is working in. The cookie is only a preference: it is
 * honoured only if the user is still an active member, otherwise we fall back
 * to their first workspace. Users without a workspace go to onboarding.
 */
export const getActiveMembership = cache(async (): Promise<Membership> => {
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/onboarding");

  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  return memberships.find((m) => m.workspace.id === preferred) ?? memberships[0];
});

export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageOperations(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}
