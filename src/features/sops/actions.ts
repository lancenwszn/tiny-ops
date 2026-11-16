"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { getActiveMembership, canManageOperations } from "@/lib/workspace/active";
import { formValues, friendlyError, validationError, type FormState } from "@/lib/forms";
import { sanitizeSections } from "./content/sanitize";
import {
  accessSchema,
  attachmentSchema,
  categorySchema,
  createSopSchema,
  isValidAttachmentPath,
  saveDraftSchema,
  type SaveDraftInput,
} from "./schemas";

/**
 * SOP Server Actions. Each one re-validates input, resolves the active
 * workspace on the server, and calls an RPC that re-checks the caller's role.
 * RLS remains the final authority.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const uuid = z.uuid();

function refresh(sopId?: string) {
  revalidatePath("/app/sops", "layout");
  revalidatePath("/app/dashboard");
  if (sopId) revalidatePath(`/app/sops/${sopId}`, "layout");
}

async function requireManager() {
  const membership = await getActiveMembership();
  if (!canManageOperations(membership.role)) throw new Error("forbidden");
  return membership;
}

export async function createSopAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { workspace, role } = await getActiveMembership();
  if (!canManageOperations(role)) return { status: "error", message: "Only owners and admins can create SOPs." };

  const values = formValues(formData, ["title", "categoryId", "description"]);
  const parsed = createSopSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_sop", {
    p_workspace_id: workspace.id,
    p_title: parsed.data.title,
    p_category_id: parsed.data.categoryId as string,
    p_description: parsed.data.description,
  });
  if (error || !id) return { status: "error", message: friendlyError(error, "We couldn't create the SOP."), values };

  refresh();
  redirect(`/app/sops/${id}/edit`);
}

export type SaveResult = { ok: true; revision: number; savedAt: string } | { ok: false; error: string; conflict?: boolean };

/** Saves the working copy (used by autosave and the Save button). */
export async function saveSopDraftAction(input: SaveDraftInput): Promise<SaveResult> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_sop_draft", {
    p_sop_id: d.sopId,
    p_expected_revision: d.revision,
    p_title: d.title,
    p_description: d.description,
    p_category_id: d.categoryId as string,
    p_owner_id: d.ownerId as string,
    p_requires_acknowledgment: d.requiresAcknowledgment,
    // Never trust editor JSON: keep only allowlisted nodes, marks and attrs.
    p_sections: sanitizeSections(d.sections) as unknown as Json,
    p_steps: d.steps.map((s, i) => ({
      title: s.title.trim() || `Step ${i + 1}`,
      instructions: s.instructions,
      notes: s.notes,
      attachment_id: s.attachment_id,
    })),
  });
  if (error || data === null) {
    if (error?.code === "40001") return { ok: false, error: error.message, conflict: true };
    if (error?.code === "23503") return { ok: false, error: "A step references a file that was removed. Pick another file." };
    return { ok: false, error: friendlyError(error, "We couldn't save your changes. Please try again.") };
  }
  return { ok: true, revision: data, savedAt: new Date().toISOString() };
}

export async function publishSopAction(sopId: string, note: string): Promise<Result<{ version: number }>> {
  if (!uuid.safeParse(sopId).success) return { ok: false, error: "Invalid SOP." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_sop", { p_sop_id: sopId, p_note: note.slice(0, 500) });
  if (error || !data) return { ok: false, error: friendlyError(error, "We couldn't publish the SOP.") };
  refresh(sopId);
  return { ok: true, version: data };
}

export async function archiveSopAction(sopId: string): Promise<Result> {
  if (!uuid.safeParse(sopId).success) return { ok: false, error: "Invalid SOP." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_sop", { p_sop_id: sopId });
  if (error) return { ok: false, error: friendlyError(error, "We couldn't archive the SOP.") };
  refresh(sopId);
  return { ok: true };
}

export async function unarchiveSopAction(sopId: string): Promise<Result<{ status: string }>> {
  if (!uuid.safeParse(sopId).success) return { ok: false, error: "Invalid SOP." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unarchive_sop", { p_sop_id: sopId });
  if (error || !data) return { ok: false, error: friendlyError(error, "We couldn't restore the SOP.") };
  refresh(sopId);
  return { ok: true, status: data };
}

export async function duplicateSopAction(sopId: string): Promise<Result<{ id: string }>> {
  if (!uuid.safeParse(sopId).success) return { ok: false, error: "Invalid SOP." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_sop", { p_sop_id: sopId });
  if (error || !data) return { ok: false, error: friendlyError(error, "We couldn't duplicate the SOP.") };
  refresh();
  return { ok: true, id: data };
}

export async function restoreSopVersionAction(sopId: string, version: number, discardUnpublished: boolean): Promise<Result<{ version: number }>> {
  if (!uuid.safeParse(sopId).success || !Number.isInteger(version)) return { ok: false, error: "Invalid version." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_sop_version", {
    p_sop_id: sopId,
    p_version: version,
    p_discard_unpublished: discardUnpublished,
  });
  if (error || !data) return { ok: false, error: friendlyError(error, "We couldn't restore that version.") };
  refresh(sopId);
  return { ok: true, version: data };
}

export async function setSopAccessAction(input: z.input<typeof accessSchema>): Promise<Result> {
  const parsed = accessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid access settings." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_sop_access", {
    p_sop_id: parsed.data.sopId,
    p_visibility: parsed.data.visibility,
    p_members_role: parsed.data.membersRole,
    p_user_ids: parsed.data.userIds,
  });
  if (error) return { ok: false, error: friendlyError(error, "We couldn't update who can see this SOP.") };
  refresh(parsed.data.sopId);
  return { ok: true };
}

export async function acknowledgeSopAction(sopId: string): Promise<Result<{ version: number }>> {
  if (!uuid.safeParse(sopId).success) return { ok: false, error: "Invalid SOP." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("acknowledge_sop", { p_sop_id: sopId });
  if (error || !data) return { ok: false, error: friendlyError(error, "We couldn't record your acknowledgment.") };
  refresh(sopId);
  revalidatePath("/app", "layout");
  return { ok: true, version: data };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { workspace, role } = await getActiveMembership();
  if (!canManageOperations(role)) return { status: "error", message: "Only owners and admins can manage categories." };
  const id = String(formData.get("id") ?? "");
  const values = formValues(formData, ["name", "description", "color"]);
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("sop_categories").update(parsed.data).eq("id", id).eq("workspace_id", workspace.id)
    : await supabase.from("sop_categories").insert({ ...parsed.data, workspace_id: workspace.id, position: 100 });
  if (error) {
    if (error.code === "23505") return { status: "error", fieldErrors: { name: ["A category with this name already exists"] }, values };
    return { status: "error", message: friendlyError(error, "We couldn't save the category."), values };
  }
  refresh();
  return { status: "success", message: id ? "Category updated." : "Category created.", values };
}

export async function setCategoryArchivedAction(categoryId: string, archived: boolean): Promise<Result> {
  if (!uuid.safeParse(categoryId).success) return { ok: false, error: "Invalid category." };
  const { workspace } = await requireManager().catch(() => ({ workspace: null }));
  if (!workspace) return { ok: false, error: "Only owners and admins can manage categories." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sop_categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", categoryId)
    .eq("workspace_id", workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "We couldn't update the category.") };
  refresh();
  return { ok: true };
}

export async function deleteCategoryAction(categoryId: string, reassignTo: string | null): Promise<Result> {
  if (!uuid.safeParse(categoryId).success || (reassignTo && !uuid.safeParse(reassignTo).success)) {
    return { ok: false, error: "Invalid category." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_sop_category", { p_category_id: categoryId, p_reassign_to: reassignTo as string });
  if (error) return { ok: false, error: friendlyError(error, "We couldn't delete the category.") };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Attachments (private bucket; uploads go browser -> Storage under RLS)
// ---------------------------------------------------------------------------
export type AttachmentResult = Result<{
  attachment: { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; storagePath: string; previewUrl: string | null };
}>;

export async function registerAttachmentAction(input: z.input<typeof attachmentSchema>): Promise<AttachmentResult> {
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file." };
  const { workspace } = await getActiveMembership();
  const a = parsed.data;
  const supabase = await createClient();
  if (!isValidAttachmentPath(a.path, workspace.id, a.sopId, a.mimeType)) {
    await supabase.storage.from("sop-attachments").remove([a.path]);
    return { ok: false, error: "Invalid upload location." };
  }

  const { data, error } = await supabase
    .from("sop_attachments")
    .insert({ workspace_id: workspace.id, sop_id: a.sopId, storage_path: a.path, file_name: a.fileName, mime_type: a.mimeType, size_bytes: a.size })
    .select("id, file_name, mime_type, size_bytes, created_at, storage_path")
    .single();
  if (error || !data) {
    await supabase.storage.from("sop-attachments").remove([a.path]);
    return { ok: false, error: friendlyError(error, "We couldn't attach that file.") };
  }
  const preview = a.mimeType.startsWith("image/")
    ? (await supabase.storage.from("sop-attachments").createSignedUrl(a.path, 3600)).data?.signedUrl ?? null
    : null;
  revalidatePath(`/app/sops/${a.sopId}`);
  return {
    ok: true,
    attachment: {
      id: data.id,
      fileName: data.file_name,
      mimeType: data.mime_type,
      sizeBytes: data.size_bytes,
      createdAt: data.created_at,
      storagePath: data.storage_path,
      previewUrl: preview,
    },
  };
}

export async function deleteAttachmentAction(attachmentId: string): Promise<Result> {
  if (!uuid.safeParse(attachmentId).success) return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("sop_attachments").delete().eq("id", attachmentId).select("storage_path, sop_id");
  if (error || !data?.length) return { ok: false, error: friendlyError(error, "We couldn't remove that file.") };
  await supabase.storage.from("sop-attachments").remove([data[0].storage_path]);
  revalidatePath(`/app/sops/${data[0].sop_id}`);
  return { ok: true };
}

/** Short-lived signed link. Storage RLS refuses users who cannot read the SOP. */
export async function getAttachmentUrlAction(attachmentId: string, download: boolean): Promise<Result<{ url: string }>> {
  if (!uuid.safeParse(attachmentId).success) return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const { data: att } = await supabase.from("sop_attachments").select("storage_path, file_name").eq("id", attachmentId).maybeSingle();
  if (!att) return { ok: false, error: "File not found." };
  const { data, error } = await supabase.storage
    .from("sop-attachments")
    .createSignedUrl(att.storage_path, 60, download ? { download: att.file_name } : undefined);
  if (error || !data?.signedUrl) return { ok: false, error: "You don't have access to this file." };
  return { ok: true, url: data.signedUrl };
}
