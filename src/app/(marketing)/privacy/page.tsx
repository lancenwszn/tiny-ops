import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>TinyOps is operated by SZN Labs. This policy explains what we collect when you use TinyOps and why.</p>
      <h2>What we collect</h2>
      <p>Account details (name, email address), the business information you add to your workspaces, and the content your team creates, such as SOPs, tasks, checklists and handovers.</p>
      <h2>How we use it</h2>
      <p>Only to provide and improve the service, secure your account, and contact you about your account. We do not sell your data.</p>
      <h2>Where it is stored</h2>
      <p>Data is stored with our infrastructure providers (Supabase for database, authentication and file storage; Vercel for hosting; Stripe for payments). Each workspace&apos;s data is isolated from other workspaces.</p>
      <h2>Your choices</h2>
      <p>You can update your profile at any time and ask us to export or delete your data by contacting support.</p>
    </LegalPage>
  );
}
