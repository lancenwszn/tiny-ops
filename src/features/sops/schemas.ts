import { z } from "zod";

const uuid = z.uuid();

export const SOP_STATUSES = ["draft", "published", "archived"] as const;
export type SopStatus = (typeof SOP_STATUSES)[number];

export const SOP_SORTS = ["updated", "title", "created", "published"] as const;
export type SopSort = (typeof SOP_SORTS)[number];

export const createSopSchema = z.object({
  title: z.string().trim().min(2, "Use at least 2 characters").max(160, "Use 160 characters or fewer"),
  categoryId: z.union([z.literal(""), uuid]).transform((v) => v || null),
  description: z.string().trim().max(500, "Use 500 characters or fewer").default(""),
});

export const stepSchema = z.object({
  title: z.string().trim().max(160, "Step titles can be up to 160 characters"),
  instructions: z.string().max(5000, "Step instructions can be up to 5,000 characters"),
  notes: z.string().max(2000, "Step notes can be up to 2,000 characters"),
  attachment_id: uuid.nullable(),
});

export const saveDraftSchema = z.object({
  sopId: uuid,
  revision: z.number().int().min(0),
  title: z.string().trim().min(1, "Give the SOP a title").max(160, "Titles can be up to 160 characters"),
  description: z.string().trim().max(500, "Descriptions can be up to 500 characters"),
  categoryId: uuid.nullable(),
  ownerId: uuid.nullable(),
  requiresAcknowledgment: z.boolean(),
  sections: z.record(z.string(), z.unknown()),
  steps: z.array(stepSchema).max(100, "An SOP can have up to 100 steps"),
});
export type SaveDraftInput = z.input<typeof saveDraftSchema>;

export const accessSchema = z.object({
  sopId: uuid,
  visibility: z.enum(["workspace", "restricted"]),
  membersRole: z.boolean(),
  userIds: z.array(uuid).max(200),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(60, "Use 60 characters or fewer"),
  description: z.string().trim().max(300, "Use 300 characters or fewer").default(""),
  color: z.enum(["green", "violet", "coral", "sky", "amber", "muted"]).default("green"),
});

export const ATTACHMENT_TYPES: Record<string, { ext: string; label: string; image?: boolean }> = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "image/png": { ext: "png", label: "PNG image", image: true },
  "image/jpeg": { ext: "jpg", label: "JPEG image", image: true },
  "image/webp": { ext: "webp", label: "WebP image", image: true },
  "image/gif": { ext: "gif", label: "GIF image", image: true },
  "text/plain": { ext: "txt", label: "Text file" },
  "text/csv": { ext: "csv", label: "CSV file" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", label: "Word document" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", label: "Excel spreadsheet" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", label: "PowerPoint" },
};
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const attachmentSchema = z.object({
  sopId: uuid,
  path: z.string().max(500),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().refine((t) => t in ATTACHMENT_TYPES, "This file type isn't supported"),
  size: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES, "Files must be 10 MB or smaller"),
});

export function attachmentPathPrefix(workspaceId: string, sopId: string) {
  return `${workspaceId}/${sopId}/`;
}

/** Validates a storage path produced by the uploader: <ws>/<sop>/<uuid>.<ext> */
export function isValidAttachmentPath(path: string, workspaceId: string, sopId: string, mimeType: string) {
  const ext = ATTACHMENT_TYPES[mimeType]?.ext;
  if (!ext) return false;
  const prefix = attachmentPathPrefix(workspaceId, sopId);
  if (!path.startsWith(prefix)) return false;
  return /^[0-9a-f-]{36}\.[a-z0-9]+$/.test(path.slice(prefix.length)) && path.endsWith(`.${ext}`);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
