"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useIsClient } from "@/hooks/use-is-client";

/** "5 minutes ago", rendered on the client so it never mismatches hydration. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const isClient = useIsClient();
  const date = new Date(iso);
  return (
    <time dateTime={iso} title={date.toLocaleString()} className={className} suppressHydrationWarning>
      {isClient ? formatDistanceToNowStrict(date, { addSuffix: true }) : " "}
    </time>
  );
}
