import type { Sections, SopStep } from "./model";

/**
 * Local (this device) backup of editor content that has not been confirmed
 * as saved. Protects against crashes, the browser back button, lost
 * connections and conflicts. Per-viewer convenience only — the server copy
 * is the source of truth.
 */
export type DraftContent = {
  title: string;
  description: string;
  categoryId: string | null;
  ownerId: string | null;
  requiresAck: boolean;
  sections: Sections;
  steps: SopStep[];
};

export type DraftBackup = { version: 1; savedAt: number; content: DraftContent };

export const backupKey = (sopId: string) => `tinyops:sop-draft-backup:${sopId}`;

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function serializeBackup(content: DraftContent, now = Date.now()): string {
  return JSON.stringify({ version: 1, savedAt: now, content } satisfies DraftBackup);
}

/** Parses and validates a stored backup; returns null for anything unusable or stale. */
export function parseBackup(raw: string | null | undefined, now = Date.now()): DraftBackup | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<DraftBackup>;
    const c = data.content as Partial<DraftContent> | undefined;
    if (data.version !== 1 || typeof data.savedAt !== "number" || !c) return null;
    if (now - data.savedAt > MAX_AGE_MS) return null;
    if (typeof c.title !== "string" || typeof c.description !== "string" || typeof c.requiresAck !== "boolean") return null;
    if (!c.sections || typeof c.sections !== "object" || !Array.isArray(c.steps)) return null;
    return data as DraftBackup;
  } catch {
    return null;
  }
}

/** Order-insensitive JSON for comparing content. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function normalizeContent(c: DraftContent): DraftContent {
  return {
    title: c.title,
    description: c.description,
    categoryId: c.categoryId ?? null,
    ownerId: c.ownerId ?? null,
    requiresAck: c.requiresAck,
    sections: c.sections,
    steps: c.steps.map(({ title, instructions, notes, attachment_id }) => ({ title, instructions, notes, attachment_id: attachment_id ?? null })),
  };
}

/** True when the backup holds something the server copy does not. */
export function backupDiffers(backup: DraftContent, server: DraftContent): boolean {
  return stable(normalizeContent(backup)) !== stable(normalizeContent(server));
}
