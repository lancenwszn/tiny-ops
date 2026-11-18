"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Eye, History, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveSopAction, duplicateSopAction, unarchiveSopAction } from "../actions";
import type { SopStatus } from "../schemas";

/** Quick actions for one SOP (owners/admins). */
export function SopRowActions({ sopId, title, status, canManage }: { sopId: string; title: string; status: SopStatus; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) => start(fn);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${title}`} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/app/sops/${sopId}`}>
            <Eye /> Open
          </Link>
        </DropdownMenuItem>
        {canManage && (
          <>
            {status !== "archived" && (
              <DropdownMenuItem asChild>
                <Link href={`/app/sops/${sopId}/edit`}>
                  <Pencil /> Edit
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/app/sops/${sopId}/history`}>
                <History /> Version history
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                run(async () => {
                  const res = await duplicateSopAction(sopId);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Duplicated as a new draft");
                  router.push(`/app/sops/${res.id}/edit`);
                })
              }
            >
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {status === "archived" ? (
              <DropdownMenuItem
                onSelect={() =>
                  run(async () => {
                    const res = await unarchiveSopAction(sopId);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("SOP restored");
                    router.refresh();
                  })
                }
              >
                <ArchiveRestore /> Restore from archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  run(async () => {
                    if (!window.confirm(`Archive “${title}”? Members will no longer see it. You can restore it later.`)) return;
                    const res = await archiveSopAction(sopId);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("SOP archived");
                    router.refresh();
                  })
                }
              >
                <Archive /> Archive
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
