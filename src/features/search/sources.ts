import { modules, type ModuleKey } from "@/lib/modules";

/**
 * What global search covers. Each source maps to a branch of the
 * `search_workspace` SQL function (RLS-scoped). Sources whose module is not
 * live yet are listed as "coming soon" in the UI instead of being searched.
 */
export type SearchKind = "member" | "task" | "sop" | "checklist" | "handover";

export type SearchSource = { kind: SearchKind; label: string; module: ModuleKey; searchable: boolean };

export const searchSources: SearchSource[] = [
  { kind: "task", label: "Tasks", module: "tasks", searchable: modules.tasks.available },
  { kind: "sop", label: "SOPs", module: "sops", searchable: modules.sops.available },
  { kind: "checklist", label: "Checklists", module: "checklists", searchable: modules.checklists.available },
  // Members are searchable now (data exists); the Team page arrives in Stage 6.
  { kind: "member", label: "Team members", module: "team", searchable: true },
  { kind: "handover", label: "Handovers", module: "handovers", searchable: modules.handovers.available },
];

export const MIN_QUERY = 2;
export const MAX_QUERY = 100;

/** Normalises user input; returns null when the query is too short to search. */
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
  return q.length >= MIN_QUERY ? q : null;
}
