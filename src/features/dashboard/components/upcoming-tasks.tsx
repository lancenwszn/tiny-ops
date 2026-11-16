import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Widget, EmptyState, SoonBadge } from "./widget";
import { brandingUrl } from "@/lib/env";
import { modules } from "@/lib/modules";
import { initials } from "@/lib/utils";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "review" | "completed";

/** Shape the Tasks module (Stage 4) provides to the dashboard. */
export type UpcomingTask = {
  id: string;
  title: string;
  assignee: { name: string; avatarPath: string | null } | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueLabel: string;
  overdue: boolean;
};

const PRIORITY: Record<TaskPriority, { label: string; variant: "muted" | "sky" | "amber" | "coral" }> = {
  low: { label: "Low", variant: "muted" },
  medium: { label: "Medium", variant: "amber" },
  high: { label: "High", variant: "coral" },
  urgent: { label: "Urgent", variant: "coral" },
};

const STATUS: Record<TaskStatus, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", completed: "Completed" };

export function UpcomingTasks({ tasks }: { tasks: UpcomingTask[] | null }) {
  const live = tasks !== null;
  return (
    <Widget
      title="Upcoming Tasks"
      icon={ListChecks}
      tint="green"
      id="upcoming-tasks"
      action={live ? { href: modules.tasks.href, label: "View all" } : <SoonBadge />}
    >
      {!live || tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={live ? "No upcoming tasks" : "Task tracking is coming soon"}
          description={
            live
              ? "Tasks due soon will appear here with their owner, priority and status."
              : "Soon you'll see what's due next, who owns it, its priority and status — right here."
          }
        />
      ) : (
        <ul className="grid gap-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`${modules.tasks.href}/${t.id}`} className="block truncate text-sm font-semibold hover:text-primary">
                  {t.title}
                </Link>
                <p className={t.overdue ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                  {t.dueLabel} · {STATUS[t.status]}
                </p>
              </div>
              <Badge variant={PRIORITY[t.priority].variant}>{PRIORITY[t.priority].label}</Badge>
              <Avatar className="size-7" title={t.assignee?.name ?? "Unassigned"}>
                {t.assignee?.avatarPath && <AvatarImage src={brandingUrl(t.assignee.avatarPath)!} alt="" />}
                <AvatarFallback className="text-[10px]">{t.assignee ? initials(t.assignee.name) : "–"}</AvatarFallback>
              </Avatar>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
