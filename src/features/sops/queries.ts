import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { Sections, SopStep } from "./content/model";
import type { SopSort, SopStatus } from "./schemas";

/**
 * SOP read model. Every query runs as the signed-in user, so RLS decides
 * visibility (drafts, restricted SOPs, archived SOPs, other workspaces).
 * Queries are additionally scoped to the server-validated active workspace.
 */

export type CategoryColor = "green" | "violet" | "coral" | "sky" | "amber" | "muted";

export type SopCategory = {
  id: string;
  name: string;
  description: string;
  color: CategoryColor;
  archivedAt: string | null;
};

export type PersonRef = { id: string; name: string; email: string; avatarPath: string | null };

export type SopListItem = {
  id: string;
  title: string;
  description: string;
  status: SopStatus;
  visibility: "workspace" | "restricted";
  category: { id: string; name: string; color: CategoryColor } | null;
  owner: PersonRef | null;
  currentVersion: number;
  requiresAcknowledgment: boolean;
  updatedAt: string;
  createdAt: string;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
};

export type SopFilters = { q?: string; categoryId?: string; status?: SopStatus | "all"; sort?: SopSort };

export type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  storagePath: string;
};

const DOC_COLUMNS =
  "id, workspace_id, title, description, status, visibility, requires_acknowledgment, current_version, updated_at, created_at, published_at, owner_id, category:sop_categories(id, name, color)";

type DocRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: SopStatus;
  visibility: "workspace" | "restricted";
  requires_acknowledgment: boolean;
  current_version: number;
  updated_at: string;
  created_at: string;
  published_at: string | null;
  owner_id: string | null;
  category: { id: string; name: string; color: string } | null;
};

async function loadPeople(ids: (string | null | undefined)[]): Promise<Map<string, PersonRef>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  const map = new Map<string, PersonRef>();
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email, avatar_path").in("id", unique);
  for (const p of data ?? []) {
    map.set(p.id, { id: p.id, name: p.full_name || p.email.split("@")[0], email: p.email, avatarPath: p.avatar_path });
  }
  return map;
}

function toListItem(row: DocRow, people: Map<string, PersonRef>, dirty: Set<string>): SopListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    category: row.category ? { id: row.category.id, name: row.category.name, color: row.category.color as CategoryColor } : null,
    owner: row.owner_id ? (people.get(row.owner_id) ?? null) : null,
    currentVersion: row.current_version,
    requiresAcknowledgment: row.requires_acknowledgment,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    hasUnpublishedChanges: dirty.has(row.id),
  };
}

async function unpublishedSet(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const supabase = await createClient();
  // Drafts are readable by managers only; members simply get an empty set.
  const { data } = await supabase.from("sop_drafts").select("sop_id, dirty").in("sop_id", ids).eq("dirty", true);
  return new Set((data ?? []).map((d) => d.sop_id));
}

export async function listSops(workspaceId: string, filters: SopFilters, limit = 500): Promise<SopListItem[]> {
  const supabase = await createClient();
  let ids: string[] | null = null;
  const q = filters.q?.trim();
  if (q && q.length >= 2) {
    const { data, error } = await supabase.rpc("search_sop_ids", { p_workspace_id: workspaceId, p_query: q });
    if (error) throw new Error("Could not search SOPs");
    ids = (data ?? []) as unknown as string[];
    if (ids.length === 0) return [];
  }

  let query = supabase.from("sop_documents").select(DOC_COLUMNS).eq("workspace_id", workspaceId).limit(Math.min(Math.max(limit, 1), 500));
  if (ids) query = query.in("id", ids);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  else query = query.neq("status", "archived");

  switch (filters.sort) {
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "created":
      query = query.order("created_at", { ascending: false });
      break;
    case "published":
      query = query.order("published_at", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error("Could not load SOPs");
  const rows = (data ?? []) as unknown as DocRow[];
  const [people, dirty] = await Promise.all([loadPeople(rows.map((r) => r.owner_id)), unpublishedSet(rows.map((r) => r.id))]);
  return rows.map((r) => toListItem(r, people, dirty));
}

export const listCategories = cache(async (workspaceId: string): Promise<(SopCategory & { sopCount: number })[]> => {
  const supabase = await createClient();
  const [{ data, error }, { data: docs }] = await Promise.all([
    supabase.from("sop_categories").select("id, name, description, color, archived_at, position").eq("workspace_id", workspaceId).order("position").order("name"),
    supabase.from("sop_documents").select("category_id").eq("workspace_id", workspaceId).neq("status", "archived").limit(5000),
  ]);
  if (error) throw new Error("Could not load categories");
  const counts = new Map<string, number>();
  for (const d of docs ?? []) if (d.category_id) counts.set(d.category_id, (counts.get(d.category_id) ?? 0) + 1);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    color: c.color as CategoryColor,
    archivedAt: c.archived_at,
    sopCount: counts.get(c.id) ?? 0,
  }));
});

/** Total SOPs (any status) per category — for safe deletion. Managers only see all. */
export async function categoryUsage(categoryId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("sop_documents").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
  return count ?? 0;
}

export async function signedUrls(paths: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const supabase = await createClient();
  // Storage RLS decides: only users who can read the SOP get URLs.
  const { data } = await supabase.storage.from("sop-attachments").createSignedUrls(paths, expiresIn);
  for (const item of data ?? []) if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  return map;
}

async function listAttachments(sopId: string): Promise<Attachment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sop_attachments")
    .select("id, file_name, mime_type, size_bytes, created_at, storage_path")
    .eq("sop_id", sopId)
    .order("created_at");
  return (data ?? []).map((a) => ({
    id: a.id,
    fileName: a.file_name,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    createdAt: a.created_at,
    storagePath: a.storage_path,
  }));
}

/** Map of attachment id -> signed URL for image attachments. */
async function imageUrlMap(attachments: Attachment[]): Promise<Record<string, string>> {
  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const urls = await signedUrls(images.map((a) => a.storagePath));
  return Object.fromEntries(images.flatMap((a) => (urls.get(a.storagePath) ? [[a.id, urls.get(a.storagePath)!]] : [])));
}

export type SopContent = {
  title: string;
  description: string;
  categoryName: string | null;
  sections: Sections;
  steps: SopStep[];
};

export type SopDetail = {
  doc: SopListItem & { workspaceId: string };
  /** Published content, or the working copy for never-published drafts (managers only). */
  content: SopContent | null;
  isPreview: boolean;
  version: { number: number; publishedAt: string; publishedBy: string | null; note: string } | null;
  attachments: Attachment[];
  imageUrls: Record<string, string>;
  myAcknowledgment: { version: number; at: string } | null;
};

export const getSopDetail = cache(async (sopId: string, workspaceId: string): Promise<SopDetail | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase.from("sop_documents").select(DOC_COLUMNS).eq("id", sopId).eq("workspace_id", workspaceId).maybeSingle();
  if (!row) return null;
  const docRow = row as unknown as DocRow;

  const [people, dirty, attachments, versionRes, ackRes] = await Promise.all([
    loadPeople([docRow.owner_id]),
    unpublishedSet([sopId]),
    listAttachments(sopId),
    docRow.current_version > 0
      ? supabase
          .from("sop_versions")
          .select("version, title, description, category_name, sections, steps, revision_note, published_at, published_by")
          .eq("sop_id", sopId)
          .eq("version", docRow.current_version)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("sop_acknowledgments")
      .select("version, acknowledged_at")
      .eq("sop_id", sopId)
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let content: SopContent | null = null;
  let isPreview = false;
  let version: SopDetail["version"] = null;
  const v = versionRes.data;
  if (v) {
    const publisher = v.published_by ? (await loadPeople([v.published_by])).get(v.published_by) : undefined;
    content = {
      title: v.title,
      description: v.description,
      categoryName: v.category_name,
      sections: (v.sections ?? {}) as Sections,
      steps: (v.steps ?? []) as SopStep[],
    };
    version = { number: v.version, publishedAt: v.published_at, publishedBy: publisher?.name ?? null, note: v.revision_note };
  } else {
    // Never published: managers can preview the working copy.
    const editor = await getSopEditorData(sopId, workspaceId);
    if (editor) {
      isPreview = true;
      content = {
        title: editor.draft.title,
        description: editor.draft.description,
        categoryName: docRow.category?.name ?? null,
        sections: editor.draft.sections,
        steps: editor.steps,
      };
    }
  }

  return {
    doc: { ...toListItem(docRow, people, dirty), workspaceId: docRow.workspace_id },
    content,
    isPreview,
    version,
    attachments,
    imageUrls: await imageUrlMap(attachments),
    myAcknowledgment: ackRes.data ? { version: ackRes.data.version, at: ackRes.data.acknowledged_at } : null,
  };
});

export type SopEditorData = {
  doc: SopListItem & { workspaceId: string };
  draft: { title: string; description: string; sections: Sections; revision: number; updatedAt: string; dirty: boolean };
  steps: SopStep[];
  attachments: Attachment[];
  imageUrls: Record<string, string>;
  access: { membersRole: boolean; userIds: string[] };
};

/** Working copy for the editor. Returns null for anyone who is not an owner/admin (RLS). */
export const getSopEditorData = cache(async (sopId: string, workspaceId: string): Promise<SopEditorData | null> => {
  const supabase = await createClient();
  const [{ data: row }, { data: draft }, { data: steps }, { data: perms }] = await Promise.all([
    supabase.from("sop_documents").select(DOC_COLUMNS).eq("id", sopId).eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("sop_drafts").select("title, description, sections, revision, updated_at, dirty").eq("sop_id", sopId).maybeSingle(),
    supabase.from("sop_steps").select("title, instructions, notes, attachment_id, position").eq("sop_id", sopId).order("position"),
    supabase.from("sop_permissions").select("role, user_id").eq("sop_id", sopId),
  ]);
  if (!row || !draft) return null;
  const docRow = row as unknown as DocRow;
  const [people, attachments] = await Promise.all([loadPeople([docRow.owner_id]), listAttachments(sopId)]);
  return {
    doc: { ...toListItem(docRow, people, new Set(draft.dirty ? [sopId] : [])), workspaceId: docRow.workspace_id },
    draft: {
      title: draft.title,
      description: draft.description,
      sections: (draft.sections ?? {}) as Sections,
      revision: draft.revision,
      updatedAt: draft.updated_at,
      dirty: draft.dirty,
    },
    steps: (steps ?? []).map((s) => ({ title: s.title, instructions: s.instructions, notes: s.notes, attachment_id: s.attachment_id })),
    attachments,
    imageUrls: await imageUrlMap(attachments),
    access: {
      membersRole: (perms ?? []).some((p) => p.role === "member"),
      userIds: (perms ?? []).flatMap((p) => (p.user_id ? [p.user_id] : [])),
    },
  };
});

export type VersionSummary = {
  version: number;
  title: string;
  note: string;
  publishedAt: string;
  publishedBy: string | null;
  restoredFrom: number | null;
};

export async function listVersions(sopId: string): Promise<VersionSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sop_versions")
    .select("version, title, revision_note, published_at, published_by, restored_from_version")
    .eq("sop_id", sopId)
    .order("version", { ascending: false });
  const people = await loadPeople((data ?? []).map((v) => v.published_by));
  return (data ?? []).map((v) => ({
    version: v.version,
    title: v.title,
    note: v.revision_note,
    publishedAt: v.published_at,
    publishedBy: v.published_by ? (people.get(v.published_by)?.name ?? null) : null,
    restoredFrom: v.restored_from_version,
  }));
}

export async function getVersionContent(sopId: string, version: number): Promise<SopContent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sop_versions")
    .select("title, description, category_name, sections, steps")
    .eq("sop_id", sopId)
    .eq("version", version)
    .maybeSingle();
  if (!data) return null;
  return {
    title: data.title,
    description: data.description,
    categoryName: data.category_name,
    sections: (data.sections ?? {}) as Sections,
    steps: (data.steps ?? []) as SopStep[],
  };
}

export type AckRow = {
  userId: string;
  name: string;
  email: string;
  avatarPath: string | null;
  role: string;
  acknowledgedVersion: number | null;
  acknowledgedAt: string | null;
  currentVersion: number;
};

export async function getAcknowledgments(sopId: string): Promise<AckRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sop_acknowledgments", { p_sop_id: sopId });
  if (error) return null;
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.full_name || r.email.split("@")[0],
    email: r.email,
    avatarPath: r.avatar_path,
    role: r.role,
    acknowledgedVersion: r.acknowledged_version,
    acknowledgedAt: r.acknowledged_at,
    currentVersion: r.current_version,
  }));
}

export async function listActiveMembers(workspaceId: string): Promise<(PersonRef & { role: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, profile:profiles!workspace_members_user_id_fkey!inner(id, full_name, email, avatar_path)")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  return (data ?? [])
    .map((m) => {
      const p = m.profile as { id: string; full_name: string; email: string; avatar_path: string | null };
      return { id: p.id, name: p.full_name || p.email.split("@")[0], email: p.email, avatarPath: p.avatar_path, role: m.role };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type SopStats = { total: number; published: number; drafts: number };

/** Counts of SOPs the viewer can see (drafts are only visible to managers). */
export const getSopStats = cache(async (workspaceId: string): Promise<SopStats> => {
  const supabase = await createClient();
  const { data } = await supabase.from("sop_documents").select("status").eq("workspace_id", workspaceId).neq("status", "archived").limit(10000);
  const rows = data ?? [];
  return {
    total: rows.length,
    published: rows.filter((r) => r.status === "published").length,
    drafts: rows.filter((r) => r.status === "draft").length,
  };
});

export async function recentSops(workspaceId: string, limit = 5): Promise<SopListItem[]> {
  return listSops(workspaceId, { sort: "updated" }, limit);
}
