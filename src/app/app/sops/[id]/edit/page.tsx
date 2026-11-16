import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SopEditor } from "@/features/sops/components/sop-editor";
import { getSopEditorData, listActiveMembers, listCategories } from "@/features/sops/queries";
import { canManageOperations, getActiveMembership } from "@/lib/workspace/active";

export const metadata: Metadata = { title: "Edit SOP" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditSopPage({ params }: PageProps<"/app/sops/[id]/edit">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { workspace, role } = await getActiveMembership();
  if (!canManageOperations(role)) redirect(`/app/sops/${id}`);

  const [data, categories, members] = await Promise.all([
    getSopEditorData(id, workspace.id),
    listCategories(workspace.id),
    listActiveMembers(workspace.id),
  ]);
  if (!data) notFound();

  return (
    <SopEditor
      key={id}
      sopId={id}
      workspaceId={workspace.id}
      status={data.doc.status}
      currentVersion={data.doc.currentVersion}
      initial={{
        title: data.draft.title,
        description: data.draft.description,
        categoryId: data.doc.category?.id ?? null,
        ownerId: data.doc.owner?.id ?? null,
        requiresAcknowledgment: data.doc.requiresAcknowledgment,
        sections: data.draft.sections,
        steps: data.steps,
        revision: data.draft.revision,
        updatedAt: data.draft.updatedAt,
        dirty: data.draft.dirty,
      }}
      attachments={data.attachments.map((a) => ({ ...a, previewUrl: data.imageUrls[a.id] ?? null }))}
      imageUrls={data.imageUrls}
      categories={categories}
      members={members}
      access={{ visibility: data.doc.visibility, ...data.access }}
    />
  );
}
