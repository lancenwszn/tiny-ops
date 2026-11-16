import { cn } from "@/lib/utils";

/** Circular progress. `value` null renders an empty (not-yet-measured) ring. */
export function ProgressRing({
  value,
  size = 132,
  stroke = 12,
  label,
  className,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label: string;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={value === null ? `${label}: not measured yet` : `${label}: ${pct}%`}
      >
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1fae6b" />
            <stop offset="1" stopColor="#2c77d6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#ring-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-extrabold tracking-tight", value === null && "text-muted-foreground/60")}>
          {value === null ? "—" : `${pct}%`}
        </span>
      </div>
    </div>
  );
}
