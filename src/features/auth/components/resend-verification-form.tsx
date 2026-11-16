"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { resendVerificationAction } from "../actions";

export function ResendVerificationForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="email" value={email} />
      <FormMessage state={state} />
      <SubmitButton variant="outline" className="w-full" pendingText="Sending…" disabled={!email}>
        Resend verification email
      </SubmitButton>
    </form>
  );
}
