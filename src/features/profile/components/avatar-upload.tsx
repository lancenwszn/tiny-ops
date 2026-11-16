"use client";

import { ImageUpload } from "@/components/shared/image-upload";
import { updateAvatarAction } from "../actions";
import { initials } from "@/lib/utils";

export function AvatarUpload({ userId, name, avatarUrl }: { userId: string; name: string; avatarUrl: string | null }) {
  return (
    <ImageUpload
      folder={`users/${userId}`}
      imageUrl={avatarUrl}
      label="Photo"
      shape="circle"
      onSave={updateAvatarAction}
      fallback={<span className="text-lg font-bold text-muted-foreground">{initials(name)}</span>}
    />
  );
}
