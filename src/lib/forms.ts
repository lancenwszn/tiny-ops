import { z } from "zod";

/** Shape returned by every form Server Action (used with useActionState). */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echo of submitted values so inputs keep their content after an error. */
  values?: Record<string, string>;
  /** Extra success payload (e.g. a generated link). */
  data?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

export function validationError(error: z.ZodError, values?: Record<string, string>): FormState {
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
    values,
  };
}

// Postgres error codes our RPCs raise with user-facing messages.
const USER_FACING_CODES = new Set(["P0001", "P0002", "22023", "23505", "42501"]);

/** Turns a Supabase/PostgREST error into a message that is safe to show. */
export function friendlyError(error: { code?: string; message?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (error.code && USER_FACING_CODES.has(error.code) && error.message) {
    return error.code === "42501" && /row-level security|permission denied/i.test(error.message)
      ? "You don't have permission to do that."
      : error.message;
  }
  return fallback;
}
