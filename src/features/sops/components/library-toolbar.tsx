"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const selectClass =
  "h-10 cursor-pointer rounded-lg border border-input bg-card px-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20";

/** Search, filter, sort and view controls. State lives in the URL (shareable, back-button friendly). */
export function LibraryToolbar({ categories, canSeeDrafts }: { categories: Option[]; canSeeDrafts: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest requested query string: quick successive changes must build on each
  // other, not on the URL from before the previous navigation finished.
  const latest = useRef(params.toString());
  useEffect(() => {
    latest.current = params.toString();
  }, [params]);

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(latest.current);
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    latest.current = sp.toString();
    start(() => router.replace(sp.size ? `${pathname}?${sp}` : pathname, { scroll: false }));
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onSearch(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ q: value.trim().length >= 2 ? value.trim() : null }), 300);
  }

  const view = params.get("view") === "cards" ? "cards" : "list";
  const statuses: Option[] = canSeeDrafts
    ? [
        { value: "", label: "Active (draft & published)" },
        { value: "published", label: "Published" },
        { value: "draft", label: "Drafts" },
        { value: "archived", label: "Archived" },
      ]
    : [];

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search titles, descriptions and content…"
          aria-label="Search SOPs"
          maxLength={100}
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
        />
        {pending ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          q && (
            <button type="button" aria-label="Clear search" onClick={() => onSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )
        )}
      </div>
      <select aria-label="Category" className={selectClass} value={params.get("category") ?? ""} onChange={(e) => set({ category: e.target.value || null })}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {canSeeDrafts && (
        <select aria-label="Status" className={selectClass} value={params.get("status") ?? ""} onChange={(e) => set({ status: e.target.value || null })}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Sort by" className={selectClass} value={params.get("sort") ?? "updated"} onChange={(e) => set({ sort: e.target.value === "updated" ? null : e.target.value })}>
        <option value="updated">Last updated</option>
        <option value="title">Title (A–Z)</option>
        <option value="created">Date created</option>
        <option value="published">Date published</option>
      </select>
      <div className="flex rounded-lg border border-input bg-card p-0.5 shadow-xs" role="group" aria-label="View">
        {(["list", "cards"] as const).map((v) => {
          const Icon = v === "list" ? List : LayoutGrid;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              aria-label={v === "list" ? "List view" : "Card view"}
              onClick={() => set({ view: v === "list" ? null : "cards" })}
              className={cn("flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground", view === v && "bg-secondary text-primary")}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
