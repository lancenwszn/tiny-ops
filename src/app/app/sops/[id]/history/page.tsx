import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GitCompareArrows, History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SopContentView } from "@/features/sops/components/sop-content";
import { VersionCompare } from "@/features/sops/components/version-compare";
import { RestoreButton } from "@/features/sops/components/restore-button";
import { EmptyState } from "@/features/dashboard/components/widget";
import { getSopEditorData, getVersionContent, listVersions } from "@/features/sops/queries";
import { canManageOperations, getActiveMembership } from "@/lib/workspace/active";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Version history" };

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function SopHistoryPage({ params, searchParams }: PageProps<"/app/sops/[id]/history">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const { workspace, role } = await getActiveMembership();
  if (!canManageOperations(role)) redirect(`/app/sops/${id}`);

  const editor = await getSopEditorData(id, workspace.id);
  if (!editor) notFound();
  const versions = await listVersions(id);
  const latest = versions[0]?.version ?? 0;

  const num = (v: unknown) => (typeof v === "string" && /^\d{1,6}$/.test(v) ? Number(v) : null);
  const selected = num(sp.v) ?? latest;
  const compareTo = num(sp.compare);

  const [selectedContent, compareContent] = await Promise.all([
    selected ? getVersionContent(id, selected) : null,
    compareTo ? getVersionContent(id, compareTo) : null,
  ]);

  return (
    <div className="mx-auto max-w-[1300px]">
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href={`/app/sops/${id}`}>
          <ArrowLeft /> Back to SOP
        </Link>
      </Button>
      <PageHeader title="Version history" description={editor.doc.title} />

      {versions.length === 0 ? (
        <EmptyState icon={History} title="Not published yet" description="Each time you publish, a version is saved here so you can review, compare or restore it." className="py-14" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ol className="grid content-start gap-2" aria-label="Versions">
            {versions.map((v) => (
              <li key={v.version}>
                <Link
                  href={`/app/sops/${id}/history?v=${v.version}`}
                  aria-current={v.version === selected ? "true" : undefined}
                  className={cn(
                    "block rounded-xl border p-3 transition-colors",
                    v.version === selected ? "border-primary bg-secondary/60" : "border-border bg-card hover:bg-muted",
                  )}
                  data-testid="version-item"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Version {v.version}</span>
                    {v.version === latest && <Badge variant="green">Current</Badge>}
                    {v.restoredFrom && (
                      <Badge variant="sky">
                        <RotateCcw /> from v{v.restoredFrom}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {DATE.format(new Date(v.publishedAt))}
                    {v.publishedBy && ` · ${v.publishedBy}`}
                  </p>
                  {v.note && <p className="mt-1.5 line-clamp-2 text-[13px] text-foreground/80">{v.note}</p>}
                </Link>
              </li>
            ))}
          </ol>

          <div className="grid min-w-0 content-start gap-5">
            {selectedContent && (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      Viewing version {selected} {selected === latest && <span className="font-medium text-muted-foreground">(current)</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{selectedContent.title}</p>
                  </div>
                  {versions.length > 1 && (
                    <form className="flex items-center gap-2" action={`/app/sops/${id}/history`}>
                      <input type="hidden" name="v" value={selected} />
                      <label htmlFor="compare" className="text-sm text-muted-foreground">
                        Compare with
                      </label>
                      <select
                        id="compare"
                        name="compare"
                        defaultValue={compareTo ?? ""}
                        className="h-9 cursor-pointer rounded-lg border border-input bg-card px-2 text-sm"
                      >
                        {versions
                          .filter((v) => v.version !== selected)
                          .map((v) => (
                            <option key={v.version} value={v.version}>
                              v{v.version}
                            </option>
                          ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        <GitCompareArrows /> Compare
                      </Button>
                    </form>
                  )}
                  {selected !== latest && editor.doc.status !== "archived" && (
                    <RestoreButton sopId={id} version={selected} latest={latest} hasUnpublished={editor.draft.dirty} />
                  )}
                </div>

                {compareContent && compareTo && (
                  <VersionCompare
                    from={Math.min(compareTo, selected)}
                    to={Math.max(compareTo, selected)}
                    a={compareTo < selected ? compareContent : selectedContent}
                    b={compareTo < selected ? selectedContent : compareContent}
                  />
                )}

                <SopContentView content={selectedContent} attachments={editor.attachments} imageUrls={editor.imageUrls} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
