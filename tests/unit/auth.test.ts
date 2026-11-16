import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/redirect";
import { resetPasswordSchema, signUpSchema } from "@/features/auth/schemas";

describe("safeNext", () => {
  it.each([
    ["/app/settings", "/app/settings"],
    ["/invite/abc?x=1", "/invite/abc?x=1"],
  ])("allows relative path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", "/\u0000x", 42, undefined, "/" + "a".repeat(600)])(
    "rejects %s",
    (input) => {
      expect(safeNext(input)).toBe("/app/dashboard");
    },
  );
});

describe("signUpSchema", () => {
  it("normalises email and trims the name", () => {
    const r = signUpSchema.parse({ fullName: "  Ayesha Khan ", email: " Ayesha@Example.COM ", password: "Organized1" });
    expect(r).toEqual({ fullName: "Ayesha Khan", email: "ayesha@example.com", password: "Organized1" });
  });

  it("requires letters and digits in passwords", () => {
    expect(signUpSchema.safeParse({ fullName: "Al Bo", email: "a@b.co", password: "allletters" }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: "Al Bo", email: "a@b.co", password: "12345678" }).success).toBe(false);
  });

  it("rejects passwords longer than bcrypt's 72 byte limit", () => {
    expect(signUpSchema.safeParse({ fullName: "Al Bo", email: "a@b.co", password: "a1".repeat(40) }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const r = resetPasswordSchema.safeParse({ password: "Organized1", confirmPassword: "Organized2" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["confirmPassword"]);
  });
});
