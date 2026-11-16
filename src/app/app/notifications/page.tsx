import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsPageList } from "@/features/notifications/components/notifications-page-list";
import { listNotifications } from "@/features/notifications/queries";
import { getActiveMembership } from "@/lib/workspace/active";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { workspace } = await getActiveMembership();
  const items = await listNotifications(workspace.id, 50);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description={`Updates for you in ${workspace.name}, plus any pending invitations.`} />
      <NotificationsPageList key={workspace.id} initialItems={items} />
    </div>
  );
}
