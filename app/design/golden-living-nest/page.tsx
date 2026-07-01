import { GoldenLivingNestExperience } from "@/components/nest/golden-living-nest-experience";

// Internal, unlinked Golden Living Nest prototype (M5 visual lock candidate).
// Presentation mode (default) makes the living room the hero; debug mode holds the
// slot/scale calibration overlays + placeholder/state-pack notes. Front-facing
// camera locked by ADR-028. Not linked from the app.

export const metadata = {
  title: "Golden Living Nest — Nestudio prototype",
  robots: { index: false, follow: false },
};

export default function GoldenLivingNestPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-4">
      <GoldenLivingNestExperience />
    </section>
  );
}
