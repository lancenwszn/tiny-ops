import type { RichDoc, RichMark, RichNode, Sections, SectionKey } from "./model";
import { SECTION_KEYS } from "./model";

/**
 * Allowlist sanitizer for Tiptap JSON. Runs on every save (server) and again
 * at render time, so stored content can never inject markup, scripts,
 * javascript: links or external tracking images.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DEPTH = 24;
const MAX_NODES = 6000;
const MAX_TEXT = 20_000;

const BLOCKS_WITH_CONTENT = new Set([
  "doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "taskList", "taskItem",
  "blockquote", "table", "tableRow", "tableHeader", "tableCell",
]);
const LEAVES = new Set(["text", "horizontalRule", "hardBreak", "image"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);

export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const value = href.trim();
  if (value.length === 0 || value.length > 2000) return null;
  if (/^(https?:\/\/|mailto:)/i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

function cleanMarks(marks: unknown): RichMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: RichMark[] = [];
  for (const m of marks) {
    if (!m || typeof m !== "object" || !MARKS.has((m as RichMark).type)) continue;
    const mark = m as RichMark;
    if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (href) out.push({ type: "link", attrs: { href } });
    } else {
      out.push({ type: mark.type });
    }
  }
  return out.length ? out : undefined;
}

function int(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function cleanAttrs(type: string, attrs: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  switch (type) {
    case "heading":
      return { level: int(attrs?.level, 2, 3, 2) };
    case "orderedList":
      return { start: int(attrs?.start, 1, 10_000, 1) };
    case "taskItem":
      return { checked: attrs?.checked === true };
    case "tableCell":
    case "tableHeader":
      return { colspan: int(attrs?.colspan, 1, 20, 1), rowspan: int(attrs?.rowspan, 1, 50, 1) };
    case "image": {
      const id = typeof attrs?.attachmentId === "string" && UUID.test(attrs.attachmentId) ? attrs.attachmentId : null;
      if (!id) return undefined;
      const alt = typeof attrs?.alt === "string" ? attrs.alt.slice(0, 200) : "";
      return { attachmentId: id, alt };
    }
    default:
      return undefined;
  }
}

export function sanitizeNode(input: unknown, depth = 0, budget = { nodes: 0 }): RichNode | null {
  if (!input || typeof input !== "object" || depth > MAX_DEPTH) return null;
  if (++budget.nodes > MAX_NODES) return null;
  const node = input as RichNode;
  const type = node.type;
  if (typeof type !== "string" || (!BLOCKS_WITH_CONTENT.has(type) && !LEAVES.has(type))) return null;

  if (type === "text") {
    if (typeof node.text !== "string" || node.text.length === 0) return null;
    const out: RichNode = { type: "text", text: node.text.slice(0, MAX_TEXT) };
    const marks = cleanMarks(node.marks);
    if (marks) out.marks = marks;
    return out;
  }

  const out: RichNode = { type };
  const attrs = cleanAttrs(type, node.attrs);
  if (type === "image") {
    if (!attrs) return null; // only images that reference an SOP attachment
    out.attrs = attrs;
    return out;
  }
  if (attrs) out.attrs = attrs;
  if (LEAVES.has(type)) return out;

  if (Array.isArray(node.content)) {
    const children = node.content.map((c) => sanitizeNode(c, depth + 1, budget)).filter((c): c is RichNode => c !== null);
    if (children.length) out.content = children;
  }
  return out;
}

export function sanitizeDoc(input: unknown): RichDoc | null {
  const node = sanitizeNode(input);
  if (!node || node.type !== "doc") return null;
  return node as RichDoc;
}

/** Keeps only known sections with valid documents. */
export function sanitizeSections(input: unknown): Sections {
  const out: Sections = {};
  if (!input || typeof input !== "object") return out;
  for (const key of SECTION_KEYS) {
    const doc = sanitizeDoc((input as Record<string, unknown>)[key]);
    if (doc) out[key as SectionKey] = doc;
  }
  return out;
}

/** Attachment ids referenced by images in the sections. */
export function referencedAttachmentIds(sections: Sections): string[] {
  const ids = new Set<string>();
  const walk = (n: RichNode) => {
    if (n.type === "image" && typeof n.attrs?.attachmentId === "string") ids.add(n.attrs.attachmentId);
    n.content?.forEach(walk);
  };
  Object.values(sections).forEach((d) => d && walk(d));
  return [...ids];
}
