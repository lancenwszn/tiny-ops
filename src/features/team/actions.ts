"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership, canManageOperations } from "@/lib/workspace/active";
import { formValues, friendlyError, validationError, type FormState } from "@/lib/forms";
import { siteUrl } from "@/lib/env";
import { inviteSchema } from "./schemas";

/**
 * Creates an invitation for the active workspace. The database re-checks the
 * caller's role, the admin-invite rule and plan member limits. Returns a
 * one-time link (email delivery is configured in a later stage).
 */
export async function createInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { workspace, role } = await getActiveMembership();
  if (!canManageOperations(role)) {
    return { status: "error", message: "Only owners and admins can invite teammates." };
  }

  const values = formValues(formData, ["email", "role"]);
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  if (parsed.data.role === "admin" && role !== "owner") {
    return { status: "error", fieldErrors: { role: ["Only the owner can invite admins"] }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_workspace_id: workspace.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  const token = data?.[0]?.token;
  if (error || !token) {
    return { status: "error", message: friendlyError(error, "We couldn't create the invitation."), values };
  }

  revalidatePath("/app", "layout");
  return {
    status: "success",
    message: `Invitation created for ${parsed.data.email}.`,
    data: { inviteUrl: `${siteUrl}/invite/${token}`, email: parsed.data.email },
  };
}
