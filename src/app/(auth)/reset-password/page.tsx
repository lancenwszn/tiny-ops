import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <AuthHeading title="Link expired" description="Your password reset link is invalid or has expired." />
        <Button asChild className="w-full" size="lg">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password" description={`For ${user.email}`} />
      <ResetPasswordForm />
    </>
  );
}
