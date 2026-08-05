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
  /**
   * M25 §P2 — the creator's object-level interaction configuration (initial state +
   * connected content). Rides in this EXISTING jsonb bag, so no migration is needed; the
   * bag already round-trips losslessly (verified in M24E).
   */
  asset?: import("@/lib/nest-asset-interaction").AssetInteractionConfig;
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

/**
 * M24C §1 — the creator-authored scene state that is NOT a root placement.
 *
 * `EditableNestDocument` has carried `focusAreas` and `detailScenes` for a long time, but
 * nothing ever serialised them: `editableObjectsToPlacements()` walks `doc.objects`, which
 * is the MAIN scene only. So a plant placed inside a Focus region lived in React state and
 * was destroyed the moment the editor unmounted — the exact regression the founder hit.
 *
 * These travel with the document now, through save, draft, publish and visitor load.
 */
export type NestSceneExtras = {
  /** Bumped when the shape changes, so a migration can be written rather than guessed. */
  version: number;
  focusAreas?: import("@/lib/nest-focus-types").NestFocusArea[];
  detailScenes?: import("@/lib/nest-focus-types").NestDetailScene[];
};

/** The current scene-document version. */
export const NEST_SCENE_VERSION = 1;

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
  /** M24C — focus regions and their child scenes. Absent on pre-M24C documents. */
  scene?: NestSceneExtras;
};

/** Visibilities whose published URL is self-contained (shareable cross-browser). */
export const SHAREABLE_VISIBILITIES: NestVisibility[] = ["public", "unlisted"];

export function isShareable(v: NestVisibility): boolean {
  return SHAREABLE_VISIBILITIES.indexOf(v) !== -1;
}
