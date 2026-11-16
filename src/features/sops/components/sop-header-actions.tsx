"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, History, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archiveSopAction, duplicateSopAction, unarchiveSopAction } from "../actions";
import type { SopStatus } from "../schemas";

export function SopHeaderActions({ sopId, title, status }: { sopId: string; title: string; status: SopStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "archived" && (
        <Button asChild>
          <Link href={`/app/sops/${sopId}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      <Button variant="outline" asChild>
        <Link href={`/app/sops/${sopId}/history`}>
          <History /> History
        </Link>
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await duplicateSopAction(sopId);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Duplicated as a new draft");
            router.push(`/app/sops/${res.id}/edit`);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Copy />} Duplicate
      </Button>
      {status === "archived" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await unarchiveSopAction(sopId);
              if (!res.ok) return void toast.error(res.error);
              toast.success("SOP restored from the archive");
              router.refresh();
            })
          }
        >
          <ArchiveRestore /> Restore
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (!window.confirm(`Archive “${title}”? Members will no longer see it. You can restore it later.`)) return;
              const res = await archiveSopAction(sopId);
              if (!res.ok) return void toast.error(res.error);
              toast.success("SOP archived");
              router.refresh();
            })
          }
        >
          <Archive /> Archive
        </Button>
      )}
    </div>
  );
}
