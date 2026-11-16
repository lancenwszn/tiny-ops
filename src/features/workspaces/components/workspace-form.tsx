"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField, TextareaField } from "@/components/shared/form";
import { initialFormState, type FormState } from "@/lib/forms";
import { TimezoneField } from "./timezone-field";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function WorkspaceForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  readOnly,
}: {
  action: Action;
  defaults?: { name?: string; timezone?: string; description?: string };
  submitLabel: string;
  pendingLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <TextField
        name="name"
        label="Business name"
        placeholder="e.g. Brightside Coffee Co."
        required
        maxLength={80}
        state={state}
        defaultValue={defaults?.name}
        disabled={readOnly}
      />
      <TimezoneField
        state={state}
        defaultValue={defaults?.timezone}
        disabled={readOnly}
        hint="Recurring checklists and due dates follow this timezone."
      />
      <TextareaField
        name="description"
        label="What does your business do?"
        placeholder="Optional — a sentence or two for your team."
        maxLength={500}
        rows={3}
        state={state}
        defaultValue={defaults?.description}
        disabled={readOnly}
      />
      {!readOnly && (
        <div>
          <SubmitButton pendingText={pendingLabel}>{submitLabel}</SubmitButton>
        </div>
      )}
    </form>
  );
}
