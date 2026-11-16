import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpenText, FolderCog, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/features/dashboard/components/widget";
import { LibraryToolbar } from "@/features/sops/components/library-toolbar";
import { SopCards, SopTable } from "@/features/sops/components/sop-collection";
import { getSopStats, listCategories, listSops } from "@/features/sops/queries";
import { SOP_SORTS, SOP_STATUSES, type SopSort, type SopStatus } from "@/features/sops/schemas";
import { canManageOperations, getActiveMembership } from "@/lib/workspace/active";

export const metadata: Metadata = { title: "SOP Library" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function SopLibraryPage({ searchParams }: PageProps<"/app/sops">) {
  const sp = await searchParams;
  const { workspace, role } = await getActiveMembership();
  const canManage = canManageOperations(role);

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const q = str(sp.q)?.slice(0, 100);
  const categoryId = str(sp.category) && UUID.test(str(sp.category)!) ? str(sp.category) : undefined;
  const status = SOP_STATUSES.includes(str(sp.status) as SopStatus) && canManage ? (str(sp.status) as SopStatus) : undefined;
  const sort = SOP_SORTS.includes(str(sp.sort) as SopSort) ? (str(sp.sort) as SopSort) : "updated";
  const view = str(sp.view) === "cards" ? "cards" : "list";

  const [categories, stats, sops] = await Promise.all([
    listCategories(workspace.id),
    getSopStats(workspace.id),
    listSops(workspace.id, { q, categoryId, status, sort }),
  ]);
  const filtered = Boolean(q || categoryId || status);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="SOP Library"
        description={
          stats.total === 0
            ? "Standard operating procedures for how your business runs."
            : `${stats.published} published${canManage ? ` · ${stats.drafts} ${stats.drafts === 1 ? "draft" : "drafts"}` : ""}`
        }
        actions={
          canManage ? (
            <>
              <Button variant="outline" asChild>
                <Link href="/app/sops/categories">
                  <FolderCog /> Categories
                </Link>
              </Button>
              <Button asChild>
                <Link href="/app/sops/new">
                  <Plus /> New SOP
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      <Suspense>
        <LibraryToolbar categories={categories.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))} canSeeDrafts={canManage} />
      </Suspense>

      <div className="mt-5">
        {sops.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title="No SOPs match" description="Try a different search, category or status." className="py-14" />
          ) : (
            <EmptyState
              icon={BookOpenText}
              title={canManage ? "Create your first SOP" : "No SOPs published yet"}
              description={
                canManage
                  ? "Document a routine your team repeats — opening up, handling refunds, onboarding a new hire."
                  : "When your team publishes procedures, you'll find them here."
              }
              action={
                canManage ? (
                  <Button asChild>
                    <Link href="/app/sops/new">
                      <Plus /> New SOP
                    </Link>
                  </Button>
                ) : undefined
              }
              className="py-14"
            />
          )
        ) : view === "cards" ? (
          <SopCards sops={sops} canManage={canManage} />
        ) : (
          <SopTable sops={sops} canManage={canManage} />
        )}
        {sops.length > 0 && (
          <p className="mt-3 text-[13px] text-muted-foreground" aria-live="polite">
            Showing {sops.length} {sops.length === 1 ? "SOP" : "SOPs"}
          </p>
        )}
      </div>
    </div>
  );
}
