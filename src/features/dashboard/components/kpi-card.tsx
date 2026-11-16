import type { LucideIcon } from "lucide-react";
import type { Metric } from "../metrics";
import { tintClasses, type Tint } from "./widget";
import { cn } from "@/lib/utils";

const surface: Record<Tint, string> = {
  green: "bg-[linear-gradient(135deg,var(--tint-green),color-mix(in_srgb,var(--tint-green)_40%,var(--card)))]",
  violet: "bg-[linear-gradient(135deg,var(--tint-violet),color-mix(in_srgb,var(--tint-violet)_40%,var(--card)))]",
  coral: "bg-[linear-gradient(135deg,var(--tint-coral),color-mix(in_srgb,var(--tint-coral)_40%,var(--card)))]",
  sky: "bg-[linear-gradient(135deg,var(--tint-sky),color-mix(in_srgb,var(--tint-sky)_40%,var(--card)))]",
  amber: "bg-[linear-gradient(135deg,var(--tint-amber),color-mix(in_srgb,var(--tint-amber)_40%,var(--card)))]",
  muted: "bg-muted",
};

export function KpiCard({ label, metric, icon: Icon, tint }: { label: string; metric: Metric; icon: LucideIcon; tint: Tint }) {
  const ready = metric.state === "ready";
  return (
    <div className={cn("flex min-w-0 items-start gap-3 rounded-2xl border border-white/70 p-4 shadow-card", surface[tint])} data-testid="kpi">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm", tintClasses[tint], "bg-card")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-tight text-foreground/75">{label}</p>
        <p className={cn("mt-0.5 text-[26px] font-extrabold leading-none tracking-tight", !ready && "text-muted-foreground/60")}>
          {ready ? metric.display : "—"}
        </p>
        {metric.caption && <p className="mt-1.5 text-xs font-medium text-muted-foreground">{metric.caption}</p>}
      </div>
    </div>
  );
}
