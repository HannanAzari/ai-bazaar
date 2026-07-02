// ── Nestudio — Nest Document model (M11) ─────────────────────────────────────
//
// Everything in Nestudio revolves around a single object: the NestDocument. A
// template is NOT special — it is simply a pre-populated NestDocument. Persistence
// in M11 is localStorage only (see lib/nest-document-store.ts).

export type NestVisibility = "draft" | "public" | "unlisted" | "followers" | "private";

/** One placed object inside a Nest (a Placement with a stable id for selection). */
export type NestPlacement = {
  id: string;
  assetId: string;
  /** Normalized base-centre position on the background (0..1). For an overlay this is the
   *  box top-left (overlays are free — see `w`/`h`). */
  x: number;
  y: number;
  scale?: number;
  zIndex?: number;
  /** Clockwise rotation in degrees (carried so rotated objects survive publish/reload). */
  rotation?: number;
  /** M13 (Task 4B): a generic text/image overlay. Present ⇒ this placement is an overlay,
   *  sized by `w`/`h` (normalized box) rather than `scale`. */
  overlay?: import("@/lib/nest-editor-types").NestOverlay;
  /** Normalized overlay box width/height (overlays only). */
  w?: number;
  h?: number;
};

export type NestDocument = {
  id: string;
  ownerId?: string;
  backgroundId: string;
  placements: NestPlacement[];
  title: string;
  visibility: NestVisibility;
  createdAt: string;
  updatedAt: string;
  /** Set when the doc was seeded from a template (templates are just docs). */
  sourceTemplateId?: string;
};

/** Visibilities whose published URL is self-contained (shareable cross-browser). */
export const SHAREABLE_VISIBILITIES: NestVisibility[] = ["public", "unlisted"];

export function isShareable(v: NestVisibility): boolean {
  return SHAREABLE_VISIBILITIES.indexOf(v) !== -1;
}
