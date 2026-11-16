import { History, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RelativeTime } from "@/components/shared/relative-time";
import { Widget, EmptyState } from "./widget";
import { describeActivity, type ActivityEntry } from "../activity";
import type { TeamSnapshot } from "../queries";
import { brandingUrl } from "@/lib/env";
import { initials } from "@/lib/utils";

export function TeamActivity({ team, activity }: { team: TeamSnapshot; activity: ActivityEntry[] }) {
  const extra = team.activeCount - team.members.length;
  return (
    <Widget title="Team Activity" icon={UsersRound} tint="green" id="team-activity">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2.5">
          {team.members.map((m) => (
            <Avatar key={m.id} className="size-10 ring-[3px] ring-card" title={m.name}>
              {m.avatarPath && <AvatarImage src={brandingUrl(m.avatarPath)!} alt="" />}
              <AvatarFallback>{initials(m.name)}</AvatarFallback>
            </Avatar>
          ))}
          {extra > 0 && (
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground ring-[3px] ring-card">+{extra}</span>
          )}
        </div>
      </div>
      <p className="mt-2 text-[13px] font-medium text-muted-foreground">
        {team.activeCount} active {team.activeCount === 1 ? "member" : "members"}
        {team.pendingInvites > 0 && ` · ${team.pendingInvites} pending ${team.pendingInvites === 1 ? "invite" : "invites"}`}
      </p>

      {activity.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Changes to your workspace and team will appear here." className="mt-4" />
      ) : (
        <ol className="mt-4 grid gap-3.5" aria-label="Recent activity">
          {activity.map((a) => {
            const { text } = describeActivity(a);
            const name = a.actorName ?? "Someone";
            return (
              <li key={a.id} className="flex items-start gap-3" data-testid="activity-item">
                <Avatar className="size-9">
                  {a.actorAvatarPath && <AvatarImage src={brandingUrl(a.actorAvatarPath)!} alt="" />}
                  <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-[13px] leading-snug">
                  <p>
                    <span className="font-semibold">{name}</span> <span className="text-muted-foreground">{text}</span>
                  </p>
                  <RelativeTime iso={a.createdAt} className="text-xs text-muted-foreground" />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Widget>
  );
}
