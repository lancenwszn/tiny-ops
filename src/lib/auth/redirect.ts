/**
 * Returns a same-origin relative path, or the fallback. Prevents open
 * redirects through ?next= parameters ("//evil.com", "/\\evil.com", "https://…").
 */
export function safeNext(next: unknown, fallback = "/app/dashboard"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
