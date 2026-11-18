"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { restoreSopVersionAction } from "../actions";

export function RestoreButton({ sopId, version, latest, hasUnpublished }: { sopId: string; version: number; latest: number; hasUnpublished: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw /> Restore
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore version {version}?</DialogTitle>
            <DialogDescription>
              This publishes the content of version {version} as a new version {latest + 1}. Nothing is deleted — every version stays in the history.
            </DialogDescription>
          </DialogHeader>
          {hasUnpublished && (
            <p className="rounded-xl bg-tint-amber px-3 py-2 text-sm text-foreground/85" role="alert">
              This SOP has <strong>unpublished edits</strong>. Restoring will discard them.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await restoreSopVersionAction(sopId, version, hasUnpublished);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(`Restored as version ${res.version}`);
                  setOpen(false);
                  router.push(`/app/sops/${sopId}/history`);
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />} {hasUnpublished ? "Discard edits and restore" : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
