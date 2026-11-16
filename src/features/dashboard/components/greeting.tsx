"use client";

import { useIsClient } from "@/hooks/use-is-client";
import { greetingForHour } from "@/lib/dates/timezones";

/**
 * Greeting and date computed in the viewer's local time (or their profile
 * timezone). Rendered after mount so server and client markup always match.
 */
export function Greeting({ firstName, timezone }: { firstName: string; timezone: string | null }) {
  const isClient = useIsClient();
  const now = isClient ? new Date() : null;

  const tz = timezone || undefined;
  const hour = now ? Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now)) : null;
  const date = now
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(now)
    : " ";

  return (
    <div>
      <p className="text-sm font-semibold text-muted-foreground" suppressHydrationWarning>
        {date}
      </p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px]">
        {hour === null ? "Welcome" : greetingForHour(hour)}
        {firstName ? `, ${firstName}` : ""}
      </h1>
    </div>
  );
}
