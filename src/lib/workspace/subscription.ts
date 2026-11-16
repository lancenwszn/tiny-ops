import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceSubscription = {
  planId: string;
  planName: string;
  status: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  isUsable: boolean;
};

/** Read-only view of the workspace subscription (written only by trusted server code). */
export const getWorkspaceSubscription = cache(async (workspaceId: string): Promise<WorkspaceSubscription | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan_id, status, trial_ends_at, plan:plans(name)")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) return null;

  const now = Date.now();
  const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at).getTime() : null;
  const trialDaysLeft =
    data.status === "trialing" && trialEnd !== null ? Math.max(0, Math.ceil((trialEnd - now) / 86_400_000)) : null;
  const isUsable =
    data.status === "active" || data.status === "past_due" || (data.status === "trialing" && (trialEnd === null || trialEnd > now));

  return {
    planId: data.plan_id,
    planName: (data.plan as { name: string } | null)?.name ?? data.plan_id,
    status: data.status,
    trialEndsAt: data.trial_ends_at,
    trialDaysLeft,
    isUsable,
  };
});
