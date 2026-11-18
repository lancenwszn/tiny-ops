import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INLINE_TYPES, SIGNED_URL_TTL_SECONDS } from "@/features/sops/attachment-url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () =>
  new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

/**
 * Authenticated gateway for SOP files.
 * 1. Runs as the signed-in user: the attachment row is only visible if RLS
 *    allows it (managers, or readers of the current published version).
 * 2. The signed URL is created under the same session, so Storage RLS checks
 *    access a second time.
 * 3. The redirect target lives for 30 seconds and the redirect itself is
 *    never cached, so revoked access stops working on the next request.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/sops/attachments/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return notFound();

  const { data: attachment } = await supabase
    .from("sop_attachments")
    .select("storage_path, file_name, mime_type")
    .eq("id", id)
    .maybeSingle();
  if (!attachment) return notFound();

  const download = request.nextUrl.searchParams.get("download") === "1" || !INLINE_TYPES.has(attachment.mime_type);
  const { data, error } = await supabase.storage
    .from("sop-attachments")
    .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS, download ? { download: attachment.file_name } : undefined);
  if (error || !data?.signedUrl) return notFound();

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
