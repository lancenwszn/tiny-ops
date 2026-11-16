"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage, SubmitButton, TextField, TextareaField } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { createSopAction } from "../actions";

export function NewSopForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createSopAction, initialFormState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <TextField name="title" label="Title" placeholder="e.g. Daily opening procedure" required maxLength={160} state={state} autoFocus />
      <div className="grid gap-1.5">
        <Label htmlFor="new-sop-category">Category</Label>
        <div className="relative">
          <select
            id="new-sop-category"
            name="categoryId"
            defaultValue={state.values?.categoryId ?? ""}
            className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-60" />
        </div>
        <FieldError id="new-sop-category-error" errors={state.fieldErrors?.categoryId} />
      </div>
      <TextareaField name="description" label="Short description" placeholder="Optional" rows={3} maxLength={500} state={state} />
      <div>
        <SubmitButton pendingText="Creating…">Create and start writing</SubmitButton>
      </div>
    </form>
  );
}
