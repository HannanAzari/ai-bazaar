import { redirect } from "next/navigation";

// M15: onboarding is no longer a disconnected experience — the Create tab (/create)
// is the single creation entry point. This legacy prototype route now redirects there.
export default function NestOnboardingPage() {
  redirect("/create");
}
