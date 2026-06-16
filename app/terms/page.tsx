import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" intro="The friendly ground rules for using Nestudio during the pilot.">
      <p><strong>Pilot software.</strong> Nestudio is an early pilot. Things may change, break, or be reset; please don’t rely on it for anything critical yet.</p>
      <p><strong>Be decent.</strong> Don’t post illegal, hateful, or abusive content, and only add links you have the right to share.</p>
      <p><strong>Your content.</strong> You keep ownership of what you create. You give us permission to display it so visitors can see your room.</p>
      <p><strong>No warranty.</strong> The pilot is provided “as is,” without guarantees of availability or data retention.</p>
    </LegalPage>
  );
}
