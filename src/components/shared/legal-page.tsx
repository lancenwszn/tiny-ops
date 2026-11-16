import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/** Interim legal page shell. Final copy must be reviewed before launch (Stage 9). */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/" aria-label="TinyOps home">
        <Logo />
      </Link>
      <h1 className="mt-10 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 rounded-xl bg-tint-amber px-4 py-3 text-sm font-medium text-tint-amber-fg">
        Draft — this document is pending legal review and will be finalized before public launch.
      </p>
      <div className="mt-8 grid gap-4 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground">
        {children}
      </div>
    </main>
  );
}
