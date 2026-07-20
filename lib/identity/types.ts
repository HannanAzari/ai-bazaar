/**
 * lib/identity/types.ts — the Identity Lock contracts.
 *
 * The priority is IDENTITY > FUNCTION > Nestudio DNA. Style may only change finish,
 * edges, lighting, material and polish — it must NEVER redesign or recolour the
 * object's critical identity. The IdentityContract is extracted BEFORE generation and
 * is IMMUTABLE; the identity validator and targeted repair enforce it deterministically
 * (we do not trust the model to preserve identity — we enforce it in post).
 *
 * PURE TYPES.
 */

import type { RasterImage } from "@/lib/ai/types";

export type RGB = [number, number, number];
export type BBox = { x: number; y: number; w: number; h: number };

/** A dominant colour of the object, with where it lives and whether it's critical. */
export type ColourRegion = {
  rgb: RGB;
  /** Fraction of the object's pixels that belong to this colour. */
  coverage: number;
  /** Normalized bbox (0..1) of where this colour sits on the object. */
  bbox: BBox;
  /** Distinctive colours that MUST survive generation (e.g., a black handle). */
  critical: boolean;
};

/**
 * The object's critical identity, as structured data (never prose). Extracted once,
 * then immutable. Everything here is enforceable deterministically.
 */
export type IdentityContract = {
  /** From the user's subject ("coffee mug"). */
  objectType: string;
  /** The Preserve Details flag — keep graphics/text/wear. */
  preserveDetails: boolean;
  /** The source silhouette (alpha) + shape metrics. */
  silhouette: { width: number; height: number; aspect: number; alpha: Uint8ClampedArray };
  /** Dominant colours with regions. */
  colours: ColourRegion[];
  /** Colours that must be preserved (subset of `colours`). */
  criticalColours: RGB[];
  /** True when the object has distinctive graphics/lettering (high-freq dark marks). */
  hasGraphics: boolean;
  /** The clean source cutout (for silhouette conform + region re-apply). */
  source: RasterImage;
  /** The critical-colour regions (e.g., black handle + lettering) as an opaque layer
   *  on transparency — re-applied during targeted repair to guarantee identity. */
  identityLayer?: RasterImage;
  /** The fine graphics/lettering marks alone (subset of identityLayer). */
  detailLayer?: RasterImage;
};

/** One identity dimension's verdict — hard pass/fail, never a weighted score. */
export type IdentityDim = { key: string; label: string; pass: boolean; detail?: string };

export type IdentityReport = {
  /** Gate 1: ALL critical dims must pass. */
  pass: boolean;
  dims: IdentityDim[];
  /** Which dimensions failed (drive targeted repair). */
  failures: string[];
};
