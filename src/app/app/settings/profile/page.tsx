import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { AvatarUpload } from "@/features/profile/components/avatar-upload";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getProfile } from "@/lib/auth/session";
import { brandingUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await getProfile();
  return (
    <>
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>Helps teammates recognise you on tasks and handovers.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload userId={profile.id} name={profile.full_name} avatarUrl={brandingUrl(profile.avatar_path)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm fullName={profile.full_name} email={profile.email} timezone={profile.timezone} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>Change password</CardTitle>
          <CardDescription>You&apos;ll stay signed in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </>
  );
}
