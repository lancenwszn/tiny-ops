"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { acceptInvitationAction } from "../actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 text-left">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingText="Joining…">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
