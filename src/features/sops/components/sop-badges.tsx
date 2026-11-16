import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CategoryColor } from "../queries";
import type { SopStatus } from "../schemas";

const STATUS: Record<SopStatus, { label: string; variant: "amber" | "green" | "muted" }> = {
  draft: { label: "Draft", variant: "amber" },
  published: { label: "Published", variant: "green" },
  archived: { label: "Archived", variant: "muted" },
};

export function SopStatusBadge({ status }: { status: SopStatus }) {
  return <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>;
}

export function UnpublishedBadge() {
  return (
    <Badge variant="outline" className="border-dashed text-tint-amber-fg">
      Unpublished changes
    </Badge>
  );
}

export function RestrictedBadge() {
  return (
    <Badge variant="sky" title="Only selected people can see this SOP">
      <Lock /> Restricted
    </Badge>
  );
}

const CATEGORY_VARIANT: Record<CategoryColor, "green" | "violet" | "coral" | "sky" | "amber" | "muted"> = {
  green: "green",
  violet: "violet",
  coral: "coral",
  sky: "sky",
  amber: "amber",
  muted: "muted",
};

export function CategoryBadge({ name, color }: { name: string; color: CategoryColor }) {
  return <Badge variant={CATEGORY_VARIANT[color] ?? "muted"}>{name}</Badge>;
}
