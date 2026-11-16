"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { resetPasswordAction } from "../actions";

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        state={state}
        hint="At least 8 characters, with a letter and a number."
        autoFocus
      />
      <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Saving…">
        Update password
      </SubmitButton>
    </form>
  );
}
