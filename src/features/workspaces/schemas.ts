import { z } from "zod";
import { isValidTimezone } from "@/lib/dates/timezones";

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Choose a timezone")
  .refine(isValidTimezone, "Choose a valid timezone");

export const workspaceDetailsSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(80, "Use 80 characters or fewer"),
  timezone: timezoneSchema,
  description: z.string().trim().max(500, "Use 500 characters or fewer").default(""),
});

export const brandingPathSchema = (prefix: string) =>
  z
    .string()
    .max(500)
    .refine((p) => p.startsWith(prefix) && !p.includes("..") && /^[\w\-./]+$/.test(p), "Invalid file path");
