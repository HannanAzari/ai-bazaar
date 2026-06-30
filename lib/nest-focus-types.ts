// ── Nestudio V2 — Focus Area & Detail Scene contract (M7C) ──────────────────
//
// The additive, framework-free contract for structured in-Nest navigation:
//
//     Main Nest → Focus Area → Detail Scene → (Back) → Main Nest
//
// A **Focus Area** is a navigable region of a scene that links to a **Detail Scene**
// (a separately authored close-up composition). This is NOT browser zoom: a Detail
// Scene has its own background, objects, z-order, hotspots, bindings, ambience and
// viewport, and renders through the SAME Golden Living Nest stage as the Main Nest.
//
// One navigation level only in M7C (Main → Detail → Main); nested Detail → Detail is
// deferred. Geometry is normalized 0..1. No React/DOM types here; serializes cleanly.
//
// DEVIATION (documented): the sprint's suggested `NestDetailScene.slots: LivingNestSlot[]`
// is modelled instead as `objects: EditableNestObject[]` — the editor's own manifest
// type — so the Detail Scene editor reuses every existing pure op (move/resize/hotspots/
// history/calibration) and the visitor navigator renders it via the existing
// `editorDocumentToStage` → `GoldenLivingNestStage` with no second engine.

import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";

export type NestSceneKind = "main" | "detail";

export type FocusTrigger = "tap" | "double_tap";
export const FOCUS_TRIGGERS: FocusTrigger[] = ["tap", "double_tap"];

export type FocusTransition = "zoom" | "push" | "fade_zoom" | "smooth_zoom" | "cinematic_zoom";
export const FOCUS_TRANSITIONS: FocusTransition[] = ["zoom", "push", "fade_zoom", "smooth_zoom", "cinematic_zoom"];

export type FocusShape = "rect" | "ellipse";

/** The smallest a Focus Area may be (normalized), to avoid accidental zero-area regions. */
export const MIN_FOCUS_AREA_SIZE = 0.05;

/** Normalized region (0..1 on the scene). */
export interface NestFocusBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rectangle in device/scene pixels (used by the focus cover transform). */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a Zoom Region's crop came from (M7C.3). `suggested` = the auto-recommended crop
 * (shown with a "Suggested" label, freely overwritten); `creator_authored` = the creator
 * visually authored it — the source of truth, never silently replaced by the suggestion.
 */
export type FocusCropSource = "suggested" | "creator_authored";

// ── M7C.1 — Hybrid Focus: Zoom Region | Detail Surface ─────────────────────────
//
// A Focus Area now resolves to one of two TARGET TYPES:
//
//   • "zoom_region"    — enlarge a crop of the EXISTING Main scene to fill the
//                        viewport (true crop zoom, no new composition). Used when the
//                        content already reads well enlarged (bookshelf, TV console,
//                        frame, pinboard). Carries `zoomRegion` (crop + optional child
//                        objects/hotspots + resolution strategy + image sources).
//   • "detail_surface" — transition into a SEPARATELY authored close-up composition
//                        (a `NestDetailScene`). Used when the front-facing main view
//                        cannot reveal the surface by zooming (desk top, benchtop).
//                        Carries `detailSurfaceId` (= the target Detail Scene id).
//
// Backward compatibility: pre-M7C.1 documents have no `targetType` and only
// `targetSceneId` + `bounds`. They are treated as `detail_surface` (the original
// behaviour) — see `focusTargetTypeOf` / `migrateFocusArea` in nest-focus-scenes.ts.

export type FocusTargetType = "zoom_region" | "detail_surface";
export const FOCUS_TARGET_TYPES: FocusTargetType[] = ["zoom_region", "detail_surface"];

/**
 * The resolution decision for a Zoom Region (Phase 2). Chosen from the measured audit:
 *   • reuse_source                  — the crop stays crisp enough at target size;
 *   • reuse_source_with_child_assets — background crop is fine but small objects want
 *                                      sharper separate overlays;
 *   • load_high_res_variant         — composition is correct but the crop is visibly
 *                                      soft and a higher-res source can replace it;
 *   • use_detail_surface            — the problem is PERSPECTIVE, not resolution.
 */
export type FocusResolutionStrategy =
  | "reuse_source"
  | "reuse_source_with_child_assets"
  | "load_high_res_variant"
  | "use_detail_surface";
export const FOCUS_RESOLUTION_STRATEGIES: FocusResolutionStrategy[] = [
  "reuse_source",
  "reuse_source_with_child_assets",
  "load_high_res_variant",
  "use_detail_surface",
];

/**
 * Progressive image sources for a Zoom Region (Phase 12). `standardUrl` shows
 * immediately; `highResolutionUrl` (optional, may be undefined in M7C.1) is preloaded
 * during/after the transition and cross-faded in. A failed/absent hi-res keeps standard.
 */
export interface FocusImageSources {
  standardUrl?: string;
  highResolutionUrl?: string;
}

/**
 * The Zoom-Region payload of a Focus Area. `cropBounds` is the normalized region of the
 * source scene to enlarge. `childObjects` / `childHotspots` are LOCAL to the crop (0..1
 * inside the crop) and are inactive in the Main view — they activate only after focus
 * entry (Phase 9). `maxScale` caps the enlargement to avoid over-softening.
 */
export interface NestFocusZoomRegion {
  cropBounds: NestFocusBounds;
  maxScale?: number;
  imageSources?: FocusImageSources;
  /** Child objects in crop-local coordinates; inactive until focus entry. */
  childObjects?: EditableNestObject[];
  /** Extra hotspots in crop-local coordinates; inactive until focus entry. */
  childHotspots?: NestAssetHotspot[];
  resolutionStrategy?: FocusResolutionStrategy;
  /**
   * Whether `cropBounds` is the auto-suggestion or creator-authored (M7C.3). Absent ⇒
   * treated as `suggested` for back-compat. Once `creator_authored`, the suggestion is
   * never reapplied automatically.
   */
  cropSource?: FocusCropSource;
}

/** A navigable region. Resolves to a Zoom Region OR a Detail Surface (M7C.1). */
export interface NestFocusArea {
  id: string;
  name: string;

  /** The scene this region lives in (the Main Nest scene id, = the document id). */
  sourceSceneId: string;
  /**
   * The Detail Scene this region opens (the detail_surface target). Kept for backward
   * compatibility and used as the `detail_surface` id; empty for a pure zoom_region.
   */
  targetSceneId: string;

  /**
   * The **trigger region** on the source scene (a.k.a. `triggerBounds`) — the forgiving
   * visitor tap target. In Main view a Focus Area OWNS the first tap inside this region
   * (M7C.2 focus-first rule). Distinct from the Zoom Region's `cropBounds` (the visual
   * composition); see `triggerBoundsOf` / `cropBoundsOf` in nest-focus-scenes.ts.
   */
  bounds: NestFocusBounds;
  shape?: FocusShape;

  /** Tie-break weight when overlapping Focus Areas claim a point (higher wins). */
  priority?: number;

  trigger: FocusTrigger;
  transition: FocusTransition;

  // ── M7C.1 hybrid fields (additive, optional) ──
  /** Which target type this area resolves to. Absent ⇒ inferred (detail_surface). */
  targetType?: FocusTargetType;
  /** Present when (and required when) `targetType === "zoom_region"`. */
  zoomRegion?: NestFocusZoomRegion;
  /** The Detail Surface id for a `detail_surface` target (defaults to targetSceneId). */
  detailSurfaceId?: string;

  /**
   * M7C.4 V1 contract: the SINGLE creator-authored rectangle — it is both the Main-Nest
   * tap target AND the exact region that fills the Nest viewport on focus. Its normalized
   * width equals its normalized height (so its on-screen aspect matches the 3:4 Nest, the
   * scene scaling without distortion). Absent ⇒ migrated from legacy `cropBounds`/`bounds`
   * (see `focusBoundsOf` / `normalizeLegacyFocusArea`). The trigger/crop split is retired.
   */
  focusBounds?: NestFocusBounds;

  /**
   * M7C.6: the editable CHILD SCENE this area opens (a `NestDetailScene`). Absent until the
   * creator/visitor first enters (created lazily via `ensureFocusChildScene`). The child
   * scene's visual base is the parent transformed to `focusBounds` (`parent_crop`).
   */
  childSceneId?: string;

  enabled: boolean;
  locked?: boolean;

  /** Subtle visitor hint, e.g. "Explore desk". */
  previewHint?: string;
  ariaLabel?: string;
  notes?: string;
}

/** A scene's viewport metadata (aspect + optional safe bounds / content scale). */
export interface NestSceneViewport {
  aspectRatio: "3:4" | "9:16" | string;
  safeBounds?: NestFocusBounds;
  contentScale?: number;
}

// ── M7C.6 — scene graph: a Focus Area is an entrance to a child editable scene ──

/** The visual base of a child Focus Scene. */
export type SceneBackgroundSource =
  | { type: "parent_crop"; parentSceneId: string; focusBounds: NestFocusBounds }
  | { type: "image"; imageUrl: string };

/** A scene kind in the editable scene graph. */
export type EditableSceneType = "main" | "focus" | "detail_surface";

/** Maximum active nesting depth (Main = depth 0). One technical level beyond Main works
 *  fully in V1; deeper is supported recursively in the pure logic, capped here. */
export const MAX_FOCUS_DEPTH = 3;

/** The editor's scene navigation stack (which child scene is being edited). */
export interface EditorSceneContext {
  /** "" (or the root id) = the Main scene. */
  activeSceneId: string;
  /** Root → … → active. Always at least one entry. */
  sceneStack: string[];
}

/**
 * A separately authored close-up scene. Owns its own object manifest (scene-scoped),
 * background, viewport, ambience and timestamps. `focusAreas` is reserved (empty in
 * M7C — one navigation level); a non-empty value is rejected by validation.
 */
export interface NestDetailScene {
  id: string;
  name: string;
  kind: "detail";

  parentSceneId: string;
  parentFocusAreaId: string;

  /** M7C.6: "focus" = child scene whose base is the parent crop; "detail_surface" = its
   *  own authored image (the original M7C model). Absent ⇒ inferred from backgroundSource. */
  sceneType?: EditableSceneType;
  /** M7C.6: the child scene's visual base (parent_crop for Focus Scenes). */
  backgroundSource?: SceneBackgroundSource;

  backgroundImageUrl?: string;
  viewport: NestSceneViewport;

  /** Scene-scoped editable manifest (see DEVIATION note above). */
  objects: EditableNestObject[];

  ambiencePresetId?: string;

  /** Child Focus Areas (M7C.6 — nesting up to MAX_FOCUS_DEPTH). */
  focusAreas?: NestFocusArea[];

  createdAt: string;
  updatedAt: string;
}

/**
 * A derived, serializable view of a document's navigation: the Main scene (with its
 * Focus Areas) plus the owned Detail Scenes. The storage of record is the
 * `EditableNestDocument` (its `focusAreas` + `detailScenes` fields); `buildSceneGraph`
 * derives this view for validation / navigation / debug.
 */
export interface NestSceneGraph {
  rootSceneId: string;
  mainScene: {
    id: string;
    kind: "main";
    focusAreas: NestFocusArea[];
  };
  detailScenes: NestDetailScene[];
}

// ── Visitor navigation state ───────────────────────────────────────────────────

export type NestTransitionState = "idle" | "entering" | "exiting";

export interface NestNavigationState {
  currentSceneId: string;
  previousSceneId?: string;
  transitionState: NestTransitionState;
}
