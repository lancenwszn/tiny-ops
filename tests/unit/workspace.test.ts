import { describe, expect, it } from "vitest";
import { workspaceDetailsSchema, brandingPathSchema } from "@/features/workspaces/schemas";
import { greetingForHour, isValidTimezone } from "@/lib/dates/timezones";
import { friendlyError } from "@/lib/forms";
import { initials } from "@/lib/utils";

describe("workspaceDetailsSchema", () => {
  it("accepts valid details", () => {
    expect(workspaceDetailsSchema.safeParse({ name: "ABC Coffee", timezone: "Africa/Lagos", description: "" }).success).toBe(true);
  });
  it("rejects unknown timezones and short names", () => {
    expect(workspaceDetailsSchema.safeParse({ name: "ABC", timezone: "Mars/Base" }).success).toBe(false);
    expect(workspaceDetailsSchema.safeParse({ name: "A", timezone: "UTC" }).success).toBe(false);
  });
});

describe("brandingPathSchema", () => {
  const schema = brandingPathSchema("workspaces/123/");
  it("accepts files in the workspace folder", () => {
    expect(schema.safeParse("workspaces/123/1700000000.png").success).toBe(true);
  });
  it.each(["workspaces/456/x.png", "workspaces/123/../456/x.png", "users/123/x.png", "workspaces/123/<script>.png"])(
    "rejects %s",
    (p) => expect(schema.safeParse(p).success).toBe(false),
  );
});

describe("helpers", () => {
  it("greets by hour", () => {
    expect(greetingForHour(8)).toBe("Good morning");
    expect(greetingForHour(13)).toBe("Good afternoon");
    expect(greetingForHour(20)).toBe("Good evening");
    expect(greetingForHour(2)).toBe("Good evening");
  });
  it("validates timezones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Nowhere/Land")).toBe(false);
  });
  it("only surfaces user-facing database messages", () => {
    expect(friendlyError({ code: "P0001", message: "Your plan allows up to 5 members." })).toBe("Your plan allows up to 5 members.");
    expect(friendlyError({ code: "42501", message: "new row violates row-level security policy" })).toBe("You don't have permission to do that.");
    expect(friendlyError({ code: "XX000", message: "internal detail" })).toBe("Something went wrong. Please try again.");
  });
  it("builds initials", () => {
    expect(initials("Ayesha Khan")).toBe("AK");
    expect(initials("Cher")).toBe("C");
    expect(initials("  ")).toBe("?");
  });
});
