import { diffWords, hasChanges, type DiffPart } from "./diff";
import { SECTION_KEYS, SECTION_META, docText, type SopContent } from "./model";

function stepsText(c: SopContent) {
  return c.steps
    .map((s, i) => [`${i + 1}. ${s.title}`, s.instructions, s.notes ? `Note: ${s.notes}` : ""].filter(Boolean).join("\n"))
    .join("\n\n");
}

/** Per-field word diff between two versions; unchanged fields are omitted. */
export function compareContent(a: SopContent, b: SopContent): { label: string; parts: DiffPart[] }[] {
  const fields = [
    { label: "Title", parts: diffWords(a.title, b.title) },
    { label: "Description", parts: diffWords(a.description, b.description) },
    ...SECTION_KEYS.map((k) => ({ label: SECTION_META[k].label, parts: diffWords(docText(a.sections[k]), docText(b.sections[k])) })),
    { label: "Steps", parts: diffWords(stepsText(a), stepsText(b)) },
  ];
  return fields.filter((f) => hasChanges(f.parts));
}
