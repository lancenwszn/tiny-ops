export type DiffPart = { type: "same" | "add" | "del"; text: string };

const MAX_CELLS = 400_000;

function tokenize(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
}

/**
 * Word-level diff (LCS) for comparing SOP revisions. Falls back to a whole
 * replace for very large inputs to keep it fast and memory-safe.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ type: "same", text: before }] : [];
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...(before ? [{ type: "del" as const, text: before }] : []),
      ...(after ? [{ type: "add" as const, text: after }] : []),
    ];
  }

  // dp[i][j] = LCS length of a[i:], b[j:]
  const dp: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return parts;
}

export function hasChanges(parts: DiffPart[]) {
  return parts.some((p) => p.type !== "same");
}
