"use client";

import { ImageUpload } from "@/components/shared/image-upload";
import { updateWorkspaceLogoAction } from "../actions";
import { initials } from "@/lib/utils";

export function WorkspaceLogoUpload({
  workspaceId,
  name,
  logoUrl,
  disabled,
}: {
  workspaceId: string;
  name: string;
  logoUrl: string | null;
  disabled?: boolean;
}) {
  return (
    <ImageUpload
      folder={`workspaces/${workspaceId}`}
      imageUrl={logoUrl}
      label="Logo"
      disabled={disabled}
      onSave={updateWorkspaceLogoAction}
      fallback={<span className="text-lg font-bold text-muted-foreground">{initials(name, "W")}</span>}
    />
  );
}
