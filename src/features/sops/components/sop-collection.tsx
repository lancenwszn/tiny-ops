import Link from "next/link";
import { BookOpenText, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RelativeTime } from "@/components/shared/relative-time";
import { CategoryBadge, RestrictedBadge, SopStatusBadge, UnpublishedBadge } from "./sop-badges";
import { SopRowActions } from "./sop-row-actions";
import type { SopListItem } from "../queries";
import { brandingUrl } from "@/lib/env";
import { initials } from "@/lib/utils";

function Owner({ owner }: { owner: SopListItem["owner"] }) {
  if (!owner) return <span className="text-muted-foreground">No owner</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6">
        {owner.avatarPath && <AvatarImage src={brandingUrl(owner.avatarPath)!} alt="" />}
        <AvatarFallback className="text-[10px]">{initials(owner.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{owner.name}</span>
    </span>
  );
}

export function SopTable({ sops, canManage }: { sops: SopListItem[]; canManage: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_40px] gap-4 border-b border-border bg-muted/50 px-5 py-2.5 text-xs font-semibold text-muted-foreground md:grid">
        <span>SOP</span>
        <span>Category</span>
        <span>Owner</span>
        <span>Last updated</span>
        <span>Status</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="divide-y divide-border">
        {sops.map((s) => (
          <li
            key={s.id}
            className="grid grid-cols-[minmax(0,1fr)_40px] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_40px]"
            data-testid="sop-row"
          >
            <div className="min-w-0">
              <Link href={`/app/sops/${s.id}`} className="block truncate font-semibold hover:text-primary">
                {s.title}
              </Link>
              <p className="truncate text-[13px] text-muted-foreground">{s.description || "No description"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                {s.category && <CategoryBadge name={s.category.name} color={s.category.color} />}
                <SopStatusBadge status={s.status} />
              </div>
            </div>
            <div className="order-last md:order-none">
              <div className="flex flex-wrap gap-1.5">
                <span className="hidden md:inline">{s.category ? <CategoryBadge name={s.category.name} color={s.category.color} /> : <span className="text-sm text-muted-foreground">—</span>}</span>
                {s.visibility === "restricted" && <span className="hidden md:inline"><RestrictedBadge /></span>}
              </div>
            </div>
            <div className="hidden text-sm md:block">
              <Owner owner={s.owner} />
            </div>
            <div className="hidden text-sm text-muted-foreground md:block">
              <RelativeTime iso={s.updatedAt} />
            </div>
            <div className="hidden flex-wrap gap-1.5 md:flex">
              <SopStatusBadge status={s.status} />
              {canManage && s.hasUnpublishedChanges && s.status === "published" && <UnpublishedBadge />}
            </div>
            <div className="row-start-1 flex justify-end md:row-auto">
              <SopRowActions sopId={s.id} title={s.title} status={s.status} canManage={canManage} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SopCards({ sops, canManage }: { sops: SopListItem[]; canManage: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sops.map((s) => (
        <li key={s.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated" data-testid="sop-card">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tint-violet text-tint-violet-fg">
              <BookOpenText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/app/sops/${s.id}`} className="line-clamp-2 font-bold leading-snug hover:text-primary">
                {s.title}
              </Link>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.category && <CategoryBadge name={s.category.name} color={s.category.color} />}
                <SopStatusBadge status={s.status} />
                {s.visibility === "restricted" && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="size-3" /> Restricted
                  </span>
                )}
              </div>
            </div>
            <SopRowActions sopId={s.id} title={s.title} status={s.status} canManage={canManage} />
          </div>
          <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{s.description || "No description"}</p>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
            <Owner owner={s.owner} />
            <span className="shrink-0 text-muted-foreground">
              {s.currentVersion > 0 && `v${s.currentVersion} · `}
              <RelativeTime iso={s.updatedAt} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
