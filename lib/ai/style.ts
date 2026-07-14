/**
 * lib/ai/style.ts — the Nestudio art direction as structured tokens.
 * -----------------------------------------------------------------------------
 * The single source of truth for "what a Nestudio asset looks like". Prompt
 * builders compose these tokens; components must never hardcode style strings.
 * A studio can override individual tokens per request without forking this file.
 */

import type { StyleTokens } from "./types";

/**
 * The house style shared by every generated asset. Distilled from
 * docs/nestudio-visual-dna.md (V1.0): a warm, rounded, MATTE, hand-made little
 * world — premium matte never gloss, front-facing (not 30° isometric), warm
 * upper-left key with a cool-plum shadow, objects cut out to alpha.
 */
export const NESTUDIO_STYLE: StyleTokens = {
  name: "Nestudio Cozy 3D",
  descriptors: [
    "soft stylized 3D render",
    "warm, rounded, hand-made miniature",
    "premium matte materials, never glossy",
    "smooth rounded forms with subtle ambient occlusion",
    "readable clean silhouette at small sizes",
    "storybook cozy charm",
  ],
  palette: ["warm parchment and cream", "soft plaster and stone", "one cozy accent (sage, caramel, terracotta or teal)"],
  lighting: "warm key light upper-left (#fff6e0), soft cool-plum shadow (#46365a), gentle ambient occlusion",
  framing: "single centered object, front three-quarter view with a slight 5–10° tilt, subtle contact shadow",
  background: "transparent",
  negative: [
    "photorealistic",
    "glossy or chrome materials",
    "harsh shadows",
    "isometric 30-degree view",
    "busy or opaque background",
    "text or watermark",
    "cluttered scene, extra objects",
    "low quality",
  ],
};

/** Merge per-request overrides onto the base tokens (arrays are replaced, not
 *  concatenated, so a studio can fully retune when it needs to). */
export function mergeStyle(base: StyleTokens, override?: Partial<StyleTokens>): StyleTokens {
  if (!override) return base;
  return {
    ...base,
    ...override,
    descriptors: override.descriptors ?? base.descriptors,
    palette: override.palette ?? base.palette,
    negative: override.negative ?? base.negative,
  };
}
