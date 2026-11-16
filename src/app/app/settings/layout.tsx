import { PageHeader } from "@/components/shared/page-header";
import { SettingsTabs } from "./settings-tabs";

export default function SettingsLayout({ children }: LayoutProps<"/app/settings">) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Manage your workspace and your personal account." />
      <SettingsTabs />
      <div className="mt-6 grid gap-6">{children}</div>
    </div>
  );
}
