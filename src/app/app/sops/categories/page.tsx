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
  const [categories, { data: docs }, { data: drafts }] = await Promise.all([
    listCategories(workspace.id),
    // Archived SOPs and unpublished category changes also block deletion.
    supabase.from("sop_documents").select("id, category_id").eq("workspace_id", workspace.id).limit(10000),
    supabase.from("sop_drafts").select("sop_id, category_id").eq("workspace_id", workspace.id).limit(10000),
  ]);
  const sopsByCategory = new Map<string, Set<string>>();
  const add = (cat: string | null, sop: string) => {
    if (!cat) return;
    if (!sopsByCategory.has(cat)) sopsByCategory.set(cat, new Set());
    sopsByCategory.get(cat)!.add(sop);
  };
  for (const d of docs ?? []) add(d.category_id, d.id);
  for (const d of drafts ?? []) add(d.category_id, d.sop_id);
  const totals = new Map([...sopsByCategory].map(([cat, set]) => [cat, set.size]));

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
