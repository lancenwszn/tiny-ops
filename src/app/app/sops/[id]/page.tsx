import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Eye, PencilLine } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/shared/relative-time";
import { AcknowledgeCard } from "@/features/sops/components/acknowledge-card";
import { AcknowledgmentsPanel } from "@/features/sops/components/acknowledgments-panel";
import { AttachmentList } from "@/features/sops/components/attachments";
import { CategoryBadge, RestrictedBadge, SopStatusBadge, UnpublishedBadge } from "@/features/sops/components/sop-badges";
import { SopContentView } from "@/features/sops/components/sop-content";
import { SopHeaderActions } from "@/features/sops/components/sop-header-actions";
import { getAcknowledgments, getSopDetail } from "@/features/sops/queries";
import { canManageOperations, getActiveMembership } from "@/lib/workspace/active";
import { brandingUrl } from "@/lib/env";
import { initials } from "@/lib/utils";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }: PageProps<"/app/sops/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "SOP" };
  const { workspace } = await getActiveMembership();
  const detail = await getSopDetail(id, workspace.id);
  return { title: detail?.content?.title ?? detail?.doc.title ?? "SOP" };
}

export default async function SopPage({ params }: PageProps<"/app/sops/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { workspace, role } = await getActiveMembership();
  const canManage = canManageOperations(role);
  // RLS returns nothing for drafts/restricted/archived SOPs the user may not read.
  const detail = await getSopDetail(id, workspace.id);
  if (!detail) notFound();

  const { doc, content, version } = detail;
  const acks = canManage && doc.requiresAcknowledgment && doc.currentVersion > 0 ? await getAcknowledgments(id) : null;
  const title = content?.title ?? doc.title;
  const attachments = detail.attachments.map((a) => ({ ...a, previewUrl: detail.imageUrls[a.id] ?? null }));

  return (
    <div className="mx-auto max-w-[1300px]">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground">
        <Link href="/app/sops" className="hover:text-foreground">
          SOP Library
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate">{doc.category?.name ?? "Uncategorized"}</span>
      </nav>

      {detail.isPreview && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-tint-amber-fg/25 bg-tint-amber px-4 py-3 text-sm text-foreground/85">
          <Eye className="size-4 text-tint-amber-fg" /> Draft preview — members can&apos;t see this SOP until it&apos;s published.
        </div>
      )}
      {canManage && doc.hasUnpublishedChanges && doc.currentVersion > 0 && doc.status !== "archived" && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <PencilLine className="size-4 text-tint-amber-fg" />
          <span className="flex-1">There are unpublished edits. Your team is reading version {doc.currentVersion}.</span>
          <Link href={`/app/sops/${id}/edit`} className="font-semibold text-primary hover:underline">
            Continue editing
          </Link>
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <SopStatusBadge status={doc.status} />
            {doc.category && <CategoryBadge name={doc.category.name} color={doc.category.color} />}
            {doc.visibility === "restricted" && <RestrictedBadge />}
            {version && <span className="text-xs font-semibold text-muted-foreground">Version {version.number}</span>}
            {canManage && doc.hasUnpublishedChanges && doc.currentVersion > 0 && <UnpublishedBadge />}
          </div>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px]">{title}</h1>
          {(content?.description ?? doc.description) && <p className="mt-2 text-[15px] text-muted-foreground">{content?.description ?? doc.description}</p>}
        </div>
        {canManage && <SopHeaderActions sopId={id} title={title} status={doc.status} />}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-5">
          {doc.requiresAcknowledgment && doc.status === "published" && (
            <div className="lg:hidden">
              <AcknowledgeCard sopId={id} currentVersion={doc.currentVersion} myAcknowledgment={detail.myAcknowledgment} />
            </div>
          )}
          {content ? (
            <SopContentView content={content} attachments={detail.attachments} imageUrls={detail.imageUrls} />
          ) : (
            <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">This SOP has no content yet.</p>
          )}
          {attachments.length > 0 && (
            <section aria-labelledby="sec-files">
              <h2 id="sec-files" className="mb-3 text-lg font-bold">
                Attachments
              </h2>
              <AttachmentList attachments={attachments} />
            </section>
          )}
        </div>

        <aside className="grid content-start gap-5">
          {doc.requiresAcknowledgment && doc.status === "published" && (
            <div className="hidden lg:block">
              <AcknowledgeCard sopId={id} currentVersion={doc.currentVersion} myAcknowledgment={detail.myAcknowledgment} />
            </div>
          )}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card" aria-label="Details">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">SOP owner</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {doc.owner ? (
                    <>
                      <Avatar className="size-7">
                        {doc.owner.avatarPath && <AvatarImage src={brandingUrl(doc.owner.avatarPath)!} alt="" />}
                        <AvatarFallback className="text-[10px]">{initials(doc.owner.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{doc.owner.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No owner</span>
                  )}
                </dd>
              </div>
              {version && (
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Published</dt>
                  <dd className="mt-0.5">
                    Version {version.number} · {DATE.format(new Date(version.publishedAt))}
                    {version.publishedBy && <span className="text-muted-foreground"> by {version.publishedBy}</span>}
                  </dd>
                  {version.note && <dd className="mt-1 rounded-lg bg-muted px-2.5 py-1.5 text-[13px] text-muted-foreground">“{version.note}”</dd>}
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Last updated</dt>
                <dd className="mt-0.5">
                  <RelativeTime iso={doc.updatedAt} />
                </dd>
              </div>
            </dl>
            {!canManage && (
              <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                <Link href="/app/sops">Back to library</Link>
              </Button>
            )}
          </section>
          {acks && <AcknowledgmentsPanel rows={acks} currentVersion={doc.currentVersion} />}
        </aside>
      </div>
    </div>
  );
}
