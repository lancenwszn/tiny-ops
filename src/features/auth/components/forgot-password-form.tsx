"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { forgotPasswordAction } from "../actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} autoFocus />
      <SubmitButton className="w-full" size="lg" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
