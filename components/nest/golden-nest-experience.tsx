"use client";

import { useState } from "react";
import { GoldenNestStage } from "@/components/nest/golden-nest-stage";
import {
  GOLDEN_NEST_ASSETS_BY_ID,
  GOLDEN_NEST_COMPOSED,
  GOLDEN_NEST_INTERACTIONS_BY_ID,
  GOLDEN_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-nest";
import {
  GOLDEN_NEST_V2_ASSETS_BY_ID,
  GOLDEN_NEST_V2_COMPOSED,
  GOLDEN_NEST_V2_INTERACTIONS_BY_ID,
  GOLDEN_NEST_V2_TEMPLATE,
} from "@/lib/fixtures/golden-nest-v2";

// The Golden Nest prototype shell. Two explicit modes:
//  - Presentation (default): the Nest is the hero — compact header + scene + the
//    stage's own bottom drawer. No debug tools, no implementation copy. V2 only.
//  - Debug (internal): V1/V2 comparison, slot overlays, and implementation notes.
// Visitor experience and debug content are never mixed.

type Version = "v1" | "v2";

const PACKS = {
  v1: {
    label: "V1 Reference",
    template: GOLDEN_NEST_TEMPLATE,
    assetsById: GOLDEN_NEST_ASSETS_BY_ID,
    interactionsById: GOLDEN_NEST_INTERACTIONS_BY_ID,
    composed: GOLDEN_NEST_COMPOSED,
  },
  v2: {
    label: "V2 Golden Nest",
    template: GOLDEN_NEST_V2_TEMPLATE,
    assetsById: GOLDEN_NEST_V2_ASSETS_BY_ID,
    interactionsById: GOLDEN_NEST_V2_INTERACTIONS_BY_ID,
    composed: GOLDEN_NEST_V2_COMPOSED,
  },
} as const;

export function GoldenNestExperience() {
  const [mode, setMode] = useState<"presentation" | "debug">("presentation");
  const [version, setVersion] = useState<Version>("v2");
  const [showOverlays, setShowOverlays] = useState(true);

  // Presentation always shows V2; debug can compare V1.
  const activeVersion: Version = mode === "presentation" ? "v2" : version;
  const pack = PACKS[activeVersion];

  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta">Nestudio</p>
          <h1 className="display truncate text-xl leading-tight">{PACKS.v2.template.name}</h1>
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "presentation" ? "debug" : "presentation"))}
          aria-pressed={mode === "debug"}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            mode === "debug"
              ? "border-terracotta bg-terracotta/15 text-terracotta"
              : "border-ink/15 text-ink/55 hover:border-ink/30"
          }`}
        >
          {mode === "debug" ? "Exit debug" : "Debug"}
        </button>
      </div>

      {/* Debug-only controls */}
      {mode === "debug" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white/50 p-3 text-xs">
          <div className="inline-flex rounded-full border border-ink/15 bg-white/70 p-1 font-bold">
            {(Object.keys(PACKS) as Version[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVersion(v)}
                aria-pressed={version === v}
                className={`rounded-full px-3 py-1.5 transition ${
                  version === v ? "bg-ink text-parchment-light" : "text-ink/55 hover:text-ink/80"
                }`}
              >
                {PACKS[v].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOverlays((s) => !s)}
            aria-pressed={showOverlays}
            className={`rounded-full border px-3 py-1.5 font-bold transition ${
              showOverlays ? "border-terracotta bg-terracotta/15 text-terracotta" : "border-ink/15 text-ink/60 hover:border-ink/30"
            }`}
          >
            {showOverlays ? "Hide slot overlays" : "Show slot overlays"}
          </button>
          <span className="text-ink/45">
            {pack.composed.slotAssignments.length} objects · {pack.template.aspectRatio} · ADR-028 front-facing
          </span>
        </div>
      ) : null}

      <GoldenNestStage
        key={activeVersion}
        template={pack.template}
        assetsById={pack.assetsById}
        interactionsById={pack.interactionsById}
        composed={pack.composed}
        showOverlays={mode === "debug" && showOverlays}
      />

      {/* Debug-only implementation notes (kept out of the visitor experience). */}
      {mode === "debug" ? (
        <p className="text-xs leading-relaxed text-ink/40">
          Front-facing cinematic Nest (ADR-028), composed from the data contract — Nest Template
          background + transparent cut-outs snapped into normalized Scene Slots, z-ordered, with
          contact-shadow grounding. V1 = early placeholder pack; V2 = premium transparent cut-outs +
          zoned layout. Contract <code>lib/nest-types.ts</code>; fixtures{" "}
          <code>lib/fixtures/golden-nest.ts</code> + <code>golden-nest-v2.ts</code>; renderer{" "}
          <code>lib/nest-render.ts</code> + <code>components/nest/golden-nest-stage.tsx</code>. See{" "}
          <code>docs/golden-nest-renderer.md</code>. Internal page — not linked from the app.
        </p>
      ) : null}
    </div>
  );
}
