import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * TinyOps mark — three connected blocks with a completion check.
 * Vector redraw of the supplied brand logo (public/brand/tinyops-logo-full.webp)
 * so it stays crisp at every size and themes correctly.
 */
export function LogoMark({ className, title = "TinyOps" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 100 100"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3cb46a" />
          <stop offset="1" stopColor="#137e45" />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#97eeac" />
          <stop offset="1" stopColor="#3ad468" />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10a866" />
          <stop offset="1" stopColor="#0b6c42" />
        </linearGradient>
      </defs>
      <rect x="21" y="1" width="74" height="65" rx="16" fill={`url(#${id}-back)`} />
      <rect x="1" y="25" width="59" height="60" rx="15" fill={`url(#${id}-mid)`} />
      <rect x="24" y="41" width="63" height="58" rx="15" fill={`url(#${id}-front)`} />
      <path
        d="M41 71.5 50.5 81 69.5 62"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("font-extrabold tracking-[-0.04em] leading-none", className)}>
      <span className="text-[#0f1f17] dark:text-white">tiny</span>
      <span className="text-primary">ops.</span>
    </span>
  );
}

export function Logo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} title={showWordmark ? "" : "TinyOps"} />
      {showWordmark && <Wordmark className={cn("text-[1.45rem]", wordmarkClassName)} />}
      {showWordmark && <span className="sr-only">TinyOps</span>}
    </span>
  );
}
