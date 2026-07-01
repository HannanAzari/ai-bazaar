import { NestComposerExperience } from "@/components/nest/nest-composer-experience";

// Internal, unlinked Nest Composer demo. Proves the deterministic Composer: a
// creator profile → a valid Golden Nest V2 manifest, rendered by the existing V2
// renderer. Not onboarding, not linked from the app, noindex.

export const metadata = {
  title: "Nest Composer — Nestudio internal",
  robots: { index: false, follow: false },
};

export default function NestComposerPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-4">
      <NestComposerExperience />
    </section>
  );
}
