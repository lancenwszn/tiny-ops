"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace/active";
import { brandingUrl } from "@/lib/env";
import { normalizeQuery, searchSources, type SearchKind } from "./sources";

export type SearchResult = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  url: string | null;
  imageUrl: string | null;
};

export type SearchResponse = { ok: true; query: string; results: SearchResult[] } | { ok: false; error: string };

/**
 * Workspace-aware search. The workspace comes from the server-validated active
 * membership (never from the client) and the SQL function runs under the
 * caller's RLS policies, so only authorized records can be returned.
 */
export async function searchWorkspaceAction(rawQuery: string): Promise<SearchResponse> {
  const query = normalizeQuery(rawQuery);
  if (!query) return { ok: true, query: "", results: [] };

  const { workspace } = await getActiveMembership();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_workspace", {
    p_workspace_id: workspace.id,
    p_query: query,
    p_limit: 8,
  });
  if (error) return { ok: false, error: "Search is unavailable right now. Please try again." };

  const searchable = new Set(searchSources.filter((s) => s.searchable).map((s) => s.kind));
  const results = (data ?? [])
    .filter((r) => searchable.has(r.kind as SearchKind))
    .map((r) => ({
      kind: r.kind as SearchKind,
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      url: r.url,
      imageUrl: brandingUrl(r.image_path),
    }));

  return { ok: true, query, results };
}
