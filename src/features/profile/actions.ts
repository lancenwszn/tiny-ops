"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { formValues, friendlyError, validationError, type FormState } from "@/lib/forms";
import { brandingPathSchema, timezoneSchema } from "@/features/workspaces/schemas";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120, "Name is too long"),
  timezone: z.union([z.literal(""), timezoneSchema]),
});

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData, ["fullName", "timezone"]);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, timezone: parsed.data.timezone || null })
    .eq("id", user.id);
  if (error) return { status: "error", message: friendlyError(error, "We couldn't save your profile."), values };

  revalidatePath("/app", "layout");
  return { status: "success", message: "Profile saved.", values };
}

export async function updateAvatarAction(path: string | null): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (path !== null && !brandingPathSchema(`users/${user.id}/`).safeParse(path).success) {
    return { ok: false, error: "Invalid image file." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return { ok: false, error: friendlyError(error, "We couldn't update your photo.") };

  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from("branding").remove([current.avatar_path]);
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}
