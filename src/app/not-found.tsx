import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <LogoMark className="size-14" />
      <p className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-primary">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">This page isn&apos;t organized yet</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Button asChild className="mt-6">
        <Link href="/">Back to TinyOps</Link>
      </Button>
    </main>
  );
}
