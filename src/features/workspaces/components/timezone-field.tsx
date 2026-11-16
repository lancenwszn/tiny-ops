"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/shared/form";
import { listTimezones } from "@/lib/dates/timezones";
import type { FormState } from "@/lib/forms";
import { useBrowserTimezone } from "@/hooks/use-is-client";

/**
 * Native select: fast and accessible for ~400 IANA zones. When no value is
 * provided it preselects the browser's timezone.
 */
export function TimezoneField({
  name = "timezone",
  label = "Timezone",
  defaultValue,
  state,
  allowEmpty,
  hint,
  disabled,
}: {
  name?: string;
  label?: string;
  defaultValue?: string | null;
  state?: FormState;
  allowEmpty?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = React.useId();
  const zones = React.useMemo(() => listTimezones(), []);
  const initial = state?.values?.[name] ?? defaultValue ?? "";
  const browserTz = useBrowserTimezone();
  const [chosen, setValue] = React.useState<string | null>(null);
  const value = chosen ?? (initial || (allowEmpty !== undefined ? "" : browserTz));
  const errors = state?.fieldErrors?.[name];

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={errors?.length ? true : undefined}
          className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive"
        >
          {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
          {value && !zones.includes(value) && <option value={value}>{value}</option>}
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-60" />
      </div>
      {hint && !errors?.length && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}
