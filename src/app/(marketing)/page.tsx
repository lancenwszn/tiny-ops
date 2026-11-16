import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

// Interim landing page. The full marketing website is built in Stage 9.
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label="TinyOps home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <p className="mb-5 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-secondary-foreground">
          Your business, organized.
        </p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
          Run your business without the operational chaos.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          Keep your SOPs, tasks, checklists, and team workflows organized in one simple workspace. Less chasing. More
          getting things done.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Get started <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
