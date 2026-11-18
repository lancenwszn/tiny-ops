"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, CloudOff, Eye, History, Info, Loader2, RefreshCw, RotateCcw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RelativeTime } from "@/components/shared/relative-time";
import { useIsClient } from "@/hooks/use-is-client";
import { UNSAVED_MESSAGE, registerUnsavedGuard } from "@/lib/unsaved-changes";
import { RichTextEditor, type ImageOption } from "./rich-text-editor";
import { StepsEditor, type EditorStep } from "./steps-editor";
import { AttachmentManager, type ClientAttachment } from "./attachments";
import { AccessCard } from "./access-card";
import { PublishDialog } from "./publish-dialog";
import { SopStatusBadge, UnpublishedBadge } from "./sop-badges";
import { publishSopAction, saveSopDraftAction } from "../actions";
import { SECTION_KEYS, SECTION_META, type RichDoc, type Sections, type SopStep } from "../content/model";
import { backupDiffers, backupKey, parseBackup, serializeBackup, type DraftContent } from "../content/draft-backup";
import type { PersonRef, SopCategory } from "../queries";
import type { SopStatus } from "../schemas";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

export type SopEditorProps = {
  sopId: string;
  workspaceId: string;
  status: SopStatus;
  currentVersion: number;
  initial: {
    title: string;
    description: string;
    categoryId: string | null;
    ownerId: string | null;
    requiresAcknowledgment: boolean;
    sections: Sections;
    steps: SopStep[];
    revision: number;
    updatedAt: string;
    dirty: boolean;
  };
  attachments: ClientAttachment[];
  imageUrls: Record<string, string>;
  categories: SopCategory[];
  members: (PersonRef & { role: string })[];
  access: { visibility: "workspace" | "restricted"; membersRole: boolean; userIds: string[] };
};

const AUTOSAVE_MS = 1500;
const UNSAVED_STATES: SaveState[] = ["dirty", "saving", "error", "conflict"];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota): the server copy still applies.
  }
}

export function SopEditor(props: SopEditorProps) {
  const router = useRouter();
  const { sopId, initial } = props;
  const archived = props.status === "archived";

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [ownerId, setOwnerId] = useState(initial.ownerId);
  const [requiresAck, setRequiresAck] = useState(initial.requiresAcknowledgment);
  const [sections, setSections] = useState<Sections>(initial.sections);
  const [steps, setSteps] = useState<EditorStep[]>(() => initial.steps.map((s) => ({ ...s, key: crypto.randomUUID() })));
  const [attachments, setAttachments] = useState(props.attachments);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(initial.updatedAt);
  const [hasUnpublished, setHasUnpublished] = useState(initial.dirty);
  const [publishOpen, setPublishOpen] = useState(false);
  // Bumped to remount the rich-text editors after restoring a local backup.
  const [contentKey, setContentKey] = useState(0);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);

  const revision = useRef(initial.revision);
  // Save attempts whose responses were lost (the server may have applied them).
  const unconfirmed = useRef<string[]>([]);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const pendingAgain = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshot = useRef({ title, description, categoryId, ownerId, requiresAck, sections, steps });
  const stateRef = useRef(state);
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  const backupStorageKey = backupKey(sopId);

  // Keep refs in sync after each render (read by timers and event handlers).
  useLayoutEffect(() => {
    snapshot.current = { title, description, categoryId, ownerId, requiresAck, sections, steps };
    stateRef.current = state;
  });

  const content = (s = snapshot.current): DraftContent => ({
    title: s.title,
    description: s.description,
    categoryId: s.categoryId,
    ownerId: s.ownerId,
    requiresAck: s.requiresAck,
    sections: s.sections,
    steps: s.steps.map(({ title, instructions, notes, attachment_id }) => ({ title, instructions, notes, attachment_id })),
  });

  const save = useCallback(async (): Promise<boolean> => {
    if (stateRef.current === "conflict" || archived) return false;
    if (inFlight.current) {
      pendingAgain.current = true;
      return inFlight.current;
    }
    if (timer.current) clearTimeout(timer.current);
    const s = snapshot.current;
    const saveId = crypto.randomUUID();
    setState("saving");
    const run = (async () => {
      let lost = false;
      const res = await saveSopDraftAction({
        sopId,
        revision: revision.current,
        title: s.title.trim() || "Untitled SOP",
        description: s.description,
        categoryId: s.categoryId,
        ownerId: s.ownerId,
        requiresAcknowledgment: s.requiresAck,
        // Plain JSON copy: editor attrs objects aren't plain and can't cross the action boundary.
        sections: JSON.parse(JSON.stringify(s.sections)) as Sections,
        steps: s.steps.map(({ title, instructions, notes, attachment_id }) => ({ title, instructions, notes, attachment_id })),
        saveId,
        unconfirmedSaveIds: unconfirmed.current,
      }).catch(() => {
        lost = true;
        return { ok: false as const, error: "Connection lost. Your changes are kept on this device — we'll keep trying." };
      });
      inFlight.current = null;
      if (lost) unconfirmed.current = [...unconfirmed.current, saveId].slice(-20);
      if (res.ok) {
        unconfirmed.current = [];
        revision.current = res.revision;
        setLastSaved(res.savedAt);
        setHasUnpublished(true);
        setError(null);
        if (pendingAgain.current) {
          pendingAgain.current = false;
          setState("dirty");
          return saveRef.current();
        }
        setState("saved");
        writeStorage(backupKey(sopId), null);
        return true;
      }
      setError(res.error);
      setState("conflict" in res && res.conflict ? "conflict" : "error");
      return false;
    })();
    inFlight.current = run;
    return run;
  }, [sopId, archived]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Any edit marks the document dirty and (re)schedules an autosave.
  const markDirty = useCallback(() => {
    if (stateRef.current === "conflict" || archived) return;
    setState((s) => (s === "saving" ? s : "dirty"));
    if (inFlight.current) pendingAgain.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save, archived]);

  // Retry failed saves every 10 seconds.
  useEffect(() => {
    if (state !== "error") return;
    const t = setTimeout(() => void save(), 10_000);
    return () => clearTimeout(t);
  }, [state, save]);

  // Local backup of anything not yet confirmed as saved (this device only).
  // Cleared only after a save succeeds in this session (or the user discards
  // it), so a backup from an earlier visit survives until it can be offered.
  useEffect(() => {
    if (state !== "saved") writeStorage(backupStorageKey, serializeBackup(content({ title, description, categoryId, ownerId, requiresAck, sections, steps })));
  }, [state, title, description, categoryId, ownerId, requiresAck, sections, steps, backupStorageKey]);

  // Never lose work silently: guard links, other in-app navigation and tab close;
  // flush pending work when the page is hidden or the editor unmounts.
  useEffect(() => {
    const unsaved = () => UNSAVED_STATES.includes(stateRef.current);
    const unregister = registerUnsavedGuard(unsaved);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsaved()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.dataset.skipUnsaved !== undefined || !unsaved()) return;
      if (!window.confirm(UNSAVED_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden" && (stateRef.current === "dirty" || stateRef.current === "error")) void saveRef.current();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      // Leaving the editor (e.g. browser Back): save what's pending right away.
      if (timer.current) clearTimeout(timer.current);
      if (stateRef.current === "dirty" || stateRef.current === "error") void saveRef.current();
    };
  }, []);

  // ⌘S / Ctrl+S saves immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Offer to recover a local backup that differs from the server copy.
  const isClient = useIsClient();
  const recovery = useMemo(() => {
    if (!isClient || archived) return null;
    const backup = parseBackup(readStorage(backupStorageKey));
    if (!backup) return null;
    const server: DraftContent = {
      title: initial.title,
      description: initial.description,
      categoryId: initial.categoryId,
      ownerId: initial.ownerId,
      requiresAck: initial.requiresAcknowledgment,
      sections: initial.sections,
      steps: initial.steps,
    };
    return backupDiffers(backup.content, server) ? backup : null;
  }, [isClient, archived, backupStorageKey, initial]);

  function restoreBackup() {
    if (!recovery) return;
    const c = recovery.content;
    setTitle(c.title);
    setDescription(c.description);
    setCategoryId(c.categoryId);
    setOwnerId(c.ownerId);
    setRequiresAck(c.requiresAck);
    setSections(c.sections);
    setSteps(c.steps.map((s) => ({ ...s, key: crypto.randomUUID() })));
    setContentKey((k) => k + 1);
    setRecoveryDismissed(true);
    markDirty();
    toast.success("Unsaved changes restored. Saving…");
  }

  function discardBackup() {
    writeStorage(backupStorageKey, null);
    setRecoveryDismissed(true);
  }

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      markDirty();
    };
  }

  async function saveThen(href: string) {
    if (stateRef.current !== "saved" && !archived && !(await save())) return toast.error("Save failed — fix the problem before leaving.");
    router.push(href);
  }

  async function openPublish() {
    if (stateRef.current !== "saved" && !(await save())) return;
    setPublishOpen(true);
  }

  async function publish(note: string) {
    const res = await publishSopAction(sopId, note);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(`Version ${res.version} published`);
    setState("saved");
    router.push(`/app/sops/${sopId}`);
    return true;
  }

  const images: ImageOption[] = attachments.filter((a) => a.previewUrl).map((a) => ({ id: a.id, name: a.fileName, url: a.previewUrl! }));
  const imageUrls = { ...props.imageUrls, ...Object.fromEntries(images.map((i) => [i.id, i.url])) };
  const activeCategories = props.categories.filter((c) => !c.archivedAt || c.id === initial.categoryId);
  const locked = archived || state === "conflict";

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => void saveThen(`/app/sops/${sopId}`)}>
          <ArrowLeft /> Back to SOP
        </Button>
        {!archived && <SaveIndicator state={state} lastSaved={lastSaved} error={error} />}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/sops/${sopId}/history`}>
              <History /> History
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void saveThen(`/app/sops/${sopId}`)}>
            <Eye /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => void save()} disabled={state === "saving" || locked}>
            <Save /> Save
          </Button>
          <Button size="sm" onClick={() => void openPublish()} disabled={locked || (props.currentVersion > 0 && !hasUnpublished && state === "saved")}>
            <Send /> {props.currentVersion === 0 ? "Publish" : "Publish changes"}
          </Button>
        </div>
      </div>

      {recovery && !recoveryDismissed && state !== "conflict" && (
        <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-tint-amber-fg/30 bg-tint-amber px-4 py-3 text-sm" data-testid="recovery-banner">
          <RotateCcw className="size-4 text-tint-amber-fg" />
          <span className="flex-1">
            This device has unsaved changes to this SOP from <RelativeTime iso={new Date(recovery.savedAt).toISOString()} />. Restoring them
            replaces what is currently saved.
          </span>
          <Button size="sm" onClick={restoreBackup}>
            Restore my changes
          </Button>
          <Button size="sm" variant="outline" onClick={discardBackup}>
            Discard
          </Button>
        </div>
      )}
      {state === "conflict" && (
        <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-tint-coral px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          <span className="flex-1">
            {error} Your unsaved edits are kept on this device — after reloading you can choose to restore them.
          </span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw /> Reload latest
          </Button>
        </div>
      )}
      {archived && (
        <div role="status" className="mb-5 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          This SOP is archived and read-only. Restore it from the SOP page to edit it again.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={locked} className="grid min-w-0 gap-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <label htmlFor="sop-title" className="sr-only">
              Title
            </label>
            <input
              id="sop-title"
              value={title}
              maxLength={160}
              onChange={(e) => edit(setTitle)(e.target.value)}
              placeholder="SOP title"
              className="w-full bg-transparent text-2xl font-extrabold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-[30px]"
            />
            <Label htmlFor="sop-description" className="mt-4">
              Short description
            </Label>
            <Textarea
              id="sop-description"
              value={description}
              maxLength={500}
              rows={2}
              onChange={(e) => edit(setDescription)(e.target.value)}
              placeholder="One or two sentences about what this SOP covers."
              className="mt-1.5"
            />
          </div>

          {SECTION_KEYS.map((key) => (
            <RichTextEditor
              key={`${key}-${contentKey}`}
              label={SECTION_META[key].label}
              hint={SECTION_META[key].hint}
              value={sections[key]}
              images={images}
              imageUrls={imageUrls}
              editable={!locked}
              onChange={(doc: RichDoc) => edit(setSections)({ ...snapshot.current.sections, [key]: doc })}
            />
          ))}

          <StepsEditor steps={steps} attachments={attachments} onChange={edit(setSteps)} />
        </fieldset>

        <aside className="grid content-start gap-5">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card" aria-label="Details">
            <div className="flex flex-wrap items-center gap-2">
              <SopStatusBadge status={props.status} />
              {props.currentVersion > 0 && <span className="text-xs font-semibold text-muted-foreground">v{props.currentVersion} live</span>}
              {props.currentVersion > 0 && hasUnpublished && <UnpublishedBadge />}
            </div>
            <fieldset disabled={locked} className="mt-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="sop-category">Category</Label>
                <select
                  id="sop-category"
                  value={categoryId ?? ""}
                  onChange={(e) => edit(setCategoryId)(e.target.value || null)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  <option value="">Uncategorized</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.archivedAt ? " (archived)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sop-owner">SOP owner</Label>
                <select
                  id="sop-owner"
                  value={ownerId ?? ""}
                  onChange={(e) => edit(setOwnerId)(e.target.value || null)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  <option value="">No owner</option>
                  {props.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Responsible for keeping this SOP up to date.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                  checked={requiresAck}
                  onChange={(e) => edit(setRequiresAck)(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-semibold">Require acknowledgment</span>
                  <span className="block text-xs text-muted-foreground">Readers confirm they&apos;ve read each new published version.</span>
                </span>
              </label>
              {props.currentVersion > 0 && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Category, owner and acknowledgment changes go live when you publish.
                </p>
              )}
            </fieldset>
          </section>

          <AccessCard sopId={sopId} initial={props.access} members={props.members} />

          {!archived && <AttachmentManager workspaceId={props.workspaceId} sopId={sopId} attachments={attachments} onChange={setAttachments} />}
        </aside>
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        nextVersion={props.currentVersion + 1}
        requiresAcknowledgment={requiresAck}
        onPublish={publish}
      />
    </div>
  );
}

function SaveIndicator({ state, lastSaved, error }: { state: SaveState; lastSaved: string; error: string | null }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold";
  return (
    <span role="status" aria-live="polite" data-testid="save-state" data-state={state}>
      {state === "saving" && (
        <span className={`${base} bg-muted text-muted-foreground`}>
          <Loader2 className="size-3.5 animate-spin" /> Saving…
        </span>
      )}
      {state === "dirty" && <span className={`${base} bg-tint-amber text-tint-amber-fg`}>Unsaved changes</span>}
      {state === "saved" && (
        <span className={`${base} bg-secondary text-secondary-foreground`}>
          <Check className="size-3.5" /> Saved <RelativeTime iso={lastSaved} className="font-medium opacity-75" />
        </span>
      )}
      {state === "error" && (
        <span className={`${base} bg-tint-coral text-destructive`} title={error ?? undefined}>
          <CloudOff className="size-3.5" /> Not saved — retrying
        </span>
      )}
      {state === "conflict" && <span className={`${base} bg-tint-coral text-destructive`}>Edited elsewhere</span>}
    </span>
  );
}
