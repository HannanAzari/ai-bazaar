import { NestSceneNavigator } from "@/components/nest/nest-scene-navigator";
import {
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import { goldenLivingNestWithDesk } from "@/lib/fixtures/golden-desk-detail";

// Internal, unlinked visitor surface (M7C Focus Areas + Detail Scenes). Renders the
// Golden Living Nest with the desk Focus Area; tapping "Explore desk" transitions into
// the Golden Desk Detail Scene and Back returns. Not linked.

export const metadata = {
  title: "Nest Focus & Detail Scenes — Nestudio internal",
  robots: { index: false, follow: false },
};

export default function NestFocusPage() {
  const doc = goldenLivingNestWithDesk();
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-parchment p-3" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <NestSceneNavigator
        doc={doc}
        assetsById={GOLDEN_LIVING_NEST_ASSETS_BY_ID}
        interactionsById={GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID}
        baseTemplate={GOLDEN_LIVING_NEST_TEMPLATE}
      />
    </main>
  );
}
