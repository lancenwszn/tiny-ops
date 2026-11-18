"use client";

import { useState, useTransition } from "react";
import { Globe, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setSopAccessAction } from "../actions";
import type { PersonRef } from "../queries";
import { cn } from "@/lib/utils";

export function AccessCard({
  sopId,
  initial,
  members,
}: {
  sopId: string;
  initial: { visibility: "workspace" | "restricted"; membersRole: boolean; userIds: string[] };
  members: (PersonRef & { role: string })[];
}) {
  const [visibility, setVisibility] = useState(initial.visibility);
  const [membersRole, setMembersRole] = useState(initial.membersRole);
  const [userIds, setUserIds] = useState<string[]>(initial.userIds);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const plainMembers = members.filter((m) => m.role === "member");
  const changed =
    visibility !== saved.visibility || membersRole !== saved.membersRole || [...userIds].sort().join() !== [...saved.userIds].sort().join();

  function save() {
    start(async () => {
      const res = await setSopAccessAction({ sopId, visibility, membersRole, userIds: visibility === "restricted" ? userIds : [] });
      if (!res.ok) return void toast.error(res.error);
      setSaved({ visibility, membersRole, userIds });
      toast.success("Access updated");
    });
  }

  const option = (value: "workspace" | "restricted", icon: React.ReactNode, title: string, text: string) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
        visibility === value ? "border-primary bg-secondary/60" : "border-border hover:bg-muted",
      )}
    >
      <input type="radio" name={`visibility-${sopId}`} className="mt-1 accent-[var(--primary)]" checked={visibility === value} onChange={() => setVisibility(value)} />
      <span className="flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon} {title}
        </span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </label>
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card" aria-label="Who can see this SOP">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <ShieldCheck className="size-4 text-primary" /> Who can see this SOP
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Owners and admins can always see every SOP. Changes apply immediately.</p>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Visibility">
        {option("workspace", <Globe className="size-3.5" />, "Everyone in the workspace", "All members can read it once published.")}
        {option("restricted", <Lock className="size-3.5" />, "Restricted", "Only the people you choose (and the SOP owner).")}
      </div>
      {visibility === "restricted" && (
        <div className="mt-3 grid gap-1 rounded-xl bg-muted/60 p-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={membersRole} onChange={(e) => setMembersRole(e.target.checked)} />
            All members
          </label>
          {plainMembers.length > 0 && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Or specific people</p>}
          {plainMembers.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={membersRole || userIds.includes(m.id)}
                disabled={membersRole}
                onChange={(e) => setUserIds((ids) => (e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id)))}
              />
              <span className="truncate">{m.name}</span>
            </label>
          ))}
        </div>
      )}
      <Button type="button" size="sm" className="mt-3 w-full" variant={changed ? "default" : "outline"} disabled={!changed || pending} onClick={save}>
        {pending && <Loader2 className="animate-spin" />} {changed ? "Save access" : "Access saved"}
      </Button>
    </section>
  );
}
