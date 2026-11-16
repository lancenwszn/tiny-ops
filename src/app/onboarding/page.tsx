import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceForm } from "@/features/workspaces/components/workspace-form";
import { createWorkspaceAction } from "@/features/workspaces/actions";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getMemberships } from "@/lib/workspace/active";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  await requireUser("/onboarding");
  const [{ new: isNew }, memberships, profile] = await Promise.all([searchParams, getMemberships(), getProfile()]);
  const hasWorkspaces = memberships.length > 0;
  if (hasWorkspaces && isNew !== "1") redirect("/app/dashboard");

  const firstName = profile.full_name.split(/\s+/)[0];

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,#e8f5ee_0%,transparent_60%)] px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        {hasWorkspaces && (
          <Link href="/app/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
          {hasWorkspaces ? "New workspace" : "Step 1 of 1"}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          {hasWorkspaces ? "Add another business" : `Welcome${firstName ? `, ${firstName}` : ""}! Let's set up your business.`}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Each workspace keeps its own team, SOPs, tasks and checklists completely separate.
        </p>
        <Card className="mt-7">
          <CardContent className="p-6">
            <WorkspaceForm action={createWorkspaceAction} submitLabel="Create workspace" pendingLabel="Creating workspace…" />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          Includes a 14-day free trial of the Growth plan. No card required.
        </p>
      </main>
    </div>
  );
}
