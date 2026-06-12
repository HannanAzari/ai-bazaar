import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { VillageWorld } from "@/components/village-world";

export default function HomePage() {
  return (
    <>
      <VillageWorld />
      <OnboardingOverlay />
    </>
  );
}
