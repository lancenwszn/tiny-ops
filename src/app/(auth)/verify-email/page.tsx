import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { ResendVerificationForm } from "@/features/auth/components/resend-verification-form";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : "";

  return (
    <>
      <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <MailCheck className="size-7" />
      </div>
      <AuthHeading
        title="Check your inbox"
        description={
          <>
            We sent a verification link to {email ? <strong className="text-foreground">{email}</strong> : "your email"}.
            Click it to activate your account.
          </>
        }
      />
      <ResendVerificationForm email={email} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Verified already?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
