/**
 * Single source of truth for which product modules are live. Navigation,
 * quick actions, search and dashboard widgets all read from here, so turning
 * a module on in a later stage lights it up everywhere at once.
 */
export type ModuleKey = "tasks" | "sops" | "checklists" | "calendar" | "team" | "handovers" | "reports";

export type ModuleInfo = {
  key: ModuleKey;
  label: string;
  href: string;
  available: boolean;
};

export const modules: Record<ModuleKey, ModuleInfo> = {
  tasks: { key: "tasks", label: "Tasks", href: "/app/tasks", available: false },
  sops: { key: "sops", label: "SOP Library", href: "/app/sops", available: true },
  checklists: { key: "checklists", label: "Checklists", href: "/app/checklists", available: false },
  calendar: { key: "calendar", label: "Calendar", href: "/app/calendar", available: false },
  team: { key: "team", label: "Team", href: "/app/team", available: false },
  handovers: { key: "handovers", label: "Handovers", href: "/app/handovers", available: false },
  reports: { key: "reports", label: "Reports", href: "/app/reports", available: false },
};

export function isAvailable(key: ModuleKey) {
  return modules[key].available;
}
