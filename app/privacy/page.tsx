import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" intro="A short, plain summary of how Nestudio handles your information during the pilot.">
      <p><strong>What we store.</strong> Your account email, your display name and handle, the Nest (room) you create, and basic in-app activity counts. In demo mode everything stays in your browser; in the pilot it is stored in our Supabase project.</p>
      <p><strong>What we don’t do.</strong> No ads, no selling your data, no third-party trackers during the pilot.</p>
      <p><strong>Links you add.</strong> Social and website links you place in your room are public, just like the room itself.</p>
      <p><strong>Removing your data.</strong> Email us and we’ll delete your account, Nest, and rooms.</p>
    </LegalPage>
  );
}
