// ── Nestudio V2 — Nest hotspot contract (M7B) ───────────────────────────────
//
// Additive, framework-free contract for **interaction hotspots** — sub-regions of a
// single asset instance that each open or control something. A hotspot is NOT a
// visual asset; it is an interaction region attached to an `EditableNestObject`. One
// asset may carry many hotspots (a desk's laptop/mic/notebook, a bookshelf's books).
//
// Geometry is normalized 0..1 in the asset's OWN local box (not the whole Nest), so
// a hotspot stays attached and scales/rotates/flips automatically with its asset.
// No React/DOM types. Backward-compatible: objects without `hotspots` still load.

/** A hotspot region in asset-local normalized coordinates (0..1 inside the asset). */
export type NestHotspotShape =
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "ellipse"; x: number; y: number; width: number; height: number };

/** What a hotspot semantically opens or controls. Drives the visitor effect + drawer. */
export type NestHotspotSemantic =
  | "video"
  | "music"
  | "podcast"
  | "website"
  | "article"
  | "gallery"
  | "shop"
  | "profile"
  | "ambience"
  | "animation"
  | "custom_link";

/** The creator-chosen destination/behaviour bound to a hotspot. */
export interface NestHotspotContentBinding {
  type: NestHotspotSemantic;
  label?: string;
  url?: string;
  contentId?: string;
  provider?: string;
  metadata?: Record<string, string>;
}

/** One interaction region on an asset instance. */
export interface NestAssetHotspot {
  id: string;
  name: string;
  semantic: NestHotspotSemantic;
  shape: NestHotspotShape;

  /** Optional explicit interaction id; otherwise the semantic maps to an effect. */
  interactionId?: string;
  binding?: NestHotspotContentBinding;

  enabled: boolean;
  locked?: boolean;
  /** "predefined" = from the catalog (art-aligned); "custom" = author-drawn. */
  authoringMode?: "predefined" | "custom";

  ariaLabel?: string;
  notes?: string;
}

/** Semantics that are internal actions (no external URL required). */
export const INTERNAL_SEMANTICS: NestHotspotSemantic[] = ["ambience", "animation", "profile"];

/** Whether a semantic is an internal action (works without a URL). */
export function isInternalSemantic(s: NestHotspotSemantic): boolean {
  return INTERNAL_SEMANTICS.includes(s);
}

/** The smallest a hotspot may be, in asset-local units. */
export const MIN_HOTSPOT_SIZE = 0.06;

/** All semantic types, for UI iteration. */
export const NEST_HOTSPOT_SEMANTICS: NestHotspotSemantic[] = [
  "video",
  "music",
  "podcast",
  "website",
  "article",
  "gallery",
  "shop",
  "profile",
  "ambience",
  "animation",
  "custom_link",
];
