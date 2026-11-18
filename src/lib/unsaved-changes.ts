/**
 * App-wide unsaved-changes guard. An editor registers a check; anything that
 * navigates without a plain link (workspace switcher, command palette,
 * sign-out) calls confirmNavigation() first. Links are intercepted by the
 * editor itself, and tab close is covered by `beforeunload`.
 */
export const UNSAVED_MESSAGE = "You have changes that haven't been saved yet. Leave this page anyway?";

let guard: (() => boolean) | null = null;

/** Registers a "has unsaved changes" check. Returns an unregister function. */
export function registerUnsavedGuard(hasUnsaved: () => boolean): () => void {
  guard = hasUnsaved;
  return () => {
    if (guard === hasUnsaved) guard = null;
  };
}

export function hasUnsavedChanges(): boolean {
  return guard?.() ?? false;
}

/** True if navigation may proceed (nothing unsaved, or the user confirmed). */
export function confirmNavigation(confirm: (message: string) => boolean = (m) => window.confirm(m)): boolean {
  return !hasUnsavedChanges() || confirm(UNSAVED_MESSAGE);
}
