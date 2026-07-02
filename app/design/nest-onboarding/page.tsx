import { NestOnboardingClient } from "./onboarding-client";

// Internal, unlinked onboarding prototype (M10). No sign-up here — signup is deferred
// to the publish gate in the editor. Reads only curated (approved/featured) library
// items. Not linked from the app.

export const metadata = {
  title: "Create your Nest — onboarding",
  robots: { index: false, follow: false },
};

export default function NestOnboardingPage() {
  return <NestOnboardingClient />;
}
