"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { signUpAction } from "../actions";

export function SignupForm({ next, email }: { next?: string; email?: string }) {
  const [state, action] = useActionState(signUpAction, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <TextField name="fullName" label="Full name" autoComplete="name" required state={state} autoFocus />
      <TextField
        name="email"
        label="Work email"
        type="email"
        autoComplete="email"
        required
        state={state}
        defaultValue={email}
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        state={{ ...state, values: undefined }}
        hint="At least 8 characters, with a letter and a number."
      />
      <SubmitButton className="mt-1 w-full" size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        By creating an account you agree to our{" "}
        <a href="/terms" className="underline hover:text-foreground">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
