import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryManager } from "@/features/sops/components/category-manager";
import { listCategories } from "@/features/sops/queries";
import { createClient } from "@/lib/supabase/server";
import { canManageOperations, getActiveMembership } from "@/lib/workspace/active";

export const metadata: Metadata = { title: "SOP categories" };

export default async function CategoriesPage() {
  const { workspace, role } = await getActiveMembership();
  if (!canManageOperations(role)) redirect("/app/sops");
  const supabase = await createClient();
  const [categories, { data: all }] = await Promise.all([
    listCategories(workspace.id),
    // Archived SOPs also block deletion, so count every status.
    supabase.from("sop_documents").select("category_id").eq("workspace_id", workspace.id).limit(10000),
  ]);
  const totals = new Map<string, number>();
  for (const d of all ?? []) if (d.category_id) totals.set(d.category_id, (totals.get(d.category_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/app/sops">
          <ArrowLeft /> SOP Library
        </Link>
      </Button>
      <PageHeader title="Categories" description="Organise your SOP Library. Archived categories stay on existing SOPs but can't be chosen for new ones." />
      <CategoryManager categories={categories.map((c) => ({ ...c, totalCount: totals.get(c.id) ?? 0 }))} />
    </div>
  );
}
