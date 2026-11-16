import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PlanCard } from "@/components/layout/plan-card";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-cookie";
import { UserMenu } from "@/components/layout/user-menu";
import { WorkspaceSwitcher, type WorkspaceItem } from "@/components/layout/workspace-switcher";
import { NoticeToaster } from "@/components/shared/notice-toaster";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getUnreadNotificationCount } from "@/features/notifications/queries";
import { HelpMenu } from "@/features/help/help-menu";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getActiveMembership, getMemberships, type Membership } from "@/lib/workspace/active";
import { getWorkspaceSubscription } from "@/lib/workspace/subscription";
import { brandingUrl } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser("/app/dashboard");
  const [active, memberships, profile, cookieStore] = await Promise.all([
    getActiveMembership(),
    getMemberships(),
    getProfile(),
    cookies(),
  ]);
  const [subscription, unreadCount] = await Promise.all([
    getWorkspaceSubscription(active.workspace.id),
    getUnreadNotificationCount(active.workspace.id),
  ]);

  const toItem = (m: Membership): WorkspaceItem => ({
    id: m.workspace.id,
    name: m.workspace.name,
    logoPath: m.workspace.logo_path,
    role: m.role,
  });
  const current = toItem(active);
  const workspaces = memberships.map(toItem);
  const planCard = <PlanCard subscription={subscription} />;
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex min-h-dvh">
      <AppSidebar initialCollapsed={collapsed} current={current} workspaces={workspaces} footer={planCard} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
          <MobileNav footer={planCard} current={current} workspaces={workspaces} />
          <div className="min-w-0 flex-1">
            <GlobalSearch workspaceName={active.workspace.name} workspaces={workspaces} currentId={current.id} />
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <NotificationBell unreadCount={unreadCount} />
            <HelpMenu />
            <span aria-hidden className="mx-1 hidden h-7 w-px bg-border sm:block" />
            <UserMenu name={profile.full_name} email={user.email} avatarUrl={brandingUrl(profile.avatar_path)} />
          </div>
        </header>
        <div className="border-b border-border bg-card px-3 py-2 lg:hidden">
          <WorkspaceSwitcher current={current} workspaces={workspaces} className="h-11" />
        </div>
        <main className="flex-1 px-3 py-5 sm:px-6 lg:px-7 lg:py-6">{children}</main>
      </div>
      <Suspense>
        <NoticeToaster />
      </Suspense>
    </div>
  );
}
