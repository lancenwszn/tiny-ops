"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PublishDialog({
  open,
  onOpenChange,
  nextVersion,
  requiresAcknowledgment,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nextVersion: number;
  requiresAcknowledgment: boolean;
  onPublish: (note: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish version {nextVersion}</DialogTitle>
          <DialogDescription>
            Publishing makes this version the one your team reads. Earlier versions stay in the history.
            {requiresAcknowledgment && " Everyone who can read it will be asked to acknowledge this version."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const ok = await onPublish(note.trim());
            setBusy(false);
            if (ok) {
              setNote("");
              onOpenChange(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="revision-note">What changed? (revision note)</Label>
            <Textarea
              id="revision-note"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder={nextVersion === 1 ? "First release" : "e.g. Added the alarm check to step 2"}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />} Publish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
