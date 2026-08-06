"use client";

import type { ReactNode } from "react";

// ── M26A §1/§2 — the Nest Stage ──────────────────────────────────────────────
//
//   <NestStage>
//     <NestViewport>  … the canonical 3:4 scene, inside the camera transform
//     <ScreenSpaceChrome>  … everything that must NOT scale with the room
//   </NestStage>
//
// The Stage is the APP ENVIRONMENT around the room. It is not part of the creator's Nest
// and is never stored in the document — which is the whole reason it can be redesigned
// freely without touching a single published Nest.
//
// The inner 3:4 scene remains the visual source of truth: the Stage paints behind and
// around it and never crops, stretches or re-frames it. Object geometry is untouched.
//
// WHY THIS REPLACES THE OLD SURROUND. The previous treatment derived a hue per background
// id, which produced a different colour for every Nest — green behind one room, beige
// behind another, near-black behind a third. Read as bands, and read as an accident. A
// gallery does not repaint its walls per painting. One deliberate stage, two variants.

export type StageTheme = "dark" | "light";

/**
 * The outer stage. `theme` is a small explicit value, NOT sampled from the room image:
 * sampling is what produced the unrelated colour bands, and it also flickers while an
 * image decodes.
 */
export function NestStage({
  theme = "dark",
  className = "",
  rounded = "",
  children,
}: {
  theme?: StageTheme;
  className?: string;
  rounded?: string;
  children: ReactNode;
}) {
  const t = theme === "light" ? LIGHT : DARK;
  return (
    <div
      className={`relative isolate overflow-hidden ${rounded} ${className}`}
      style={{ backgroundColor: t.base }}
      data-nest-stage-root=""
      data-stage-theme={theme}
    >
      {/* Every layer here is decoration and MUST stay pointer-transparent, or it would
          swallow taps meant for the room or for the chrome above it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* a restrained vertical gradient — a lit room, not a flat field */}
        <div className="absolute inset-0" style={{ background: t.gradient }} />
        {/* soft radial light BEHIND the Nest, so the room reads as displayed */}
        <div className="absolute inset-0" style={{ background: t.glow }} />
        {/* slight vignette at the edges */}
        <div className="absolute inset-0" style={{ background: t.vignette }} />
      </div>
      {children}
    </div>
  );
}

/**
 * The clipping box the camera is attached to, centred in the Stage.
 *
 * The 3:4 aspect is locked with container-query units so the box fits on BOTH axes.
 * (`height:100%` + `aspect-ratio` + `max-width` does not work: a definite height lets
 * aspect-ratio derive only the width, which max-width then clamps, breaking the ratio.)
 *
 * `shadow` gives the room a soft edge against the stage so it reads as an object placed
 * on a surface rather than a hole cut in the background.
 */
export function NestViewport({
  aspect = 0.75,
  viewportRef,
  interactive = true,
  className = "",
  children,
}: {
  aspect?: number;
  viewportRef?: React.Ref<HTMLDivElement>;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ containerType: "size" }}>
      <div
        ref={viewportRef}
        data-nest-viewport=""
        className={`relative overflow-hidden ${className}`}
        style={{
          width: `min(100cqw, ${aspect * 100}cqh)`,
          aspectRatio: `${aspect}`,
          // `touch-action: none` hands every touch to the gesture layer; without it Safari
          // runs its own pan/zoom underneath and the two fight.
          touchAction: interactive ? "none" : undefined,
          boxShadow: "0 24px 60px -18px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Everything that must NOT scale with the room: the selected-object toolbar, resize and
 * rotation handles, the Reset control, instructional messages.
 *
 * It is a SIBLING of the viewport, never a descendant of the camera transform, so a handle
 * is 44px at 1× and still 44px at 5× — a handle that scaled to 220px would cover the very
 * object it was resizing.
 */
export function ScreenSpaceChrome({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div data-screen-space="" className={`pointer-events-none absolute inset-0 ${className}`}>
      {children}
    </div>
  );
}

// ── The two stage variants ───────────────────────────────────────────────────
//
// Deep and desaturated on purpose: the stage must recede under every room, bright or dark.
// One tint each, chosen once, so every Nest sits in the same gallery.

const DARK = {
  base: "#141317",
  gradient: "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 34%, rgba(0,0,0,0.28) 100%)",
  glow: "radial-gradient(58% 44% at 50% 44%, rgba(255,214,150,0.11), transparent 72%)",
  vignette: "radial-gradient(120% 92% at 50% 50%, transparent 50%, rgba(0,0,0,0.46))",
} as const;

const LIGHT = {
  base: "#e8e3da",
  gradient: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 38%, rgba(60,50,40,0.10) 100%)",
  glow: "radial-gradient(58% 44% at 50% 44%, rgba(255,236,205,0.55), transparent 72%)",
  vignette: "radial-gradient(120% 92% at 50% 50%, transparent 54%, rgba(60,50,40,0.14))",
} as const;

/** The stage colours, exported so tests can assert there is exactly one of each. */
export const STAGE_THEMES = { dark: DARK, light: LIGHT } as const;
