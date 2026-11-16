"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acknowledgeSopAction } from "../actions";

export function AcknowledgeCard({
  sopId,
  currentVersion,
  myAcknowledgment,
}: {
  sopId: string;
  currentVersion: number;
  myAcknowledgment: { version: number; at: string } | null;
}) {
  const [ack, setAck] = useState(myAcknowledgment);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  const current = ack?.version === currentVersion;

  if (current) {
    return (
      <section className="rounded-2xl border border-primary/25 bg-tint-green p-4" aria-label="Acknowledgment" data-testid="ack-card" data-state="done">
        <p className="flex items-center gap-2 font-bold text-secondary-foreground">
          <CheckCircle2 className="size-5 text-primary" /> You acknowledged version {currentVersion}
        </p>
        <p className="mt-1 text-[13px] text-secondary-foreground/80">
          on {new Date(ack!.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-tint-amber-fg/30 bg-tint-amber p-4" aria-label="Acknowledgment" data-testid="ack-card" data-state="pending">
      <p className="flex items-center gap-2 font-bold text-tint-amber-fg">
        <ShieldCheck className="size-5" /> Acknowledgment required
      </p>
      <p className="mt-1 text-[13px] text-foreground/80">
        {ack
          ? `You acknowledged version ${ack.version}. This SOP has changed — please review version ${currentVersion}.`
          : "Please read this procedure carefully, then confirm below."}
      </p>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I have read and understood version {currentVersion} of this SOP.
      </label>
      <Button
        className="mt-3 w-full"
        disabled={!confirmed || pending}
        onClick={() =>
          start(async () => {
            const res = await acknowledgeSopAction(sopId);
            if (!res.ok) return void toast.error(res.error);
            setAck({ version: res.version, at: new Date().toISOString() });
            toast.success("Thanks — acknowledgment recorded");
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />} Acknowledge
      </Button>
    </section>
  );
}
