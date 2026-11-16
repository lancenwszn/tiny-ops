import { Bot, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

const IDEAS = ["Summarize today's operations", "Find overdue tasks", "Summarize team activity", "Suggest improvements"];

/**
 * TinyOps AI — clearly labelled placeholder. No model is called and no
 * responses are shown until an AI provider is configured (Stage 7).
 */
export function AiAssistant() {
  return (
    <section
      aria-labelledby="ai-title"
      className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-[linear-gradient(150deg,#0e3b28_0%,#11573a_55%,#168a56_100%)] p-5 text-white shadow-card"
    >
      <div aria-hidden className="absolute -right-10 -top-10 size-40 rotate-12 rounded-[2.5rem] bg-white/[0.06]" />
      <div className="relative flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/95">
          <LogoMark className="size-6" title="" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-title" className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
            TinyOps AI
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Coming soon</span>
          </h2>
          <p className="text-[13px] text-white/70">Your operations assistant</p>
        </div>
      </div>
      <p className="relative mt-4 text-[13px] leading-relaxed text-white/80">
        Once enabled, TinyOps AI will answer questions using your workspace&apos;s own SOPs, tasks and checklists.
      </p>
      <ul className="relative mt-3 flex flex-wrap gap-1.5">
        {IDEAS.map((i) => (
          <li key={i} className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-xs text-white/80">
            {i}
          </li>
        ))}
      </ul>
      <div className="relative mt-auto pt-4">
        <div className="flex h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-sm text-muted-foreground" aria-disabled="true">
          <Sparkles className="size-4 text-primary/60" aria-hidden />
          <span className="flex-1 truncate">Not available yet</span>
          <Bot className="size-4 opacity-50" aria-hidden />
        </div>
      </div>
    </section>
  );
}
