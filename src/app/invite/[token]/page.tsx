import type { Metadata } from "next";
import Link from "next/link";
import { MailWarning, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AcceptInvitationForm } from "@/features/workspaces/components/accept-invitation-form";

export const metadata: Metadata = { title: "Join workspace", robots: { index: false } };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const valid = /^[a-f0-9]{64}$/.test(token);
  const supabase = await createClient();
  const [user, preview] = await Promise.all([
    getCurrentUser(),
    valid ? supabase.rpc("get_invitation_preview", { p_token: token }).then((r) => r.data?.[0] ?? null) : null,
  ]);

  const invitePath = `/invite/${token}`;
  let body: React.ReactNode;

  if (!preview || preview.status !== "pending") {
    const reason =
      preview?.status === "accepted"
        ? "This invitation has already been accepted."
        : preview?.status === "expired"
          ? "This invitation has expired. Ask your team to send a new one."
          : "This invitation is no longer valid.";
    body = (
      <>
        <Icon warning />
        <h1 className="text-2xl font-extrabold tracking-tight">Invitation unavailable</h1>
        <p className="mt-2 text-muted-foreground">{reason}</p>
        <Button asChild className="mt-6 w-full">
          <Link href={user ? "/app/dashboard" : "/login"}>{user ? "Go to dashboard" : "Sign in"}</Link>
        </Button>
      </>
    );
  } else {
    const wrongAccount = user && user.email.toLowerCase() !== preview.email.toLowerCase();
    body = (
      <>
        <Icon />
        <h1 className="text-2xl font-extrabold tracking-tight">Join {preview.workspace_name}</h1>
        <p className="mt-2 text-muted-foreground">
          {preview.inviter_name} invited <strong className="text-foreground">{preview.email}</strong> to join as{" "}
          {preview.role === "admin" ? "an admin" : "a member"}.
        </p>
        <div className="mt-6">
          {!user ? (
            <div className="grid gap-2">
              <Button asChild size="lg">
                <Link href={`/signup?next=${encodeURIComponent(invitePath)}&email=${encodeURIComponent(preview.email)}`}>
                  Create account &amp; join
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/login?next=${encodeURIComponent(invitePath)}`}>I already have an account</Link>
              </Button>
            </div>
          ) : wrongAccount ? (
            <p className="rounded-xl bg-tint-amber p-4 text-sm text-tint-amber-fg">
              You&apos;re signed in as <strong>{user.email}</strong>. Sign out and sign in as {preview.email} to accept this
              invitation.
            </p>
          ) : (
            <AcceptInvitationForm token={token} />
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-[radial-gradient(ellipse_at_top,#e8f5ee_0%,transparent_60%)] px-4 py-8">
      <Logo />
      <Card className="mt-10 w-full max-w-md">
        <CardContent className="p-7 text-center">{body}</CardContent>
      </Card>
    </div>
  );
}

function Icon({ warning }: { warning?: boolean }) {
  const I = warning ? MailWarning : UsersRound;
  return (
    <div
      className={`mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl ${warning ? "bg-tint-amber text-tint-amber-fg" : "bg-secondary text-primary"}`}
    >
      <I className="size-7" />
    </div>
  );
}
