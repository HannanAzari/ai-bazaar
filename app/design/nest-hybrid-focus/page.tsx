"use client";

import { useState } from "react";
import { NestSceneNavigator } from "@/components/nest/nest-scene-navigator";
import {
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import { goldenLivingNestHybrid, studioNestHybrid } from "@/lib/fixtures/golden-hybrid-focus";

// Internal, unlinked visitor surface for the M7C.1 HYBRID Focus system.
//   • "Living Nest" → TV Console Zoom + Frame Zoom (true crop zoom, real objects).
//   • "Studio Nest" → Bookshelf Zoom (with a child book) + Desk Detail Surface.
// Tap an affordance to enter; Back / Escape / browser-back returns. `debug` reveals the
// focus-area bounds + hotspot regions. Not linked from anywhere.

export default function NestHybridFocusPage() {
  const [which, setWhich] = useState<"living" | "studio">("living");
  const [debug, setDebug] = useState(false);
  const doc = which === "living" ? goldenLivingNestHybrid() : studioNestHybrid();
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-parchment p-3" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center gap-2 text-xs font-bold">
        <button type="button" onClick={() => setWhich("living")} className={`rounded-full px-3 py-1.5 ${which === "living" ? "bg-ink text-parchment" : "border border-ink/20 text-ink/70"}`}>Living Nest</button>
        <button type="button" onClick={() => setWhich("studio")} className={`rounded-full px-3 py-1.5 ${which === "studio" ? "bg-ink text-parchment" : "border border-ink/20 text-ink/70"}`}>Studio Nest</button>
        <button type="button" onClick={() => setDebug((d) => !d)} className={`rounded-full px-3 py-1.5 ${debug ? "bg-cobalt text-white" : "border border-ink/20 text-ink/70"}`}>{debug ? "Debug on" : "Debug off"}</button>
      </div>
      <NestSceneNavigator
        key={which}
        doc={doc}
        assetsById={GOLDEN_LIVING_NEST_ASSETS_BY_ID}
        interactionsById={GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID}
        baseTemplate={GOLDEN_LIVING_NEST_TEMPLATE}
        debug={debug}
      />
    </main>
  );
}
