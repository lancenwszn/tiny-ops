"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { formValues, friendlyError, validationError, type FormState } from "@/lib/forms";
import {
  ACTIVE_WORKSPACE_COOKIE,
  activeWorkspaceCookieOptions,
  getActiveMembership,
  getMemberships,
} from "@/lib/workspace/active";
import { brandingPathSchema, workspaceDetailsSchema } from "./schemas";

async function setActiveWorkspaceCookie(workspaceId: string) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, activeWorkspaceCookieOptions);
}

export async function createWorkspaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/onboarding");
  const values = formValues(formData, ["name", "timezone", "description"]);
  const parsed = workspaceDetailsSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
    p_description: parsed.data.description,
  });

  if (error || !workspaceId) {
    return { status: "error", message: friendlyError(error, "We couldn't create your workspace. Please try again."), values };
  }

  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/app", "layout");
  redirect("/app/dashboard?notice=workspace-created");
}

export async function switchWorkspaceAction(workspaceId: string) {
  const memberships = await getMemberships();
  // Only switch into workspaces the user is an active member of.
  if (!memberships.some((m) => m.workspace.id === workspaceId)) {
    return { ok: false as const, error: "You don't have access to that workspace." };
  }
  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/app", "layout");
  redirect("/app/dashboard");
}

export async function updateWorkspaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { workspace, role } = await getActiveMembership();
  if (role !== "owner") return { status: "error", message: "Only the workspace owner can change these settings." };

  const values = formValues(formData, ["name", "timezone", "description"]);
  const parsed = workspaceDetailsSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name, timezone: parsed.data.timezone, description: parsed.data.description })
    .eq("id", workspace.id)
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: friendlyError(error, "We couldn't save your changes."), values };
  }

  revalidatePath("/app", "layout");
  return { status: "success", message: "Workspace settings saved.", values };
}

/** Called after the client uploads a logo straight to Storage (RLS-checked). */
export async function updateWorkspaceLogoAction(path: string | null): Promise<{ ok: boolean; error?: string }> {
  const { workspace, role } = await getActiveMembership();
  if (role !== "owner") return { ok: false, error: "Only the workspace owner can change the logo." };

  if (path !== null && !brandingPathSchema(`workspaces/${workspace.id}/`).safeParse(path).success) {
    return { ok: false, error: "Invalid logo file." };
  }

  const supabase = await createClient();
  const previous = workspace.logo_path;
  const { error } = await supabase.from("workspaces").update({ logo_path: path }).eq("id", workspace.id);
  if (error) return { ok: false, error: friendlyError(error, "We couldn't update the logo.") };

  if (previous && previous !== path) {
    await supabase.storage.from("branding").remove([previous]);
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function acceptInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  await requireUser(`/invite/${encodeURIComponent(token)}`);
  if (!/^[a-f0-9]{64}$/.test(token)) return { status: "error", message: "This invitation link is invalid." };

  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !workspaceId) {
    return { status: "error", message: friendlyError(error, "We couldn't accept this invitation.") };
  }

  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/app", "layout");
  redirect("/app/dashboard?notice=joined-workspace");
}
