"use client";

import { useActionState, useState } from "react";
import { Check, ChevronDown, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError, FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { createInvitationAction } from "../actions";

export function InviteMemberDialog({ canInviteAdmins, children }: { canInviteAdmins: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRound((r) => r + 1); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <InviteForm key={round} canInviteAdmins={canInviteAdmins} onAnother={() => setRound((r) => r + 1)} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({ canInviteAdmins, onAnother, onDone }: { canInviteAdmins: boolean; onAnother: () => void; onDone: () => void }) {
  const [state, action] = useActionState(createInvitationAction, initialFormState);
  const [copied, setCopied] = useState(false);
  const link = state.status === "success" ? state.data?.inviteUrl : undefined;

  if (link) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Invitation ready</DialogTitle>
          <DialogDescription>
            Send this link to <strong className="text-foreground">{state.data?.email}</strong>. It works once and expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input readOnly value={link} aria-label="Invitation link" className="pl-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="rounded-xl bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          TinyOps doesn&apos;t send invitation emails yet. If they already have a TinyOps account, they&apos;ll also see the invitation in
          their notifications.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onAnother}>
            Invite another
          </Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  const roleErrors = state.fieldErrors?.role;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogDescription>They&apos;ll join this workspace with the role you choose.</DialogDescription>
      </DialogHeader>
      <FormMessage state={state} />
      <TextField name="email" label="Email address" type="email" autoComplete="off" placeholder="name@company.com" required state={state} autoFocus />
      <div className="grid gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <div className="relative">
          <select
            id="invite-role"
            name="role"
            defaultValue={state.values?.role || "member"}
            aria-invalid={roleErrors?.length ? true : undefined}
            className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
          >
            <option value="member">Member — follows SOPs, completes tasks and checklists</option>
            {canInviteAdmins && <option value="admin">Admin — manages SOPs, tasks, checklists and team operations</option>}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-60" />
        </div>
        <FieldError id="invite-role-error" errors={roleErrors} />
      </div>
      <DialogFooter>
        <SubmitButton pendingText="Creating invitation…">Create invitation</SubmitButton>
      </DialogFooter>
    </form>
  );
}
