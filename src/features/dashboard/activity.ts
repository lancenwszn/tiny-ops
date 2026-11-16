export type ActivityEntry = {
  id: number;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
  actorAvatarPath: string | null;
};

export type ActivityTone = "green" | "sky" | "violet" | "amber" | "coral" | "muted";

const ROLE = (r: unknown) => (r === "admin" ? "an admin" : r === "owner" ? "the owner" : "a member");
const str = (v: unknown, fallback = "") => (typeof v === "string" && v ? v : fallback);

/** Turns an activity_log row into "<actor> <description>" for the team feed. */
export function describeActivity(entry: Pick<ActivityEntry, "action" | "metadata">): { text: string; tone: ActivityTone } {
  const m = entry.metadata ?? {};
  switch (entry.action) {
    case "workspace.created":
      return { text: `created the workspace ${str(m.name)}`.trim(), tone: "green" };
    case "workspace.updated": {
      const changes = (m.changes ?? {}) as Record<string, unknown>;
      const parts: string[] = [];
      const name = changes.name as { to?: string } | undefined;
      const tz = changes.timezone as { to?: string } | undefined;
      if (name?.to) parts.push(`renamed the workspace to ${name.to}`);
      if (tz?.to) parts.push(`set the timezone to ${tz.to.replaceAll("_", " ")}`);
      if (changes.logo === true) parts.push("updated the business logo");
      if (changes.logo === false) parts.push("removed the business logo");
      if (changes.description) parts.push("updated the business description");
      return { text: parts.length ? joinParts(parts) : "updated workspace settings", tone: "sky" };
    }
    case "member.invited":
      return { text: m.role === "admin" ? "invited a new admin" : "invited a new member", tone: "violet" };
    case "member.joined":
      return { text: `joined the workspace as ${ROLE(m.role)}`, tone: "green" };
    case "member.role_changed":
      return { text: `made ${str(m.name, "a teammate")} ${ROLE(m.to)}`, tone: "sky" };
    case "member.deactivated":
      return { text: `deactivated ${str(m.name, "a teammate")}`, tone: "coral" };
    case "member.reactivated":
      return { text: `reactivated ${str(m.name, "a teammate")}`, tone: "green" };
    case "member.left":
      return { text: "left the workspace", tone: "amber" };
    case "member.removed":
      return { text: `removed ${str(m.name, "a teammate")} from the workspace`, tone: "coral" };
    case "sop.created":
      return { text: `started a new SOP “${str(m.title)}”`, tone: "violet" };
    case "sop.published":
      return { text: `published “${str(m.title)}” (v${Number(m.version) || 1})`, tone: "green" };
    case "sop.version_restored":
      return { text: `restored “${str(m.title)}” to version ${Number(m.restored_from) || "?"}`, tone: "sky" };
    case "sop.archived":
      return { text: `archived “${str(m.title)}”`, tone: "muted" };
    case "sop.unarchived":
      return { text: `restored “${str(m.title)}” from the archive`, tone: "green" };
    case "sop.duplicated":
      return { text: `duplicated “${str(m.from)}”`, tone: "violet" };
    case "sop.access_changed":
      return { text: `made “${str(m.title)}” ${m.visibility === "restricted" ? "restricted" : "visible to everyone"}`, tone: "sky" };
    case "sop_category.created":
      return { text: `added the SOP category ${str(m.name)}`, tone: "violet" };
    case "sop_category.renamed":
      return { text: `renamed the SOP category ${str(m.from)} to ${str(m.name)}`, tone: "sky" };
    case "sop_category.archived":
      return { text: `archived the SOP category ${str(m.name)}`, tone: "muted" };
    case "sop_category.deleted":
      return { text: `deleted the SOP category ${str(m.name)}`, tone: "coral" };
    case "invitation.revoked":
      return { text: "revoked a pending invitation", tone: "amber" };
    default:
      return { text: "made an update", tone: "muted" };
  }
}

function joinParts(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
