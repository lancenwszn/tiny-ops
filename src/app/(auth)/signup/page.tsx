import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { SignupForm } from "@/features/auth/components/signup-form";
import { safeNext } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNext(params.next, "/onboarding") : undefined;
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : undefined;

  return (
    <>
      <AuthHeading title="Create your account" description="Get your business organized in minutes. 14-day free trial, no card required." />
      <SignupForm next={next} email={email} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
