import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type Tint = "green" | "violet" | "coral" | "sky" | "amber" | "muted";

export const tintClasses: Record<Tint, string> = {
  green: "bg-tint-green text-tint-green-fg",
  violet: "bg-tint-violet text-tint-violet-fg",
  coral: "bg-tint-coral text-tint-coral-fg",
  sky: "bg-tint-sky text-tint-sky-fg",
  amber: "bg-tint-amber text-tint-amber-fg",
  muted: "bg-muted text-muted-foreground",
};

/** Standard dashboard card: icon + title header, optional "View all" link. */
export function Widget({
  title,
  icon: Icon,
  tint = "green",
  action,
  className,
  bodyClassName,
  children,
  id,
}: {
  title: string;
  icon: LucideIcon;
  tint?: Tint;
  action?: { href: string; label: string } | React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Card className={cn("h-full min-w-0", className)} aria-labelledby={headingId} role="region">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tintClasses[tint])}>
          <Icon className="size-[17px]" aria-hidden />
        </span>
        <h2 id={headingId} className="flex-1 truncate text-[15px] font-bold">
          {title}
        </h2>
        {action && typeof action === "object" && "href" in action ? (
          <Link href={action.href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-primary">
            {action.label} <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          action
        )}
      </div>
      <div className={cn("flex flex-1 flex-col px-5 pb-5 pt-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function WidgetSkeleton({ className, rows = 3 }: { className?: string; rows?: number }) {
  return (
    <Card className={cn("h-full p-5", className)} aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mt-5 grid gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-xl" />
        ))}
      </div>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-5 py-7 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-[30ch] text-[13px] leading-snug text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SoonBadge({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground", className)}>
      Soon
    </span>
  );
}
