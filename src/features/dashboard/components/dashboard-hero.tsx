import { CalendarClock, CircleCheckBig, ClipboardCheck, ListTodo, TriangleAlert } from "lucide-react";
import { WorkspaceAvatar } from "@/components/layout/workspace-avatar";
import { Greeting, WorkspaceClock } from "./greeting";
import { KpiCard } from "./kpi-card";
import type { computeKpis } from "../metrics";

export function DashboardHero({
  firstName,
  profileTimezone,
  workspace,
  role,
  kpis,
}: {
  firstName: string;
  profileTimezone: string | null;
  workspace: { name: string; logo_path: string | null; timezone: string; description: string };
  role: string;
  kpis: ReturnType<typeof computeKpis>;
}) {
  return (
    <section
      aria-label="Welcome"
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-[linear-gradient(110deg,#ffffff_0%,#f3faf6_45%,#e2f3ea_100%)] shadow-card dark:bg-card"
    >
      {/* Decorative connected-block motif from the TinyOps mark */}
      <div aria-hidden className="pointer-events-none absolute -right-14 -top-20 size-64 rotate-12 rounded-[3.5rem] bg-primary/[0.07]" />
      <div aria-hidden className="pointer-events-none absolute right-40 top-24 size-36 -rotate-6 rounded-[2.5rem] bg-[#3ad468]/[0.08]" />

      <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-start gap-4">
          <WorkspaceAvatar name={workspace.name} logoPath={workspace.logo_path} className="hidden size-16 rounded-2xl text-lg shadow-card sm:flex" />
          <div className="min-w-0">
            <Greeting firstName={firstName} timezone={profileTimezone} />
            <p className="mt-2 truncate text-[15px] text-muted-foreground">
              <span className="font-semibold text-foreground">{workspace.name}</span>
              <span className="mx-1.5">·</span>
              <span className="capitalize">{role}</span>
            </p>
            {workspace.description && <p className="mt-1 line-clamp-1 max-w-xl text-sm text-muted-foreground">{workspace.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 self-start rounded-2xl border border-border bg-card/85 px-4 py-3 shadow-card backdrop-blur">
          <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <WorkspaceClock timezone={workspace.timezone} />
        </div>
      </div>

      <div className="relative mt-auto grid grid-cols-1 gap-3 px-5 pb-5 min-[480px]:grid-cols-2 sm:px-7 sm:pb-7 2xl:grid-cols-4">
        <KpiCard label="Total Tasks" metric={kpis.totalTasks} icon={ListTodo} tint="green" />
        <KpiCard label="Completed Tasks" metric={kpis.completedTasks} icon={CircleCheckBig} tint="violet" />
        <KpiCard label="Overdue Tasks" metric={kpis.overdueTasks} icon={TriangleAlert} tint="coral" />
        <KpiCard label="Checklist Completion" metric={kpis.checklistCompletion} icon={ClipboardCheck} tint="sky" />
      </div>
    </section>
  );
}
