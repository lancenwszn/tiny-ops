/**
 * App URL for an SOP attachment. Every request to it re-checks the viewer's
 * access (RLS) before redirecting to a 30-second signed storage URL, so
 * pages never embed long-lived bearer links and revoking access is immediate.
 */
export function attachmentUrl(id: string, download = false) {
  return `/api/sops/attachments/${id}${download ? "?download=1" : ""}`;
}

/** Types safe to display inline; everything else is always downloaded. */
export const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);

/** How long the storage URL behind a redirect stays valid. */
export const SIGNED_URL_TTL_SECONDS = 30;
