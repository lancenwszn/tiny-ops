import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WorkspaceForm } from "@/features/workspaces/components/workspace-form";
import { WorkspaceLogoUpload } from "@/features/workspaces/components/workspace-logo-upload";
import { updateWorkspaceAction } from "@/features/workspaces/actions";
import { getActiveMembership } from "@/lib/workspace/active";
import { brandingUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Workspace settings" };

export default async function WorkspaceSettingsPage() {
  const { workspace, role } = await getActiveMembership();
  const isOwner = role === "owner";

  return (
    <>
      {!isOwner && (
        <Alert>
          <Lock />
          <AlertDescription>Only the workspace owner can change these settings.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>Business logo</CardTitle>
          <CardDescription>Shown in the workspace switcher and across TinyOps.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceLogoUpload
            workspaceId={workspace.id}
            name={workspace.name}
            logoUrl={brandingUrl(workspace.logo_path)}
            disabled={!isOwner}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>Business details</CardTitle>
          <CardDescription>Your business name, description and operating timezone.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceForm
            key={workspace.id}
            action={updateWorkspaceAction}
            defaults={{ name: workspace.name, timezone: workspace.timezone, description: workspace.description }}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            readOnly={!isOwner}
          />
        </CardContent>
      </Card>
    </>
  );
}
