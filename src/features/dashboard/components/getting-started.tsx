import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Rocket } from "lucide-react";
import { Widget, SoonBadge } from "./widget";

export type SetupStep = {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  /** Rendered instead of a link (e.g. a dialog trigger). */
  action?: React.ReactNode;
  soon?: boolean;
};

export function GettingStarted({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <Widget title="Getting Started" icon={Rocket} tint="amber" id="getting-started">
      <div className="flex items-end justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="text-2xl font-extrabold text-foreground">{done}</span> of {steps.length} done
        </p>
        <span className="text-sm font-bold text-primary">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Workspace setup progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 grid gap-0.5">
        {steps.map((s) => {
          const icon = s.done ? <CheckCircle2 className="size-[18px] shrink-0 text-primary" aria-label="Done" /> : <Circle className="size-[18px] shrink-0 text-muted-foreground/45" aria-hidden />;
          const label = <span className={s.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{s.label}</span>;
          if (!s.done && s.href) {
            return (
              <li key={s.key}>
                <Link href={s.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] hover:bg-muted">
                  {icon}
                  {label}
                  <ArrowRight className="size-3.5 text-primary" aria-hidden />
                </Link>
              </li>
            );
          }
          return (
            <li key={s.key} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px]">
              {icon}
              {label}
              {!s.done && s.soon && <SoonBadge />}
              {!s.done && s.action}
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}
