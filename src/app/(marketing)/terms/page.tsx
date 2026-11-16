import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>These terms govern your use of TinyOps, a service provided by SZN Labs.</p>
      <h2>Your account</h2>
      <p>You are responsible for keeping your login credentials secure and for activity in workspaces you own.</p>
      <h2>Your content</h2>
      <p>You own the content you and your team add to TinyOps. You grant us permission to host and process it solely to provide the service.</p>
      <h2>Subscriptions</h2>
      <p>Paid plans are billed monthly in advance and can be cancelled at any time; access continues until the end of the paid period.</p>
      <h2>Acceptable use</h2>
      <p>Do not use TinyOps for unlawful activity or attempt to access data that does not belong to your workspaces.</p>
    </LegalPage>
  );
}
