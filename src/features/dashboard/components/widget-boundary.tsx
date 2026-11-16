"use client";

import { catchError, type ErrorInfo } from "next/error";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Per-widget error boundary: one failing widget never takes down the dashboard. */
function WidgetError({ title }: { title: string; children?: React.ReactNode }, { retry }: ErrorInfo) {
  return (
    <Card className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-5 text-center" role="alert">
      <AlertTriangle className="size-5 text-tint-coral-fg" aria-hidden />
      <p className="text-sm font-semibold">{title} couldn&apos;t load</p>
      <Button variant="outline" size="sm" onClick={() => retry()}>
        Try again
      </Button>
    </Card>
  );
}

export const WidgetBoundary = catchError(WidgetError);
