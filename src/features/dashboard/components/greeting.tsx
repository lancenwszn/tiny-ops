"use client";

import { greetingForHour } from "@/lib/dates/timezones";
import { useNow } from "@/hooks/use-now";

function hourIn(tz: string | undefined, at: number) {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(at));
}

/** "Good afternoon," based on the viewer's local time (or profile timezone). */
export function Greeting({ firstName, timezone }: { firstName: string; timezone: string | null }) {
  const now = useNow();
  const greeting = now === null ? "Welcome" : greetingForHour(hourIn(timezone || undefined, now));
  return (
    <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-[34px]">
      <span className="block text-[20px] font-bold text-foreground/80 sm:text-[22px]" suppressHydrationWarning>
        {greeting},
      </span>
      {firstName || "there"}
    </h1>
  );
}

/** Date + live clock for the workspace's operating timezone. */
export function WorkspaceClock({ timezone }: { timezone: string }) {
  const now = useNow();
  const date = now === null ? null : new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: timezone }).format(now);
  const time = now === null ? null : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(now);
  return (
    <div className="grid gap-0.5" suppressHydrationWarning>
      <p className="text-[17px] font-bold leading-tight" data-testid="workspace-date">
        {date ?? " "}
      </p>
      <p className="text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground/80">{time ?? " "}</span> · {timezone.replaceAll("_", " ")}
      </p>
    </div>
  );
}
