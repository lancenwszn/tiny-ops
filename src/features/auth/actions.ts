"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { safeNext } from "@/lib/auth/redirect";
import { formValues, validationError, type FormState } from "@/lib/forms";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema, emailSchema } from "./schemas";

function confirmUrl(next: string) {
  return `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["fullName", "email"]);
  const parsed = signUpSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return validationError(parsed.error, values);

  const next = safeNext(formData.get("next"), "/onboarding");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: confirmUrl(next),
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: [error.message] }, values };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { status: "error", message: "Too many attempts. Please wait a minute and try again.", values };
    }
    // Existing accounts are handled like new ones to avoid revealing who has signed up.
    if (error.code !== "user_already_exists") {
      return { status: "error", message: "We couldn't create your account. Please try again.", values };
    }
  }

  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Please verify your email address first. We can send you a new link.",
        fieldErrors: { unverified: ["true"] },
        values,
      };
    }
    if (error.status === 429) {
      return { status: "error", message: "Too many attempts. Please wait a minute and try again.", values };
    }
    return { status: "error", message: "Incorrect email or password.", values };
  }

  redirect(safeNext(formData.get("next")));
}

export async function resendVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: confirmUrl(safeNext(formData.get("next"), "/onboarding")) },
  });
  if (error?.status === 429) {
    return { status: "error", message: "Please wait a minute before requesting another email." };
  }
  return { status: "success", message: "If that account needs verifying, a new link is on its way." };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmUrl("/reset-password"),
  });
  if (error?.status === 429) {
    return { status: "error", message: "Please wait a minute before requesting another email.", values };
  }
  // Same response whether or not the account exists.
  return { status: "success", message: "If an account exists for that email, we've sent a reset link." };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { status: "error", message: "Your reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: ["Choose a password you haven't used before"] } };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: [error.message] } };
    }
    return { status: "error", message: "We couldn't update your password. Please try again." };
  }

  redirect("/app/dashboard?notice=password-updated");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
