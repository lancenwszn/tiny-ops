"use client";

import * as React from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Uploads an image straight to the public `branding` bucket (Storage RLS
 * decides whether the user may write to `folder`), then hands the stored path
 * to a Server Action that validates and saves it.
 */
export function ImageUpload({
  folder,
  imageUrl,
  fallback,
  label,
  shape = "rounded",
  disabled,
  onSave,
}: {
  folder: string;
  imageUrl: string | null;
  fallback: React.ReactNode;
  label: string;
  shape?: "rounded" | "circle";
  disabled?: boolean;
  onSave: (path: string | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  // Local override after an upload/removal; otherwise show the saved image.
  const [override, setPreview] = React.useState<string | null | undefined>(undefined);
  const preview = override === undefined ? imageUrl : override;

  async function handleFile(file: File) {
    const ext = TYPES[file.type];
    if (!ext) return toast.error("Use a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) return toast.error("Images must be 2 MB or smaller.");

    setBusy(true);
    try {
      const path = `${folder}/${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("branding").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new Error("Upload failed. Please try again.");

      const result = await onSave(path);
      if (!result.ok) {
        await supabase.storage.from("branding").remove([path]);
        throw new Error(result.error ?? "Could not save the image.");
      }
      setPreview(URL.createObjectURL(file));
      toast.success(`${label} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    const result = await onSave(null);
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Could not remove the image.");
    setPreview(null);
    toast.success(`${label} removed`);
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted",
          shape === "circle" ? "rounded-full" : "rounded-2xl",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from Storage
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          fallback
        )}
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
            {preview ? "Change" : "Upload"}
          </Button>
          {preview && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={handleRemove}>
              <Trash2 /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={`Upload ${label.toLowerCase()}`}
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
