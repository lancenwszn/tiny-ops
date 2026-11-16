import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNext } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNext(params.next) : undefined;
  const linkExpired = params.error === "link-expired";

  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to your TinyOps workspace." />
      {linkExpired && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle />
          <AlertDescription>That link is invalid or has expired. Please request a new one.</AlertDescription>
        </Alert>
      )}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to TinyOps?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
