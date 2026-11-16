"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { switchWorkspaceAction } from "../actions";

export function SwitchWorkspaceButton({ workspaceId }: { workspaceId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await switchWorkspaceAction(workspaceId);
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      {pending && <Loader2 className="animate-spin" />}
      Open
    </Button>
  );
}
