"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Bell,
  Building2,
  CornerDownLeft,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { searchWorkspaceAction, type SearchResult } from "@/features/search/actions";
import { MIN_QUERY, searchSources } from "@/features/search/sources";
import { switchWorkspaceAction } from "@/features/workspaces/actions";
import type { WorkspaceItem } from "./workspace-switcher";
import { cn, initials } from "@/lib/utils";

type Command = { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void };

export function GlobalSearch({ workspaceName, workspaces, currentId }: { workspaceName: string; workspaces: WorkspaceItem[]; currentId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const requestId = React.useRef(0);

  // ⌘K / Ctrl+K opens search from anywhere in the app.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
      setError(null);
      setActive(0);
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setActive(0);
    const id = ++requestId.current;
    if (value.trim().length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    // Debounce: only the latest keystroke's request is applied.
    window.setTimeout(async () => {
      if (id !== requestId.current) return;
      const response = await searchWorkspaceAction(value);
      if (id !== requestId.current) return;
      setLoading(false);
      if (response.ok) {
        setResults(response.results);
        setError(null);
      } else {
        setResults([]);
        setError(response.error);
      }
    }, 220);
  }

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const commands: Command[] = (() => {
    const base: Command[] = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, run: () => go("/app/dashboard") },
      { id: "notifications", label: "Notifications", icon: Bell, run: () => go("/app/notifications") },
      { id: "settings", label: "Workspace settings", icon: Settings, run: () => go("/app/settings") },
      { id: "profile", label: "Your profile", icon: UserRound, run: () => go("/app/settings/profile") },
      { id: "workspaces", label: "All workspaces", icon: Building2, run: () => go("/app/workspaces") },
      { id: "new-workspace", label: "Create workspace", icon: Plus, run: () => go("/onboarding?new=1") },
    ];
    const switches: Command[] = workspaces
      .filter((w) => w.id !== currentId)
      .map((w) => ({
        id: `switch-${w.id}`,
        label: `Switch to ${w.name}`,
        hint: "Workspace",
        icon: ArrowRightLeft,
        run: () => {
          onOpenChange(false);
          void switchWorkspaceAction(w.id);
        },
      }));
    const q = query.trim().toLowerCase();
    return [...base, ...switches].filter((c) => !q || c.label.toLowerCase().includes(q));
  })();

  // Only navigable entries take part in keyboard selection.
  const selectable = commands.length;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (selectable ? (i + 1) % selectable : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (selectable ? (i - 1 + selectable) % selectable : 0));
    } else if (e.key === "Enter" && commands[active]) {
      e.preventDefault();
      commands[active].run();
    }
  }

  const comingSoon = searchSources.filter((s) => !s.searchable).map((s) => s.label);
  const showResults = query.trim().length >= MIN_QUERY;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-11 w-full max-w-xl min-w-0 cursor-pointer items-center gap-3 rounded-full border border-border bg-muted/60 px-4 text-left text-sm text-muted-foreground transition-colors hover:border-input hover:bg-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="size-[18px] shrink-0 text-foreground/70" />
        <span className="hidden truncate sm:inline">Search people, pages and workspaces…</span>
        <span className="truncate sm:hidden">Search…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search {workspaceName}</DialogTitle>
          <DialogDescription className="sr-only">Search people, pages and workspaces. Results are limited to {workspaceName}.</DialogDescription>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Search ${workspaceName}…`}
              maxLength={100}
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-list"
              aria-activedescendant={commands[active] ? `cmd-${commands[active].id}` : undefined}
              aria-label="Search query"
              className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Searching" />}
          </div>

          <div id="global-search-list" role="listbox" aria-label="Search results" className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
            {showResults && (
              <Section title={`Team members in ${workspaceName}`}>
                {error ? (
                  <p className="px-3 py-2 text-sm text-destructive">{error}</p>
                ) : loading && results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No team members match “{query.trim()}”.</p>
                ) : (
                  results.map((r) => (
                    <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2" data-testid="search-member">
                      <Avatar className="size-8">
                        {r.imageUrl && <AvatarImage src={r.imageUrl} alt="" />}
                        <AvatarFallback className="text-[11px]">{initials(r.title)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </div>
                  ))
                )}
              </Section>
            )}

            {(commands.length > 0 || !showResults) && (
            <Section title={query.trim() ? "Pages & actions" : "Jump to"}>
              {commands.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No pages match.</p>
              ) : (
                commands.map((c, i) => (
                  <button
                    key={c.id}
                    id={`cmd-${c.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={c.run}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                      i === active ? "bg-secondary text-secondary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <c.icon className="size-4 shrink-0 opacity-70" />
                    <span className="flex-1 truncate font-medium">{c.label}</span>
                    {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
                    {i === active && <CornerDownLeft className="size-3.5 opacity-60" />}
                  </button>
                ))
              )}
            </Section>
            )}
          </div>

          {comingSoon.length > 0 && (
            <p className="border-t border-border bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
              Search covers team members and pages today. {comingSoon.join(", ")} become searchable as each module launches.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
