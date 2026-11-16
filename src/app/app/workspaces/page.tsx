import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { WorkspaceAvatar } from "@/components/layout/workspace-avatar";
import { SwitchWorkspaceButton } from "@/features/workspaces/components/switch-workspace-button";
import { getActiveMembership, getMemberships } from "@/lib/workspace/active";

export const metadata: Metadata = { title: "Workspaces" };

export default async function WorkspacesPage() {
  const [memberships, active] = await Promise.all([getMemberships(), getActiveMembership()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Workspaces"
        description="Each business you work with has its own separate workspace."
        actions={
          <Button asChild>
            <Link href="/onboarding?new=1">
              <Plus /> New workspace
            </Link>
          </Button>
        }
      />
      <Card className="divide-y divide-border">
        {memberships.map((m) => {
          const isActive = m.workspace.id === active.workspace.id;
          return (
            <div key={m.workspace.id} className="flex items-center gap-4 p-4 sm:px-5">
              <WorkspaceAvatar name={m.workspace.name} logoPath={m.workspace.logo_path} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.workspace.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{m.workspace.timezone.replaceAll("_", " ")}</p>
              </div>
              <Badge variant={m.role === "owner" ? "green" : m.role === "admin" ? "violet" : "muted"} className="capitalize">
                {m.role}
              </Badge>
              {isActive ? <Badge variant="outline">Current</Badge> : <SwitchWorkspaceButton workspaceId={m.workspace.id} />}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
