"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "./nav";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="grid gap-1">
      {mainNav.map(({ href, label, icon: Icon, available }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const base = "group flex h-11 items-center gap-3 rounded-xl px-3.5 text-[14.5px] font-medium transition-colors";
        if (!available) {
          return (
            <span
              key={href}
              aria-disabled="true"
              title="Coming soon"
              className={cn(base, "cursor-not-allowed text-sidebar-foreground/45")}
            >
              <Icon className="size-[19px]" aria-hidden />
              <span className="flex-1">{label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              base,
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-[19px]" aria-hidden />
            <span className="flex-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
