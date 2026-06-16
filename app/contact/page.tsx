import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact" intro="Questions, bugs, or data requests during the pilot — we’d love to hear from you.">
      <p><strong>Email.</strong> <a className="font-bold text-teal" href="mailto:hello@nestud.io">hello@nestud.io</a> (placeholder pilot address).</p>
      <p><strong>Bugs &amp; feedback.</strong> Tell us what broke or what felt confusing — it directly shapes the pilot.</p>
      <p><strong>Data requests.</strong> Ask us to export or delete your account and rooms and we’ll take care of it.</p>
    </LegalPage>
  );
}
