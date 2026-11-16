import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";

const points = [
  "SOPs your team can actually follow",
  "Recurring checklists that run on schedule",
  "Tasks and handovers in one place",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" className="w-fit" aria-label="TinyOps home">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</main>
        <p className="text-center text-xs text-muted-foreground lg:text-left">
          © {new Date().getFullYear()} SZN Labs ·{" "}
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(150deg,#0f5a39_0%,#168a56_55%,#1fa868_100%)] lg:block">
        <div aria-hidden className="absolute -right-24 -top-24 size-[28rem] rounded-[5rem] bg-white/[0.06] rotate-12" />
        <div aria-hidden className="absolute -bottom-32 -left-20 size-[26rem] rounded-[5rem] bg-white/[0.05] -rotate-6" />
        <div className="relative flex h-full flex-col justify-center px-14 py-16 text-white xl:px-20">
          <div className="mb-10 w-fit rounded-3xl bg-white/95 p-4 shadow-elevated">
            <LogoMark className="size-14" title="" />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/70">Your business, organized.</p>
          <h2 className="mt-3 max-w-md text-balance text-4xl font-extrabold leading-tight tracking-tight">
            Everything your team needs to run the day.
          </h2>
          <ul className="mt-8 grid gap-3.5">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[15px] text-white/90">
                <CheckCircle2 className="size-5 text-[#9ff0c3]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
