"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspaceAction } from "@/features/workspaces/actions";
import { WorkspaceAvatar } from "./workspace-avatar";
import { cn } from "@/lib/utils";

export type WorkspaceItem = { id: string; name: string; logoPath: string | null; role: string };

export function WorkspaceSwitcher({
  current,
  workspaces,
  compact = false,
  className,
}: {
  current: WorkspaceItem;
  workspaces: WorkspaceItem[];
  /** Avatar-only trigger for the collapsed sidebar. */
  compact?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function select(id: string) {
    if (id === current.id) return;
    startTransition(async () => {
      const result = await switchWorkspaceAction(id);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card text-left shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30",
          compact ? "w-12 justify-center self-center p-0" : "w-full px-2 pr-3",
          className,
        )}
        aria-label={`Current workspace: ${current.name}. Switch workspace`}
      >
        <WorkspaceAvatar name={current.name} logoPath={current.logoPath} className="size-8 rounded-lg" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{current.name}</span>
              <span className="block text-[11.5px] capitalize leading-tight text-muted-foreground">{current.role}</span>
            </span>
            {pending ? <Loader2 className="size-4 animate-spin opacity-60" /> : <ChevronsUpDown className="size-4 opacity-50" />}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={compact ? "right" : "bottom"} className="w-72">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => select(w.id)} className="gap-2.5">
            <WorkspaceAvatar name={w.name} logoPath={w.logoPath} className="size-7 rounded-lg text-[11px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{w.name}</span>
              <span className="block text-xs capitalize text-muted-foreground">{w.role}</span>
            </span>
            {w.id === current.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/workspaces">
            <Building2 /> All workspaces
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/onboarding?new=1">
            <Plus /> Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
