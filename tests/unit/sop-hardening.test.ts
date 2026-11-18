import { afterEach, describe, expect, it } from "vitest";
import { confirmNavigation, hasUnsavedChanges, registerUnsavedGuard, UNSAVED_MESSAGE } from "@/lib/unsaved-changes";
import { backupDiffers, backupKey, parseBackup, serializeBackup, type DraftContent } from "@/features/sops/content/draft-backup";
import { attachmentUrl, INLINE_TYPES, SIGNED_URL_TTL_SECONDS } from "@/features/sops/attachment-url";
import { describeActivity } from "@/features/dashboard/activity";
import { saveDraftSchema } from "@/features/sops/schemas";

const content: DraftContent = {
  title: "Closing",
  description: "",
  categoryId: null,
  ownerId: null,
  requiresAck: false,
  sections: { purpose: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Lock up" }] }] } },
  steps: [{ title: "Alarm", instructions: "", notes: "", attachment_id: null }],
};

describe("unsaved-changes guard", () => {
  let unregister: (() => void) | null = null;
  afterEach(() => unregister?.());

  it("allows navigation when nothing is registered or nothing is unsaved", () => {
    expect(confirmNavigation(() => false)).toBe(true);
    unregister = registerUnsavedGuard(() => false);
    expect(confirmNavigation(() => false)).toBe(true);
  });

  it("asks when there are unsaved changes and respects the answer", () => {
    unregister = registerUnsavedGuard(() => true);
    let asked = "";
    expect(confirmNavigation((m) => ((asked = m), false))).toBe(false);
    expect(asked).toBe(UNSAVED_MESSAGE);
    expect(confirmNavigation(() => true)).toBe(true);
  });

  it("unregistering only removes its own guard", () => {
    const first = registerUnsavedGuard(() => true);
    unregister = registerUnsavedGuard(() => true);
    first();
    expect(hasUnsavedChanges()).toBe(true);
    unregister();
    unregister = null;
    expect(hasUnsavedChanges()).toBe(false);
  });
});

describe("draft backup", () => {
  it("round-trips and is keyed per SOP", () => {
    const raw = serializeBackup(content, 1000);
    expect(parseBackup(raw, 2000)).toEqual({ version: 1, savedAt: 1000, content });
    expect(backupKey("abc")).toBe("tinyops:sop-draft-backup:abc");
  });

  it("rejects corrupt, foreign and stale data", () => {
    expect(parseBackup(null)).toBeNull();
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ version: 2, savedAt: 1, content }))).toBeNull();
    expect(parseBackup(JSON.stringify({ version: 1, savedAt: 1, content: { ...content, steps: "x" } }), 2)).toBeNull();
    const old = serializeBackup(content, 0);
    expect(parseBackup(old, 15 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("detects real differences but ignores key order and step keys", () => {
    const reordered = { ...content, sections: JSON.parse(JSON.stringify(content.sections)) } as DraftContent;
    expect(backupDiffers(reordered, content)).toBe(false);
    const withKeys = { ...content, steps: content.steps.map((s) => ({ ...s, key: "x" })) } as DraftContent;
    expect(backupDiffers(withKeys, content)).toBe(false);
    expect(backupDiffers({ ...content, title: "Closing (edited)" }, content)).toBe(true);
    expect(backupDiffers({ ...content, requiresAck: true }, content)).toBe(true);
  });
});

describe("attachment gateway URLs", () => {
  it("never points at storage directly", () => {
    expect(attachmentUrl("11111111-2222-4333-8444-555555555555")).toBe("/api/sops/attachments/11111111-2222-4333-8444-555555555555");
    expect(attachmentUrl("id", true)).toBe("/api/sops/attachments/id?download=1");
  });

  it("uses a short signed-URL lifetime and only shows safe types inline", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(60);
    expect(INLINE_TYPES.has("application/pdf")).toBe(true);
    expect(INLINE_TYPES.has("text/plain")).toBe(false);
    expect(INLINE_TYPES.has("image/svg+xml")).toBe(false);
  });
});

describe("SOP activity text (H1)", () => {
  it("uses the live title when the viewer may see it", () => {
    expect(describeActivity({ action: "sop.published", metadata: { version: 2 }, entityTitle: "Closing" }).text).toBe("published “Closing” (v2)");
  });

  it("never falls back to titles stored in old metadata", () => {
    const text = describeActivity({ action: "sop.created", metadata: { title: "CONFIDENTIAL" }, entityTitle: null }).text;
    expect(text).toBe("started a new SOP");
    expect(describeActivity({ action: "sop.archived", metadata: {}, entityTitle: null }).text).toBe("archived an SOP");
    expect(text).not.toContain("CONFIDENTIAL");
  });
});

describe("save payload (M6)", () => {
  it("requires a save id and caps unconfirmed ids", () => {
    const base = {
      sopId: "11111111-2222-4333-8444-555555555555",
      revision: 1,
      title: "T",
      description: "",
      categoryId: null,
      ownerId: null,
      requiresAcknowledgment: false,
      sections: {},
      steps: [],
      saveId: "aaaaaaaa-0000-4000-8000-000000000001",
      unconfirmedSaveIds: [],
    };
    expect(saveDraftSchema.safeParse(base).success).toBe(true);
    expect(saveDraftSchema.safeParse({ ...base, saveId: "nope" }).success).toBe(false);
    expect(saveDraftSchema.safeParse({ ...base, unconfirmedSaveIds: Array(21).fill(base.saveId) }).success).toBe(false);
  });
});
