/**
 * Dashboard metric model. Widgets render a Metric; modules feed numbers in.
 * A metric is "unavailable" until its source module exists — the UI shows
 * that honestly instead of a fabricated zero.
 */
export type Metric =
  | { state: "ready"; value: number; display: string; caption?: string }
  | { state: "unavailable"; caption: string };

export type TaskStats = { total: number; completed: number; overdue: number; open: number };
export type ChecklistStats = { due: number; completed: number; pending: number };

/** Inputs from live modules. `undefined` means the module is not live yet. */
export type OperationsInputs = { tasks?: TaskStats; checklists?: ChecklistStats };

const unavailable = (caption: string): Metric => ({ state: "unavailable", caption });
const count = (value: number, caption?: string): Metric => ({ state: "ready", value, display: value.toLocaleString("en-US"), caption });
const percent = (ratio: number, caption?: string): Metric => {
  const value = Math.round(ratio * 100);
  return { state: "ready", value, display: `${value}%`, caption };
};

export function rate(done: number, total: number): number | null {
  return total > 0 ? Math.min(1, Math.max(0, done / total)) : null;
}

export function computeKpis({ tasks, checklists }: OperationsInputs) {
  const checklistRate = checklists ? rate(checklists.completed, checklists.due) : null;
  return {
    totalTasks: tasks ? count(tasks.total, `${tasks.open} open`) : unavailable("Starts with Tasks"),
    completedTasks: tasks ? count(tasks.completed) : unavailable("Starts with Tasks"),
    overdueTasks: tasks ? count(tasks.overdue, tasks.overdue ? "Needs attention" : "All on track") : unavailable("Starts with Tasks"),
    checklistCompletion: !checklists
      ? unavailable("Starts with Checklists")
      : checklistRate === null
        ? count(0, "Nothing due yet")
        : percent(checklistRate, `${checklists.completed} of ${checklists.due} done`),
  } satisfies Record<string, Metric>;
}

export type HealthRow = { key: string; label: string; metric: Metric };

/**
 * Operations health score (0–100): the average of the completion rates that
 * have data, minus a penalty of up to 20 points for overdue tasks. Returns
 * null when there is nothing to measure yet.
 */
export function computeOperationsHealth({ tasks, checklists }: OperationsInputs): { score: number | null; rows: HealthRow[] } {
  const taskRate = tasks ? rate(tasks.completed, tasks.total) : null;
  const checklistRate = checklists ? rate(checklists.completed, checklists.due) : null;
  const rates = [taskRate, checklistRate].filter((r): r is number => r !== null);

  let score: number | null = null;
  if (rates.length > 0) {
    const base = (rates.reduce((a, b) => a + b, 0) / rates.length) * 100;
    const penalty = tasks && tasks.total > 0 ? Math.min(20, (tasks.overdue / tasks.total) * 40) : 0;
    score = Math.round(Math.max(0, Math.min(100, base - penalty)));
  }

  const rows: HealthRow[] = [
    { key: "tasks", label: "Task completion", metric: taskRate === null ? (tasks ? count(0, "No tasks yet") : unavailable("Not tracked yet")) : percent(taskRate) },
    {
      key: "checklists",
      label: "Checklist completion",
      metric: checklistRate === null ? (checklists ? count(0, "Nothing due yet") : unavailable("Not tracked yet")) : percent(checklistRate),
    },
    { key: "overdue", label: "Overdue items", metric: tasks ? count(tasks.overdue) : unavailable("Not tracked yet") },
    { key: "pending", label: "Pending checklists", metric: checklists ? count(checklists.pending) : unavailable("Not tracked yet") },
  ];

  return { score, rows };
}
