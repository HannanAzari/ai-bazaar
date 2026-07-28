// ── Nestudio — Nest Document model (M11) ─────────────────────────────────────
//
// Everything in Nestudio revolves around a single object: the NestDocument. A
// template is NOT special — it is simply a pre-populated NestDocument. Persistence
// in M11 is localStorage only (see lib/nest-document-store.ts).

export type NestVisibility = "draft" | "public" | "unlisted" | "followers" | "private";

/**
 * M23B — the editor-only state a placement used to lose the moment it left the canvas.
 * M23A unified *geometry*; this carries the rest of what a creator configured (which
 * hotspots are live, what content is bound to a surface, whether an object is locked)
 * so a published Nest behaves for a visitor the way it behaved in the editor.
 *
 * Stored as one `jsonb` column (`nest_objects.interaction`) rather than a column per
 * field: it is a passthrough bag owned by the editor, and widening it must not need a
 * migration.
 */
export type NestPlacementInteraction = {
  /** Semantic interaction id (TV→video, frame→gallery, …). */
  interactionId?: string;
  contentBinding?: import("@/lib/nest-types").NestContentBinding;
  hotspots?: import("@/lib/nest-hotspot-types").NestAssetHotspot[];
  surfaces?: import("@/lib/nest-surface-types").ObjectSurfaceContent;
  /** Depth plane the editor placed this object on. */
  plane?: import("@/lib/nest-editor-types").EditorPlane;
  locked?: boolean;
  hidden?: boolean;
  contactShadow?: boolean;
  variantId?: string;
};

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
  /** M23A — horizontal mirroring, so a flipped object stays flipped after publish/reload. */
  flipX?: boolean;
  /** M23B — creator-authored label shown on/near the object. */
  label?: string;
  /** M23B — creator-authored link target for the object. */
  linkUrl?: string;
  /** M23B — everything else the editor configured on this instance (see the type). */
  interaction?: NestPlacementInteraction;
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
