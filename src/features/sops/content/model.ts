/** Rich-text sections of an SOP, in reading order. */
export const SECTION_KEYS = ["purpose", "scope", "materials", "procedure", "responsibilities", "notes"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<SectionKey, { label: string; hint: string }> = {
  purpose: { label: "Purpose", hint: "Why this procedure exists and what it achieves." },
  scope: { label: "Scope", hint: "When it applies, and who or what it covers." },
  materials: { label: "Required materials", hint: "Tools, documents, access or equipment needed." },
  procedure: { label: "Procedure overview", hint: "The big picture. Add detailed steps below." },
  responsibilities: { label: "Responsibilities", hint: "Who does what, and who signs off." },
  notes: { label: "Additional notes", hint: "Tips, exceptions, safety notes and references." },
};

/** Minimal Tiptap/ProseMirror JSON shape. */
export type RichMark = { type: string; attrs?: Record<string, unknown> };
export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
};
export type RichDoc = RichNode & { type: "doc" };

export type Sections = Partial<Record<SectionKey, RichDoc>>;

export type SopStep = {
  title: string;
  instructions: string;
  notes: string;
  attachment_id: string | null;
};

export const EMPTY_DOC: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };

/** Plain text of a rich-text value (for search, diffs and emptiness checks). */
export function docText(node: RichNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const parts = (node.content ?? []).map(docText);
  const block = ["paragraph", "heading", "listItem", "taskItem", "blockquote", "tableRow", "doc"].includes(node.type);
  return block ? parts.join(node.type === "tableRow" ? " | " : "\n").trim() : parts.join(node.type === "table" ? "\n" : "");
}

export function isDocEmpty(doc: RichNode | null | undefined): boolean {
  if (!doc) return true;
  const hasMedia = (n: RichNode): boolean => n.type === "image" || n.type === "table" || n.type === "horizontalRule" || (n.content ?? []).some(hasMedia);
  return docText(doc).trim().length === 0 && !hasMedia(doc);
}

export type SopContent = {
  title: string;
  description: string;
  categoryName: string | null;
  sections: Sections;
  steps: SopStep[];
};
