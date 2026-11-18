import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { safeHref, sanitizeDoc, sanitizeSections, referencedAttachmentIds } from "@/features/sops/content/sanitize";
import { RichText } from "@/features/sops/content/rich-text";
import { diffWords, hasChanges } from "@/features/sops/content/diff";
import { compareContent } from "@/features/sops/content/compare";
import { docText, isDocEmpty, type RichDoc, type SopContent } from "@/features/sops/content/model";
import { moveItem } from "@/features/sops/content/list";
import { attachmentSchema, createSopSchema, isValidAttachmentPath, saveDraftSchema, formatBytes } from "@/features/sops/schemas";

const ID = "11111111-2222-4333-8444-555555555555";
const p = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
const doc = (...content: unknown[]) => ({ type: "doc", content }) as RichDoc;
const render = (d: unknown, imageUrls = {}) => renderToStaticMarkup(createElement(RichText, { doc: d, imageUrls }));

describe("safeHref", () => {
  it.each(["https://example.com/a?b=1", "http://x.co", "mailto:hi@example.com"])("allows %s", (h) => expect(safeHref(h)).not.toBeNull());
  it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", " javascript:alert(1)", "data:text/html,<script>", "vbscript:x", "/relative", "//evil.com", "", 42])(
    "rejects %s",
    (h) => expect(safeHref(h)).toBeNull(),
  );
});

describe("sanitizeDoc", () => {
  it("keeps supported structure", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Opening" }] },
      p("Bold", [{ type: "bold" }]),
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p("Done")] }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 2 }, content: [p("H")] }] }] },
      { type: "horizontalRule" },
    );
    const out = sanitizeDoc(input);
    // Table cells get explicit defaults for missing span attributes.
    expect(out?.content?.[3]).toEqual({
      type: "table",
      content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 2, rowspan: 1 }, content: [p("H")] }] }],
    });
    expect(out?.content?.slice(0, 3)).toEqual(input.content?.slice(0, 3));
    expect(out?.content?.[4]).toEqual({ type: "horizontalRule" });
  });

  it("drops unknown nodes, marks and attributes", () => {
    const out = sanitizeDoc(
      doc(
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        { type: "paragraph", attrs: { onclick: "x", style: "color:red" }, content: [{ type: "text", text: "Hi", marks: [{ type: "evil" }, { type: "italic", attrs: { x: 1 } }] }] },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H1" }] },
      ),
    );
    expect(out).toEqual(
      doc(
        { type: "paragraph", content: [{ type: "text", text: "Hi", marks: [{ type: "italic" }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H1" }] },
      ),
    );
  });

  it("strips unsafe links and keeps safe ones (normalised)", () => {
    const out = sanitizeDoc(doc(p("bad", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]), p("good", [{ type: "link", attrs: { href: "https://example.com", target: "_self" } }])));
    expect(out?.content?.[0].content?.[0].marks).toBeUndefined();
    expect(out?.content?.[1].content?.[0].marks).toEqual([{ type: "link", attrs: { href: "https://example.com/" } }]);
  });

  it("only allows images that reference an attachment id", () => {
    const out = sanitizeDoc(doc({ type: "image", attrs: { src: "https://tracker.example/pixel.gif" } }, { type: "image", attrs: { attachmentId: ID, alt: "Till", src: "x" } }));
    expect(out?.content).toEqual([{ type: "image", attrs: { attachmentId: ID, alt: "Till" } }]);
  });

  it("rejects non-documents and limits depth", () => {
    expect(sanitizeDoc({ type: "paragraph" })).toBeNull();
    expect(sanitizeDoc("nope")).toBeNull();
    let deep: Record<string, unknown> = p("x");
    for (let i = 0; i < 40; i++) deep = { type: "blockquote", content: [deep] };
    const out = sanitizeDoc(doc(deep));
    expect(JSON.stringify(out)).not.toContain('"text":"x"');
  });

  it("keeps only known sections and lists referenced images", () => {
    const sections = sanitizeSections({ purpose: doc({ type: "image", attrs: { attachmentId: ID } }), hacker: doc(p("x")), scope: "not a doc" });
    expect(Object.keys(sections)).toEqual(["purpose"]);
    expect(referencedAttachmentIds(sections)).toEqual([ID]);
  });
});

describe("RichText renderer", () => {
  it("renders safe HTML elements", () => {
    const html = render(doc(p("Hello", [{ type: "bold" }]), { type: "bulletList", content: [{ type: "listItem", content: [p("One")] }] }));
    expect(html).toContain("<strong>Hello</strong>");
    expect(html).toContain("<ul><li><p>One</p></li></ul>");
  });

  it("escapes text and never renders unsafe links, even from raw stored JSON", () => {
    const html = render(doc(p("<img src=x onerror=alert(1)>"), p("click", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("javascript:");
  });

  it("adds rel=noopener to links and resolves images to signed URLs", () => {
    const html = render(doc(p("site", [{ type: "link", attrs: { href: "https://example.com" } }]), { type: "image", attrs: { attachmentId: ID, alt: "Till" } }), {
      [ID]: "https://storage.example/signed?token=1",
    });
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('src="https://storage.example/signed?token=1"');
  });

  it("shows a placeholder for images the reader cannot access", () => {
    expect(render(doc({ type: "image", attrs: { attachmentId: ID } }))).toContain("Image unavailable");
  });

  it("renders nothing for empty documents", () => {
    expect(render(doc())).toBe("");
  });
});

describe("content helpers", () => {
  it("extracts plain text and detects empty documents", () => {
    expect(docText(doc(p("A"), p("B")))).toBe("A\nB");
    expect(isDocEmpty(doc({ type: "paragraph" }))).toBe(true);
    expect(isDocEmpty(doc({ type: "horizontalRule" }))).toBe(false);
    expect(isDocEmpty(undefined)).toBe(true);
  });

  it("reorders steps", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    const same = ["a", "b"];
    expect(moveItem(same, 0, 5)).toBe(same);
    expect(moveItem(same, -1, 0)).toBe(same);
  });
});

describe("diff and compare", () => {
  it("diffs word by word, treating punctuation separately", () => {
    const parts = diffWords("a working till and fresh coffee", "a working till, fresh coffee");
    expect(parts.filter((x) => x.type === "del").map((x) => x.text.trim())).toEqual(["and"]);
    expect(parts.filter((x) => x.type === "add").map((x) => x.text)).toEqual([","]);
    expect(hasChanges(diffWords("same", "same"))).toBe(false);
  });

  it("reconstructs both sides", () => {
    const a = "Count the float twice.";
    const b = "Count the float and log it.";
    const parts = diffWords(a, b);
    expect(parts.filter((x) => x.type !== "add").map((x) => x.text).join("")).toBe(a);
    expect(parts.filter((x) => x.type !== "del").map((x) => x.text).join("")).toBe(b);
  });

  it("falls back to whole replacement for huge inputs", () => {
    const big = "word ".repeat(1000);
    expect(diffWords(big, big + "x").length).toBe(2);
  });

  it("compares versions field by field", () => {
    const base: SopContent = { title: "Opening", description: "", categoryName: null, sections: { purpose: doc(p("Open at 7")) }, steps: [{ title: "Unlock", instructions: "", notes: "", attachment_id: null }] };
    const next: SopContent = { ...base, sections: { purpose: doc(p("Open at 7:00 sharp")) }, steps: [...base.steps, { title: "Lights", instructions: "", notes: "", attachment_id: null }] };
    expect(compareContent(base, next).map((c) => c.label)).toEqual(["Purpose", "Steps"]);
    expect(compareContent(base, base)).toEqual([]);
  });
});

describe("SOP schemas", () => {
  it("validates new SOPs", () => {
    expect(createSopSchema.safeParse({ title: "Opening", categoryId: "", description: "" }).data?.categoryId).toBeNull();
    expect(createSopSchema.safeParse({ title: "A", categoryId: "", description: "" }).success).toBe(false);
    expect(createSopSchema.safeParse({ title: "Opening", categoryId: "not-a-uuid", description: "" }).success).toBe(false);
  });

  it("limits steps and requires a title when saving", () => {
    const base = { sopId: ID, revision: 0, title: "T", description: "", categoryId: null, ownerId: null, requiresAcknowledgment: false, sections: {}, steps: [], saveId: "aaaaaaaa-0000-4000-8000-000000000001", unconfirmedSaveIds: [] };
    expect(saveDraftSchema.safeParse(base).success).toBe(true);
    expect(saveDraftSchema.safeParse({ ...base, title: "  " }).success).toBe(false);
    const step = { title: "s", instructions: "", notes: "", attachment_id: null };
    expect(saveDraftSchema.safeParse({ ...base, steps: Array(101).fill(step) }).success).toBe(false);
  });

  it("validates attachment uploads", () => {
    const ok = { sopId: ID, path: "x", fileName: "a.pdf", mimeType: "application/pdf", size: 1000 };
    expect(attachmentSchema.safeParse(ok).success).toBe(true);
    expect(attachmentSchema.safeParse({ ...ok, mimeType: "text/html" }).success).toBe(false);
    expect(attachmentSchema.safeParse({ ...ok, mimeType: "image/svg+xml" }).success).toBe(false);
    expect(attachmentSchema.safeParse({ ...ok, size: 11 * 1024 * 1024 }).success).toBe(false);
  });

  it("only accepts storage paths inside the SOP's own folder", () => {
    const ws = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const file = `${ws}/${ID}/0b4f7c1e-1111-4222-8333-444455556666.pdf`;
    expect(isValidAttachmentPath(file, ws, ID, "application/pdf")).toBe(true);
    expect(isValidAttachmentPath(file, ws, ID, "image/png")).toBe(false);
    expect(isValidAttachmentPath(`${ws}/${ID}/../other/x.pdf`, ws, ID, "application/pdf")).toBe(false);
    expect(isValidAttachmentPath(`bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/${ID}/0b4f7c1e-1111-4222-8333-444455556666.pdf`, ws, ID, "application/pdf")).toBe(false);
    expect(formatBytes(1536)).toBe("2 KB");
  });
});
