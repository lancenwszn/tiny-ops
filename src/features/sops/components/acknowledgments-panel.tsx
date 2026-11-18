import { CheckCircle2, Clock, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AckRow } from "../queries";
import { brandingUrl } from "@/lib/env";
import { initials } from "@/lib/utils";

const DATE = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

export function AcknowledgmentsPanel({ rows, currentVersion }: { rows: AckRow[]; currentVersion: number }) {
  const done = rows.filter((r) => r.acknowledgedVersion === currentVersion).length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card" aria-labelledby="acks-title" data-testid="acks-panel">
      <h2 id="acks-title" className="flex items-center gap-2 text-[15px] font-bold">
        <Users className="size-4 text-primary" /> Acknowledgments
      </h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">{done}</span> of {rows.length} acknowledged version {currentVersion}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Acknowledgment progress">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 grid gap-2.5">
        {rows.map((r) => {
          const current = r.acknowledgedVersion === currentVersion;
          return (
            <li key={r.userId} className="flex items-center gap-2.5" data-testid="ack-row">
              <Avatar className="size-8">
                {r.avatarPath && <AvatarImage src={brandingUrl(r.avatarPath)!} alt="" />}
                <AvatarFallback className="text-[10px]">{initials(r.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {current
                    ? `v${r.acknowledgedVersion} · ${DATE.format(new Date(r.acknowledgedAt!))}`
                    : r.acknowledgedVersion
                      ? `Acknowledged v${r.acknowledgedVersion} (outdated)`
                      : "Not acknowledged"}
                </p>
              </div>
              {current ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="Acknowledged" />
              ) : (
                <Clock className="size-4 shrink-0 text-tint-amber-fg" aria-label="Pending" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
