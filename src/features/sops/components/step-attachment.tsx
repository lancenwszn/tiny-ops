"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentIcon, openAttachment } from "./attachments";

export function StepAttachment({
  attachment,
  imageUrl,
}: {
  attachment: { id: string; fileName: string; mimeType: string };
  imageUrl?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, signed URL
      <img src={imageUrl} alt={attachment.fileName} loading="lazy" className="mt-3 max-h-80 rounded-xl border border-border" />
    );
  }
  return (
    <Button variant="outline" size="sm" className="mt-3" onClick={() => openAttachment(attachment.id, true)}>
      <AttachmentIcon mimeType={attachment.mimeType} className="size-4" /> {attachment.fileName} <Download className="opacity-60" />
    </Button>
  );
}
