import { GoldenNestExperience } from "@/components/nest/golden-nest-experience";

// Internal, unlinked Golden Nest prototype. Presentation mode (default) makes the
// Nest the hero; debug mode holds the V1/V2 comparison + slot overlays + notes.
// Front-facing camera locked by ADR-028. Not linked from the app.

export const metadata = {
  title: "Golden Nest — Nestudio prototype",
  robots: { index: false, follow: false },
};

export default function GoldenNestPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-4">
      <GoldenNestExperience />
    </section>
  );
}
