"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, CircleHelp, Info, LifeBuoy, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { publicEnv } from "@/lib/env";
import { modules } from "@/lib/modules";

const APP_VERSION = "0.2.0";

/**
 * Help menu. External destinations (docs site, support inbox) come from
 * NEXT_PUBLIC_HELP_URL / NEXT_PUBLIC_SUPPORT_EMAIL; until those are configured
 * the items are shown as unavailable rather than linking nowhere.
 */
export function HelpMenu() {
  const [dialog, setDialog] = useState<"start" | "about" | null>(null);
  const helpUrl = publicEnv.NEXT_PUBLIC_HELP_URL;
  const supportEmail = publicEnv.NEXT_PUBLIC_SUPPORT_EMAIL;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Help">
            <CircleHelp className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Help</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDialog("start")}>
            <Rocket /> Getting started
          </DropdownMenuItem>
          {helpUrl ? (
            <DropdownMenuItem asChild>
              <a href={helpUrl} target="_blank" rel="noreferrer">
                <BookOpen /> Help documentation
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <BookOpen /> Help documentation
              <span className="ml-auto text-[11px] font-semibold uppercase text-muted-foreground">Soon</span>
            </DropdownMenuItem>
          )}
          {supportEmail ? (
            <DropdownMenuItem asChild>
              <a href={`mailto:${supportEmail}`}>
                <LifeBuoy /> Contact support
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <LifeBuoy /> Contact support
              <span className="ml-auto text-[11px] font-semibold uppercase text-muted-foreground">Soon</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("about")}>
            <Info /> About TinyOps
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "start"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Getting started with TinyOps</DialogTitle>
            <DialogDescription>A few minutes of setup gets your team organized.</DialogDescription>
          </DialogHeader>
          <ol className="grid gap-3">
            <Step n={1} title="Set up your business">
              Add your logo and operating timezone in{" "}
              <Link href="/app/settings" className="font-semibold text-primary hover:underline" onClick={() => setDialog(null)}>
                Settings
              </Link>
              . Checklists and due dates follow that timezone.
            </Step>
            <Step n={2} title="Complete your profile">
              Add your name and photo so teammates recognise you on{" "}
              <Link href="/app/settings/profile" className="font-semibold text-primary hover:underline" onClick={() => setDialog(null)}>
                your profile
              </Link>
              .
            </Step>
            <Step n={3} title="Invite your team">
              Owners and admins can invite teammates from the dashboard&apos;s Quick Actions.
            </Step>
            <Step n={4} title="Document how work gets done" soon={!modules.sops.available}>
              Write SOPs, then turn routines into recurring checklists and tasks.
            </Step>
          </ol>
          <p className="text-xs text-muted-foreground">Tip: press ⌘K (Ctrl+K on Windows) to search from anywhere.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "about"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center pr-0 text-center">
            <LogoMark className="size-14" title="" />
            <DialogTitle className="sr-only">About TinyOps</DialogTitle>
            <Wordmark className="mt-2 text-3xl" />
            <DialogDescription className="font-semibold uppercase tracking-[0.14em] text-primary">Your business, organized.</DialogDescription>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">
            The operations hub for small businesses: SOPs, recurring checklists, tasks and team handovers in one place.
          </p>
          <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-3 text-sm">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="text-right font-medium">{APP_VERSION}</dd>
            <dt className="text-muted-foreground">Made by</dt>
            <dd className="text-right font-medium">SZN Labs</dd>
          </dl>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({ n, title, soon, children }: { n: number; title: string; soon?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">{n}</span>
      <div>
        <p className="font-semibold">
          {title}
          {soon && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase text-muted-foreground">Soon</span>}
        </p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
