import { compareContent } from "../content/compare";
import type { SopContent } from "../content/model";
import { cn } from "@/lib/utils";

export function VersionCompare({ from, to, a, b }: { from: number; to: number; a: SopContent; b: SopContent }) {
  const changes = compareContent(a, b);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card" aria-label={`Changes from version ${from} to ${to}`}>
      <h2 className="text-lg font-bold">
        Changes from v{from} to v{to}
      </h2>
      <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded bg-tint-green px-1.5 font-semibold text-tint-green-fg">added</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded bg-tint-coral px-1.5 font-semibold text-tint-coral-fg line-through">removed</span>
        </span>
      </p>
      {changes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No text changes between these versions.</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {changes.map((c) => (
            <div key={c.label} data-testid="diff-field">
              <h3 className="text-sm font-bold">{c.label}</h3>
              <p className="mt-1 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm leading-6">
                {c.parts.map((p, i) => (
                  <span
                    key={i}
                    className={cn(
                      p.type === "add" && "rounded bg-tint-green text-tint-green-fg",
                      p.type === "del" && "rounded bg-tint-coral text-tint-coral-fg line-through",
                    )}
                  >
                    {p.text}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
