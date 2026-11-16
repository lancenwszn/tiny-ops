import Link from "next/link";
import { ChartColumn, ClipboardPlus, FilePlus2, Repeat2, SquarePlus, UserPlus, Zap, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InviteMemberDialog } from "@/features/team/components/invite-member-dialog";
import { Widget, tintClasses, type Tint } from "./widget";
import { modules, type ModuleKey } from "@/lib/modules";
import { cn } from "@/lib/utils";

type Action = { key: string; label: string; icon: LucideIcon; tint: Tint; module: ModuleKey; href: string };

const ACTIONS: Action[] = [
  { key: "task", label: "New Task", icon: SquarePlus, tint: "green", module: "tasks", href: `${modules.tasks.href}/new` },
  { key: "sop", label: "Create SOP", icon: FilePlus2, tint: "violet", module: "sops", href: `${modules.sops.href}/new` },
  { key: "checklist", label: "New Checklist", icon: ClipboardPlus, tint: "sky", module: "checklists", href: `${modules.checklists.href}/new` },
  { key: "invite", label: "Invite Member", icon: UserPlus, tint: "green", module: "team", href: "" },
  { key: "handover", label: "Create Handover", icon: Repeat2, tint: "amber", module: "handovers", href: `${modules.handovers.href}/new` },
  { key: "report", label: "Generate Report", icon: ChartColumn, tint: "violet", module: "reports", href: modules.reports.href },
];

const tile = "relative flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-border p-3 text-center text-[12.5px] font-semibold transition-all";

export function QuickActions({ role }: { role: string }) {
  const canInvite = role === "owner" || role === "admin";
  return (
    <Widget title="Quick Actions" icon={Zap} tint="amber" id="quick-actions">
      <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
        {ACTIONS.map((a) => {
          const inner = (
            <>
              <span className={cn("flex size-10 items-center justify-center rounded-xl", tintClasses[a.tint])}>
                <a.icon className="size-5" aria-hidden />
              </span>
              <span className="leading-tight">{a.label}</span>
            </>
          );

          // Invitations work today (owners/admins); other actions open with their module.
          if (a.key === "invite") {
            return canInvite ? (
              <InviteMemberDialog key={a.key} canInviteAdmins={role === "owner"}>
                <button type="button" className={cn(tile, "cursor-pointer bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card")}>
                  {inner}
                </button>
              </InviteMemberDialog>
            ) : (
              <Disabled key={a.key} reason="Only owners and admins can invite teammates">
                {inner}
              </Disabled>
            );
          }

          // Creating SOPs is for owners and admins.
          if (a.key === "sop" && modules.sops.available && !canInvite) {
            return (
              <Disabled key={a.key} reason="Only owners and admins can create SOPs">
                {inner}
              </Disabled>
            );
          }

          if (modules[a.module].available) {
            return (
              <Link key={a.key} href={a.href} className={cn(tile, "bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card")}>
                {inner}
              </Link>
            );
          }
          return (
            <Disabled key={a.key} reason={`${modules[a.module].label} is coming soon`} soon>
              {inner}
            </Disabled>
          );
        })}
      </div>
    </Widget>
  );
}

function Disabled({ children, reason, soon }: { children: React.ReactNode; reason: string; soon?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-disabled="true" tabIndex={0} aria-label={`${reason}`} className={cn(tile, "cursor-not-allowed bg-muted/40 text-muted-foreground [&>span:first-child]:opacity-55")} data-testid="quick-action-disabled">
          {soon && <span className="absolute right-1.5 top-1.5 rounded-full bg-card px-1.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground shadow-xs">Soon</span>}
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

