import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { DashboardHero } from "@/features/dashboard/components/dashboard-hero";
import { OperationsHealth } from "@/features/dashboard/components/operations-health";
import { GettingStarted, type SetupStep } from "@/features/dashboard/components/getting-started";
import { TeamActivity } from "@/features/dashboard/components/team-activity";
import { UpcomingTasks } from "@/features/dashboard/components/upcoming-tasks";
import { OperationsCalendar } from "@/features/dashboard/components/operations-calendar";
import { RecentSops } from "@/features/dashboard/components/recent-sops";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { AiAssistant } from "@/features/dashboard/components/ai-assistant";
import { WidgetBoundary } from "@/features/dashboard/components/widget-boundary";
import { WidgetSkeleton } from "@/features/dashboard/components/widget";
import { InviteMemberDialog } from "@/features/team/components/invite-member-dialog";
import { computeKpis, computeOperationsHealth } from "@/features/dashboard/metrics";
import { todayInTimezone } from "@/features/dashboard/calendar";
import {
  getCalendarEvents,
  getOperationsInputs,
  getRecentActivity,
  getRecentSops,
  getTeamSnapshot,
  getUpcomingTasks,
} from "@/features/dashboard/queries";
import { getProfile } from "@/lib/auth/session";
import { canManageOperations, getActiveMembership } from "@/lib/workspace/active";
import { modules } from "@/lib/modules";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [{ workspace, role }, profile] = await Promise.all([getActiveMembership(), getProfile()]);
  const inputs = await getOperationsInputs(workspace.id);
  const health = computeOperationsHealth(inputs);
  const firstName = profile.full_name.split(/\s+/)[0] ?? "";
  const ws = workspace.id;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(300px,0.92fr)]">
      <div className="lg:col-span-2 xl:col-span-3">
        <DashboardHero firstName={firstName} profileTimezone={profile.timezone} workspace={workspace} role={role} kpis={computeKpis(inputs)} />
      </div>

      <Slot title="Operations Calendar" rows={6}>
        <CalendarSection workspaceId={ws} timezone={workspace.timezone} />
      </Slot>

      <WidgetBoundary title="Operations Health">
        <OperationsHealth score={health.score} rows={health.rows} />
      </WidgetBoundary>

      <Slot title="Getting Started" rows={5}>
        <SetupSection workspaceId={ws} role={role} hasLogo={Boolean(workspace.logo_path)} hasProfile={Boolean(profile.full_name && profile.avatar_path)} />
      </Slot>

      <Slot title="Team Activity" rows={4}>
        <ActivitySection workspaceId={ws} />
      </Slot>

      <Slot title="Upcoming Tasks" rows={4}>
        <UpcomingSection workspaceId={ws} />
      </Slot>

      <div className="xl:col-span-2">
        <Slot title="Recent SOPs" rows={3}>
          <SopsSection workspaceId={ws} canCreate={canManageOperations(role)} />
        </Slot>
      </div>

      <WidgetBoundary title="Quick Actions">
        <QuickActions role={role} />
      </WidgetBoundary>

      <AiAssistant />
    </div>
  );
}

/** Streams a widget with its own skeleton and error boundary. */
function Slot({ title, rows, children }: { title: string; rows: number; children: React.ReactNode }) {
  return (
    <WidgetBoundary title={title}>
      <Suspense fallback={<WidgetSkeleton rows={rows} />}>{children}</Suspense>
    </WidgetBoundary>
  );
}

async function CalendarSection({ workspaceId, timezone }: { workspaceId: string; timezone: string }) {
  const events = await getCalendarEvents(workspaceId);
  return <OperationsCalendar today={todayInTimezone(timezone)} events={events} scheduling={modules.tasks.available || modules.checklists.available} />;
}

async function SetupSection({ workspaceId, role, hasLogo, hasProfile }: { workspaceId: string; role: string; hasLogo: boolean; hasProfile: boolean }) {
  const team = await getTeamSnapshot(workspaceId);
  const canInvite = role === "owner" || role === "admin";
  const steps: SetupStep[] = [
    { key: "workspace", label: "Create your workspace", done: true },
    { key: "logo", label: "Add your business logo", done: hasLogo, href: role === "owner" ? "/app/settings" : undefined },
    { key: "profile", label: "Complete your profile", done: hasProfile, href: "/app/settings/profile" },
    {
      key: "team",
      label: "Invite your team",
      done: team.activeCount > 1 || team.pendingInvites > 0,
      action: canInvite ? (
        <InviteMemberDialog canInviteAdmins={role === "owner"}>
          <Button variant="link" size="sm" className="h-auto p-0 text-[13px]">
            Invite
          </Button>
        </InviteMemberDialog>
      ) : undefined,
    },
    { key: "sop", label: "Write your first SOP", done: false, soon: !modules.sops.available, href: modules.sops.available ? `${modules.sops.href}/new` : undefined },
    {
      key: "checklist",
      label: "Set up a recurring checklist",
      done: false,
      soon: !modules.checklists.available,
      href: modules.checklists.available ? `${modules.checklists.href}/new` : undefined,
    },
  ];
  return <GettingStarted steps={steps} />;
}

async function ActivitySection({ workspaceId }: { workspaceId: string }) {
  const [team, activity] = await Promise.all([getTeamSnapshot(workspaceId), getRecentActivity(workspaceId, 5)]);
  return <TeamActivity team={team} activity={activity} />;
}

async function UpcomingSection({ workspaceId }: { workspaceId: string }) {
  return <UpcomingTasks tasks={await getUpcomingTasks(workspaceId)} />;
}

async function SopsSection({ workspaceId, canCreate }: { workspaceId: string; canCreate: boolean }) {
  return <RecentSops sops={await getRecentSops(workspaceId)} canCreate={canCreate} />;
}
