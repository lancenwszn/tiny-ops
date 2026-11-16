"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

type FieldProps = {
  name: string;
  label: string;
  state?: FormState;
  hint?: React.ReactNode;
  labelAction?: React.ReactNode;
  className?: string;
};

export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-[13px] font-medium text-destructive">
      {errors[0]}
    </p>
  );
}

export function TextField({
  name,
  label,
  state,
  hint,
  labelAction,
  className,
  defaultValue,
  ...inputProps
}: FieldProps & Omit<React.ComponentProps<typeof Input>, "name">) {
  const id = React.useId();
  const errors = state?.fieldErrors?.[name];
  const value = state?.values?.[name] ?? defaultValue;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <Input
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errors?.length ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...inputProps}
      />
      {hint && !errors?.length && (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}

export function TextareaField({
  name,
  label,
  state,
  hint,
  className,
  defaultValue,
  ...props
}: FieldProps & Omit<React.ComponentProps<typeof Textarea>, "name">) {
  const id = React.useId();
  const errors = state?.fieldErrors?.[name];
  const value = state?.values?.[name] ?? defaultValue;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errors?.length ? `${id}-error` : undefined}
        {...props}
      />
      {hint && !errors?.length && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  return (
    <Alert variant={isError ? "destructive" : "success"} aria-live="polite">
      {isError ? <AlertCircle /> : <CheckCircle2 />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending} className={className} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
