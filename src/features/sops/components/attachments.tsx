"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { deleteAttachmentAction, getAttachmentUrlAction, registerAttachmentAction } from "../actions";
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, attachmentPathPrefix, formatBytes } from "../schemas";

export type ClientAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
};

const ACCEPT = Object.keys(ATTACHMENT_TYPES).join(",");

/** Opens a short-lived signed link (Storage RLS checks access). */
export async function openAttachment(id: string, download: boolean) {
  // Open the tab synchronously (inside the click) so popup blockers allow it,
  // then point it at the short-lived signed URL once we have it.
  const tab = download ? null : window.open("about:blank", "_blank");
  const res = await getAttachmentUrlAction(id, download);
  if (!res.ok) {
    tab?.close();
    return toast.error(res.error);
  }
  if (download || !tab) {
    window.location.assign(res.url);
    return;
  }
  tab.opener = null;
  tab.location.replace(res.url);
}

export function AttachmentIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  return mimeType.startsWith("image/") ? <ImageIcon className={className} /> : <FileText className={className} />;
}

/** Read-only list with secure open/download (reader view). */
export function AttachmentList({ attachments }: { attachments: ClientAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {attachments.map((a) => (
        <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5" data-testid="attachment">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tint-sky text-tint-sky-fg">
            <AttachmentIcon mimeType={a.mimeType} className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{a.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {ATTACHMENT_TYPES[a.mimeType]?.label ?? "File"} · {formatBytes(a.sizeBytes)}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={`Open ${a.fileName}`} onClick={() => void openAttachment(a.id, false)}>
            <ExternalLink />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Download ${a.fileName}`} onClick={() => void openAttachment(a.id, true)}>
            <Download />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Upload + manage attachments (editor). Files go straight to private Storage under RLS. */
export function AttachmentManager({
  workspaceId,
  sopId,
  attachments,
  onChange,
}: {
  workspaceId: string;
  sopId: string;
  attachments: ClientAttachment[];
  onChange: (next: ClientAttachment[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList) {
    setBusy(true);
    const supabase = createClient();
    let next = attachments;
    for (const file of Array.from(files)) {
      const type = ATTACHMENT_TYPES[file.type];
      if (!type) {
        toast.error(`${file.name}: this file type isn't supported.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name}: files must be 10 MB or smaller.`);
        continue;
      }
      const path = `${attachmentPathPrefix(workspaceId, sopId)}${crypto.randomUUID()}.${type.ext}`;
      const { error } = await supabase.storage.from("sop-attachments").upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error(`${file.name}: upload failed.`);
        continue;
      }
      const res = await registerAttachmentAction({ sopId, path, fileName: file.name.slice(0, 200), mimeType: file.type, size: file.size });
      if (!res.ok) {
        toast.error(`${file.name}: ${res.error}`);
        continue;
      }
      next = [...next, { ...res.attachment, previewUrl: res.attachment.previewUrl }];
      onChange(next);
      toast.success(`${file.name} attached`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function remove(a: ClientAttachment) {
    if (!window.confirm(`Remove ${a.fileName}? Steps or images that use it will no longer show it.`)) return;
    const res = await deleteAttachmentAction(a.id);
    if (!res.ok) return toast.error(res.error);
    onChange(attachments.filter((x) => x.id !== a.id));
    toast.success("File removed");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5" aria-label="Attachments">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold">
            <Paperclip className="size-4 text-primary" /> Attachments
          </h3>
          <p className="text-[13px] text-muted-foreground">PDF, images, Office files, CSV or text — up to 10 MB each. Private to people who can read this SOP.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload files
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload attachments"
          onChange={(e) => e.target.files?.length && void upload(e.target.files)}
        />
      </div>
      {attachments.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2" data-testid="attachment">
              {a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                <img src={a.previewUrl} alt="" className="size-9 rounded-lg object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-lg bg-tint-sky text-tint-sky-fg">
                  <AttachmentIcon mimeType={a.mimeType} className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.fileName}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(a.sizeBytes)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Download ${a.fileName}`} onClick={() => void openAttachment(a.id, true)}>
                <Download />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${a.fileName}`} onClick={() => void remove(a)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
