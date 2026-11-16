"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import { TimezoneField } from "@/features/workspaces/components/timezone-field";
import { initialFormState } from "@/lib/forms";
import { updateProfileAction } from "../actions";

export function ProfileForm({ fullName, email, timezone }: { fullName: string; email: string; timezone: string | null }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <TextField name="fullName" label="Full name" autoComplete="name" required maxLength={120} state={state} defaultValue={fullName} />
      <TextField name="email" label="Email" value={email} readOnly disabled hint="Contact support to change your sign-in email." />
      <TimezoneField
        label="Your timezone"
        state={state}
        defaultValue={timezone ?? ""}
        allowEmpty="Use my device's timezone"
        hint="Used for your greeting and personal due-date display."
      />
      <div>
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
