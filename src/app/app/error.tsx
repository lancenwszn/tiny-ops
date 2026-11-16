"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-tint-coral text-tint-coral-fg">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="mt-5 text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">We couldn&apos;t load this page. Please try again.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
