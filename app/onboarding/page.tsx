import { OnboardingClient } from "./onboarding-client";

// M23B — the real first run.
//
// M21 pointed this route at /create, so a brand-new account landed in the editor with no
// name, no @handle and no house — nothing a visitor could arrive at. The first
// experience is now identity → house → your own Profile, and nothing else: bio, links
// and avatar stay editable later from the Profile itself.
//
// An already-configured creator never sees this (the client forwards them to /profile);
// a partially-configured one resumes at exactly the step they are missing.
export const metadata = { title: "Welcome to Nestudio" };

export default function OnboardingPage() {
  return <OnboardingClient />;
}
