"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { signInAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  const unverified = state.fieldErrors?.unverified;
  const email = state.values?.email ?? "";

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={{ ...state, fieldErrors: undefined }} />
      {unverified && (
        <Link
          href={`/verify-email?email=${encodeURIComponent(email)}`}
          className="-mt-1 text-sm font-semibold text-primary hover:underline"
        >
          Resend verification email
        </Link>
      )}
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} autoFocus />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        state={{ ...state, values: undefined }}
        labelAction={
          <Link href="/forgot-password" className="text-[13px] font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
        }
      />
      <SubmitButton className="mt-1 w-full" size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
