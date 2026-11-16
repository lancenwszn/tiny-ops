import Link from "next/link";
import { BookOpenText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/shared/relative-time";
import { Widget, EmptyState, SoonBadge } from "./widget";
import { modules } from "@/lib/modules";

/** Shape the SOP Library (Stage 3) provides to the dashboard. */
export type SopSummary = { id: string; title: string; category: string | null; ownerName: string | null; updatedAt: string };

export function RecentSops({ sops, canCreate }: { sops: SopSummary[] | null; canCreate: boolean }) {
  const live = sops !== null;
  const createCta =
    live && canCreate ? (
      <Button asChild size="sm">
        <Link href={`${modules.sops.href}/new`}>
          <Plus /> Create SOP
        </Link>
      </Button>
    ) : (
      <Button size="sm" disabled aria-disabled title="The SOP Library is coming soon">
        <Plus /> Create SOP <SoonBadge className="bg-white/20 text-white" />
      </Button>
    );

  return (
    <Widget
      title="Recent SOPs"
      icon={BookOpenText}
      tint="violet"
      id="recent-sops"
      action={live ? { href: modules.sops.href, label: "View all" } : <SoonBadge />}
    >
      {!live || sops.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title={live ? "No SOPs yet" : "Your SOP Library is on its way"}
          description="Document how your business runs — step by step — so anyone on the team can follow it."
          action={createCta}
        />
      ) : (
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
                <tr key={s.id} className="border-t border-border">
                  <td className="px-2 py-2.5 font-semibold">
                    <Link href={`${modules.sops.href}/${s.id}`} className="hover:text-primary">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">{s.category ? <Badge variant="violet">{s.category}</Badge> : "—"}</td>
                  <td className="px-2 py-2.5 text-muted-foreground">{s.ownerName ?? "—"}</td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    <RelativeTime iso={s.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Widget>
  );
}
