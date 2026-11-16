"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mainNav } from "./nav";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="grid gap-1">
      {mainNav.map(({ href, label, icon: Icon, available }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const base = cn(
          "group flex h-11 items-center gap-3 rounded-xl text-[14.5px] font-medium transition-colors",
          collapsed ? "justify-center px-0" : "px-3.5",
        );
        const item = available ? (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              base,
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-[19px] shrink-0" aria-hidden />
            {!collapsed && <span className="flex-1">{label}</span>}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label={`${label} (coming soon)`}
            className={cn(base, "cursor-not-allowed text-sidebar-foreground/45")}
            data-testid="nav-soon"
          >
            <Icon className="size-[19px] shrink-0" aria-hidden />
            {!collapsed && (
              <>
                <span className="flex-1">{label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Soon
                </span>
              </>
            )}
          </span>
        );

        if (!collapsed && available) return <div key={href}>{item}</div>;
        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>{item}</TooltipTrigger>
            <TooltipContent side="right">{available ? label : `${label} · coming soon`}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
