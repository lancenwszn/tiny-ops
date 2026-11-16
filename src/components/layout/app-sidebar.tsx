"use client";

import Link from "next/link";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarNav } from "./sidebar-nav";
import { WorkspaceSwitcher, type WorkspaceItem } from "./workspace-switcher";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";
import { cn } from "@/lib/utils";

export function AppSidebar({
  initialCollapsed,
  current,
  workspaces,
  footer,
}: {
  initialCollapsed: boolean;
  current: WorkspaceItem;
  workspaces: WorkspaceItem[];
  footer: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // Per-viewer preference; read by the server layout to avoid a layout shift.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar py-6 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[84px] px-3" : "w-[272px] px-4",
      )}
    >
      <Link href="/app/dashboard" className={cn("flex", collapsed ? "justify-center" : "px-2")} aria-label="TinyOps dashboard">
        {collapsed ? <LogoMark className="size-9" title="" /> : <Logo />}
      </Link>

      <WorkspaceSwitcher current={current} workspaces={workspaces} compact={collapsed} />

      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        <SidebarNav collapsed={collapsed} />
      </div>

      {!collapsed && footer}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
              collapsed ? "justify-center" : "px-3.5",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && "Collapse"}
          </button>
        </TooltipTrigger>
        {collapsed && <TooltipContent side="right">Expand sidebar</TooltipContent>}
      </Tooltip>
    </aside>
  );
}
