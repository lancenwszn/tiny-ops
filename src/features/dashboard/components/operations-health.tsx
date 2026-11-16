import { Activity } from "lucide-react";
import { Widget } from "./widget";
import { ProgressRing } from "./progress-ring";
import type { HealthRow } from "../metrics";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  tasks: "bg-chart-1",
  checklists: "bg-chart-2",
  overdue: "bg-chart-4",
  pending: "bg-chart-3",
};

export function OperationsHealth({ score, rows }: { score: number | null; rows: HealthRow[] }) {
  return (
    <Widget title="Operations Health" icon={Activity} tint="green" id="ops-health">
      <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center xl:flex-col 2xl:flex-row">
        <ProgressRing value={score} label="Overall operational completion" />
        <ul className="grid w-full gap-2.5">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start gap-2.5">
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[row.key] ?? "bg-muted-foreground")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground/80">{row.label}</p>
                <p className={cn("text-sm font-bold", row.metric.state === "unavailable" && "font-medium text-muted-foreground")}>
                  {row.metric.state === "ready" ? row.metric.display : row.metric.caption}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {score === null && (
        <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-[12.5px] leading-snug text-muted-foreground">
          Your health score appears once your team starts completing tasks and checklists.
        </p>
      )}
    </Widget>
  );
}
