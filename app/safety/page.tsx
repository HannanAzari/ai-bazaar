import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Safety" };

export default function SafetyPage() {
  return (
    <LegalPage title="Safety" intro="How to stay safe and report problems during the Nestudio pilot.">
      <p><strong>Reporting.</strong> Every house, item, owner, and guestbook note can be reported from its page; reports reach our moderation queue.</p>
      <p><strong>External links.</strong> Rooms can link out to other sites. Treat unfamiliar links with normal caution — we don’t control external destinations.</p>
      <p><strong>Your account.</strong> Use a unique password. Don’t share login details. Tell us if something looks wrong.</p>
      <p><strong>Need help?</strong> Reach us via the contact page and we’ll respond as fast as we can during the pilot.</p>
    </LegalPage>
  );
}
