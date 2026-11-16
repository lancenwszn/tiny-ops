import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PlanCard } from "@/components/layout/plan-card";
import { UserMenu } from "@/components/layout/user-menu";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { NoticeToaster } from "@/components/shared/notice-toaster";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getActiveMembership, getMemberships } from "@/lib/workspace/active";
import { getWorkspaceSubscription } from "@/lib/workspace/subscription";
import { brandingUrl } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser("/app/dashboard");
  const [active, memberships, profile] = await Promise.all([getActiveMembership(), getMemberships(), getProfile()]);
  const subscription = await getWorkspaceSubscription(active.workspace.id);

  const toItem = (m: (typeof memberships)[number]) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    logoPath: m.workspace.logo_path,
    role: m.role,
  });

  const planCard = <PlanCard subscription={subscription} />;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-7 border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <Link href="/app/dashboard" className="px-2" aria-label="TinyOps dashboard">
          <Logo />
        </Link>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <SidebarNav />
        </div>
        {planCard}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md sm:px-6">
          <MobileNav footer={planCard} />
          <WorkspaceSwitcher current={toItem(active)} workspaces={memberships.map(toItem)} />
          <div className="ml-auto flex items-center gap-2">
            <UserMenu name={profile.full_name} email={user.email} avatarUrl={brandingUrl(profile.avatar_path)} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <Suspense>
        <NoticeToaster />
      </Suspense>
    </div>
  );
}
