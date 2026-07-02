"use client";

import { useMemo, useState } from "react";
import { GoldenLivingNestStage } from "@/components/nest/golden-living-nest-stage";
import {
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";

// The Golden Living Nest prototype shell. Two explicit modes:
//  - Presentation (default): the Nest is the hero — compact header + scene + the
//    stage's own bottom drawer. No debug tools, no implementation copy.
//  - Debug (internal): slot/scale overlays + placeholder + state-pack notes.

export function GoldenLivingNestExperience() {
  const [mode, setMode] = useState<"presentation" | "debug">("presentation");
  const [showOverlays, setShowOverlays] = useState(true);

  const placeholders = useMemo(
    () => Object.values(GOLDEN_LIVING_NEST_ASSETS_BY_ID).filter((a) => a.placeholder),
    [],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta">Nestudio</p>
          <h1 className="display truncate text-xl leading-tight">{GOLDEN_LIVING_NEST_TEMPLATE.name}</h1>
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "presentation" ? "debug" : "presentation"))}
          aria-pressed={mode === "debug"}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            mode === "debug" ? "border-terracotta bg-terracotta/15 text-terracotta" : "border-ink/15 text-ink/55 hover:border-ink/30"
          }`}
        >
          {mode === "debug" ? "Exit debug" : "Debug"}
        </button>
      </div>

      {mode === "debug" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white/50 p-3 text-xs">
          <button
            type="button"
            onClick={() => setShowOverlays((s) => !s)}
            aria-pressed={showOverlays}
            className={`rounded-full border px-3 py-1.5 font-bold transition ${
              showOverlays ? "border-terracotta bg-terracotta/15 text-terracotta" : "border-ink/15 text-ink/60 hover:border-ink/30"
            }`}
          >
            {showOverlays ? "Hide calibration overlays" : "Show calibration overlays"}
          </button>
          <span className="text-ink/45">
            {GOLDEN_LIVING_NEST_COMPOSED.slotAssignments.length} objects · {GOLDEN_LIVING_NEST_TEMPLATE.aspectRatio} · ADR-028
          </span>
        </div>
      ) : null}

      <GoldenLivingNestStage
        template={GOLDEN_LIVING_NEST_TEMPLATE}
        assetsById={GOLDEN_LIVING_NEST_ASSETS_BY_ID}
        interactionsById={GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID}
        composed={GOLDEN_LIVING_NEST_COMPOSED}
        showOverlays={mode === "debug" && showOverlays}
      />

      {mode === "debug" ? (
        <div className="space-y-2 text-xs leading-relaxed text-ink/45">
          <p>
            Front-facing living room (ADR-028) composed from the data contract. Premium interactions use
            layered/clipped states: TV screen-only light, plant leaf-only sway, avatar breathing + greeting,
            frame focus, smooth lamp ambience. Contract <code>lib/nest-visual-types.ts</code>; fixture{" "}
            <code>lib/fixtures/golden-living-nest.ts</code>; scale <code>lib/nest-scale.ts</code>; renderer{" "}
            <code>components/nest/golden-living-nest-stage.tsx</code>. Internal — not linked.
          </p>
          {placeholders.length ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-50/60 p-2.5 text-ink/70">
              <p className="font-bold text-ink/80">⚠ Temporary placeholder art (NOT production-ready):</p>
              <ul className="mt-1 list-disc pl-4">
                {placeholders.map((a) => (
                  <li key={a.id}>
                    <span className="font-bold">{a.name}</span> ({a.id}) — {a.artNote}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
