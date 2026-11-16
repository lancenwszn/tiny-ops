import { Sparkles } from "lucide-react";
import type { WorkspaceSubscription } from "@/lib/workspace/subscription";

/** Sidebar footer card showing the workspace's real plan / trial state. */
export function PlanCard({ subscription }: { subscription: WorkspaceSubscription | null }) {
  if (!subscription) return null;

  const trial = subscription.status === "trialing";
  const title = trial ? `${subscription.planName} trial` : `${subscription.planName} plan`;
  const detail = !subscription.isUsable
    ? "Your trial has ended. Billing opens in an upcoming release."
    : trial
      ? `${subscription.trialDaysLeft} ${subscription.trialDaysLeft === 1 ? "day" : "days"} left in your free trial.`
      : "Thanks for supporting TinyOps.";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-secondary p-4">
      <div aria-hidden className="absolute -right-6 -top-6 size-20 rounded-3xl bg-primary/10 rotate-12" />
      <div className="relative flex items-center gap-2 text-sm font-bold text-secondary-foreground">
        <Sparkles className="size-4" aria-hidden />
        {title}
      </div>
      <p className="relative mt-1.5 text-[13px] leading-snug text-secondary-foreground/80">{detail}</p>
    </div>
  );
}
