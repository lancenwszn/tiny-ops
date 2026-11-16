import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { NewSopForm } from "@/features/sops/components/new-sop-form";
import { listCategories } from "@/features/sops/queries";
import { canManageOperations, getActiveMembership } from "@/lib/workspace/active";

export const metadata: Metadata = { title: "New SOP" };

export default async function NewSopPage() {
  const { workspace, role } = await getActiveMembership();
  if (!canManageOperations(role)) redirect("/app/sops");
  const categories = (await listCategories(workspace.id)).filter((c) => !c.archivedAt);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New SOP" description="Start with the basics — you'll write the procedure on the next screen. It stays a draft until you publish." />
      <Card>
        <CardContent className="p-6">
          <NewSopForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
        </CardContent>
      </Card>
    </div>
  );
}
