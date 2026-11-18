import Link from "next/link";
import { BookOpenText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/shared/relative-time";
import { Widget, EmptyState, SoonBadge } from "./widget";
import { modules } from "@/lib/modules";

/** Shape the SOP Library provides to the dashboard. */
export type SopSummary = {
  id: string;
  title: string;
  category: string | null;
  ownerName: string | null;
  updatedAt: string;
  status: "draft" | "published" | "archived";
};

export type SopCounts = { total: number; published: number; drafts: number };

export function RecentSops({
  sops,
  canCreate,
  counts,
}: {
  sops: SopSummary[] | null;
  canCreate: boolean;
  counts?: SopCounts | null;
}) {
  const live = sops !== null;
  const createCta = !live ? (
    <Button size="sm" disabled aria-disabled title="The SOP Library is coming soon">
      <Plus /> Create SOP <SoonBadge className="bg-white/20 text-white" />
    </Button>
  ) : canCreate ? (
    <Button asChild size="sm">
      <Link href={`${modules.sops.href}/new`}>
        <Plus /> Create SOP
      </Link>
    </Button>
  ) : undefined;

  return (
    <Widget
      title="Recent SOPs"
      icon={BookOpenText}
      tint="violet"
      id="recent-sops"
      action={live ? { href: modules.sops.href, label: "View all" } : <SoonBadge />}
    >
      {live && counts && counts.total > 0 && (
        <dl className={canCreate ? "mb-4 grid grid-cols-3 gap-2" : "mb-4 grid grid-cols-1 gap-2"} data-testid="sop-counts">
          {canCreate ? (
            <>
              <Stat label="Active SOPs" value={counts.total} />
              <Stat label="Published" value={counts.published} />
              <Stat label="Drafts" value={counts.drafts} />
            </>
          ) : (
            // Members can only read published SOPs (RLS), so drafts are never counted for them.
            <Stat label="SOPs available to you" value={counts.published} />
          )}
        </dl>
      )}
      {!live || sops.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title={!live ? "Your SOP Library is on its way" : canCreate ? "No SOPs yet" : "No SOPs published yet"}
          description={
            canCreate || !live
              ? "Document how your business runs — step by step — so anyone on the team can follow it."
              : "When your team publishes procedures, they'll appear here."
          }
          action={createCta}
        />
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-2 pb-2 font-semibold">SOP</th>
                  <th className="px-2 pb-2 font-semibold">Category</th>
                  <th className="px-2 pb-2 font-semibold">Owner</th>
                  <th className="px-2 pb-2 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {sops.map((s) => (
                  <tr key={s.id} className="border-t border-border" data-testid="recent-sop">
                    <td className="max-w-[260px] px-2 py-2.5">
                      <Link href={`${modules.sops.href}/${s.id}`} className="block truncate font-semibold hover:text-primary">
                        {s.title}
                      </Link>
                      {s.status === "draft" && <span className="text-xs font-semibold text-tint-amber-fg">Draft</span>}
                    </td>
                    <td className="px-2 py-2.5">{s.category ? <Badge variant="violet">{s.category}</Badge> : "—"}</td>
                    <td className="px-2 py-2.5 text-muted-foreground">{s.ownerName ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">
                      <RelativeTime iso={s.updatedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canCreate && <div className="mt-auto pt-3">{createCta}</div>}
        </>
      )}
    </Widget>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-lg font-extrabold">{value}</dd>
    </div>
  );
}
