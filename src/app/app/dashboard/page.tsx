import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Clock, Globe, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Greeting } from "@/features/dashboard/components/greeting";
import { WorkspaceAvatar } from "@/components/layout/workspace-avatar";
import { getProfile } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/workspace/active";
import { getWorkspaceSubscription } from "@/lib/workspace/subscription";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [{ workspace, role }, profile] = await Promise.all([getActiveMembership(), getProfile()]);
  const supabase = await createClient();
  const [{ count: memberCount }, subscription] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "active"),
    getWorkspaceSubscription(workspace.id),
  ]);

  const firstName = profile.full_name.split(/\s+/)[0] ?? "";

  // Real setup progress for this workspace. Items for modules that ship in
  // later stages are shown as upcoming rather than as fake actions.
  const setup = [
    { label: "Create your workspace", done: true },
    { label: "Add your business logo", done: Boolean(workspace.logo_path), href: "/app/settings", owner: true },
    { label: "Complete your profile", done: Boolean(profile.full_name && profile.avatar_path), href: "/app/settings/profile" },
    { label: "Write your first SOP", upcoming: true },
    { label: "Set up a recurring checklist", upcoming: true },
    { label: "Invite your team", upcoming: true },
  ];
  const doneCount = setup.filter((s) => s.done).length;

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(115deg,#ffffff_0%,#f1f9f4_55%,#e3f4ea_100%)] p-6 shadow-card sm:p-8">
        <div aria-hidden className="absolute -right-10 -top-16 size-56 rotate-12 rounded-[3rem] bg-primary/[0.07]" />
        <div aria-hidden className="absolute -bottom-20 right-24 size-40 -rotate-6 rounded-[2.5rem] bg-primary/[0.05]" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <Greeting firstName={firstName} timezone={profile.timezone} />
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 pr-5 backdrop-blur">
            <WorkspaceAvatar name={workspace.name} logoPath={workspace.logo_path} className="size-11 rounded-xl" />
            <div>
              <p className="font-bold leading-tight">{workspace.name}</p>
              <p className="text-[13px] text-muted-foreground">
                Signed in as <span className="capitalize">{role}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Get your workspace ready</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {doneCount} of {setup.length} steps complete
              </p>
            </div>
            <Badge variant="green">{Math.round((doneCount / setup.length) * 100)}%</Badge>
          </CardHeader>
          <CardContent>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={setup.length} aria-label="Setup progress">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
            </div>
            <ul className="grid gap-1">
              {setup.map((item) => {
                const canAct = item.href && !item.done && (!item.owner || role === "owner");
                const content = (
                  <>
                    {item.done ? (
                      <CheckCircle2 className="size-5 text-primary" aria-hidden />
                    ) : (
                      <Circle className="size-5 text-muted-foreground/50" aria-hidden />
                    )}
                    <span className={cn("flex-1 text-[14.5px]", item.done && "text-muted-foreground line-through")}>{item.label}</span>
                    {item.upcoming && <Badge variant="muted">Coming soon</Badge>}
                    {canAct && <ArrowRight className="size-4 text-primary" aria-hidden />}
                  </>
                );
                return (
                  <li key={item.label}>
                    {canAct ? (
                      <Link href={item.href!} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Stat icon={Users} tint="bg-tint-sky text-tint-sky-fg" label="Active members" value={String(memberCount ?? 0)} />
            <Stat icon={Globe} tint="bg-tint-violet text-tint-violet-fg" label="Business timezone" value={workspace.timezone.replaceAll("_", " ")} />
            <Stat
              icon={ShieldCheck}
              tint="bg-tint-green text-tint-green-fg"
              label="Plan"
              value={subscription ? `${subscription.planName}${subscription.status === "trialing" ? " (trial)" : ""}` : "None"}
            />
            {subscription?.trialDaysLeft !== null && subscription?.trialDaysLeft !== undefined && (
              <Stat icon={Clock} tint="bg-tint-amber text-tint-amber-fg" label="Trial remaining" value={`${subscription.trialDaysLeft} days`} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  tint,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex size-10 items-center justify-center rounded-xl", tint)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="truncate font-semibold">{value}</p>
      </div>
    </div>
  );
}
