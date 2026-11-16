import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["member", "admin"], { message: "Choose a role" }),
});
