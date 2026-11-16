"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormMessage, SubmitButton, TextField, TextareaField } from "@/components/shared/form";
import { initialFormState } from "@/lib/forms";
import { deleteCategoryAction, saveCategoryAction, setCategoryArchivedAction } from "../actions";
import type { CategoryColor, SopCategory } from "../queries";
import { CategoryBadge } from "./sop-badges";
import { cn } from "@/lib/utils";

type Cat = SopCategory & { sopCount: number; totalCount: number };

const COLORS: CategoryColor[] = ["green", "sky", "violet", "amber", "coral", "muted"];
const SWATCH: Record<CategoryColor, string> = {
  green: "bg-tint-green-fg",
  sky: "bg-tint-sky-fg",
  violet: "bg-tint-violet-fg",
  amber: "bg-tint-amber-fg",
  coral: "bg-tint-coral-fg",
  muted: "bg-muted-foreground",
};

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const [editing, setEditing] = useState<Cat | "new" | null>(null);
  const [deleting, setDeleting] = useState<Cat | null>(null);
  const active = categories.filter((c) => !c.archivedAt);
  const archived = categories.filter((c) => c.archivedAt);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> New category
        </Button>
      </div>
      <CategoryList title="Active categories" items={active} onEdit={setEditing} onDelete={setDeleting} />
      {archived.length > 0 && <CategoryList title="Archived" items={archived} onEdit={setEditing} onDelete={setDeleting} className="mt-6" />}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing !== null && <CategoryForm key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
      <DeleteDialog category={deleting} others={active.filter((c) => c.id !== deleting?.id)} onClose={() => setDeleting(null)} />
    </>
  );
}

function CategoryList({
  title,
  items,
  onEdit,
  onDelete,
  className,
}: {
  title: string;
  items: Cat[];
  onEdit: (c: Cat) => void;
  onDelete: (c: Cat) => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-card", className)} aria-label={title}>
      <h2 className="border-b border-border bg-muted/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <ul className="divide-y divide-border">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-5 py-3.5" data-testid="category-row">
            <div className="min-w-0 flex-1">
              <CategoryBadge name={c.name} color={c.color} />
              {c.description && <p className="mt-1 truncate text-[13px] text-muted-foreground">{c.description}</p>}
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {c.sopCount} {c.sopCount === 1 ? "SOP" : "SOPs"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(c)}>
                  <Pencil /> Rename or describe
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    start(async () => {
                      const res = await setCategoryArchivedAction(c.id, !c.archivedAt);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success(c.archivedAt ? "Category restored" : "Category archived");
                      router.refresh();
                    })
                  }
                >
                  {c.archivedAt ? <ArchiveRestore /> : <Archive />} {c.archivedAt ? "Restore" : "Archive"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(c)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryForm({ category, onDone }: { category: Cat | null; onDone: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState(async (prev: typeof initialFormState, fd: FormData) => {
    const res = await saveCategoryAction(prev, fd);
    if (res.status === "success") {
      toast.success(res.message ?? "Saved");
      router.refresh();
      onDone();
    }
    return res;
  }, initialFormState);
  const [color, setColor] = useState<CategoryColor>(category?.color ?? "green");

  return (
    <form action={action} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription>Categories help your team find the right procedure quickly.</DialogDescription>
      </DialogHeader>
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <input type="hidden" name="color" value={color} />
      <FormMessage state={state} />
      <TextField name="name" label="Name" required maxLength={60} defaultValue={category?.name} state={state} autoFocus />
      <TextareaField name="description" label="Description" maxLength={300} rows={2} defaultValue={category?.description} state={state} />
      <fieldset className="grid gap-1.5">
        <Label asChild>
          <legend>Colour</legend>
        </Label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn("size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-card", SWATCH[c], color === c && "ring-2 ring-ring")}
            />
          ))}
        </div>
      </fieldset>
      <DialogFooter>
        <SubmitButton pendingText="Saving…">{category ? "Save changes" : "Create category"}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

function DeleteDialog({ category, others, onClose }: { category: Cat | null; others: Cat[]; onClose: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [pending, start] = useTransition();
  const needsMove = (category?.totalCount ?? 0) > 0;

  return (
    <Dialog open={category !== null} onOpenChange={(o) => !o && !pending && (onClose(), setTarget(""))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{category?.name}”?</DialogTitle>
          <DialogDescription>
            {needsMove
              ? `This category contains ${category?.totalCount} SOP${category?.totalCount === 1 ? "" : "s"} (including archived). Choose where to move them before deleting.`
              : "This category has no SOPs. Deleting it can't be undone — archive it instead if you might need it later."}
          </DialogDescription>
        </DialogHeader>
        {needsMove && (
          <div className="grid gap-1.5">
            <Label htmlFor="reassign">Move SOPs to</Label>
            <select
              id="reassign"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-10 cursor-pointer rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="">Choose a category…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || (needsMove && !target)}
            onClick={() =>
              start(async () => {
                const res = await deleteCategoryAction(category!.id, needsMove ? target : null);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Category deleted");
                onClose();
                setTarget("");
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} {needsMove ? "Move SOPs and delete" : "Delete category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
