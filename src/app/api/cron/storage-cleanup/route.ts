import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes SOP files that have no attachment record (failed registrations,
 * direct uploads, removed attachments whose object deletion failed, deleted
 * workspaces). Protected by CRON_SECRET; Vercel Cron sends it as a Bearer
 * token. Uses the service role — trusted server route only.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let deleted = 0;
  // A few bounded batches per run; the job runs regularly.
  for (let batch = 0; batch < 5; batch++) {
    const { data, error } = await admin.rpc("sop_orphan_objects", { p_older_than: "1 hour", p_limit: 500 });
    if (error) return NextResponse.json({ error: "Could not list orphaned files", deleted }, { status: 500 });
    const names = (data ?? []).map((r) => r.name);
    if (names.length === 0) break;
    for (let i = 0; i < names.length; i += 100) {
      const { error: removeError } = await admin.storage.from("sop-attachments").remove(names.slice(i, i + 100));
      if (removeError) return NextResponse.json({ error: "Could not delete orphaned files", deleted }, { status: 500 });
      deleted += Math.min(100, names.length - i);
    }
    if (names.length < 500) break;
  }
  return NextResponse.json({ deleted }, { headers: { "Cache-Control": "no-store" } });
}
