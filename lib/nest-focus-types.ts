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

export type NestSceneKind = "main" | "detail";

export type FocusTrigger = "tap" | "double_tap";
export const FOCUS_TRIGGERS: FocusTrigger[] = ["tap", "double_tap"];

export type FocusTransition = "zoom" | "push" | "fade_zoom";
export const FOCUS_TRANSITIONS: FocusTransition[] = ["zoom", "push", "fade_zoom"];

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

/** A navigable region linking a source scene to a target Detail Scene. */
export interface NestFocusArea {
  id: string;
  name: string;

  /** The scene this region lives in (the Main Nest scene id, = the document id). */
  sourceSceneId: string;
  /** The Detail Scene this region opens. */
  targetSceneId: string;

  bounds: NestFocusBounds;
  shape?: FocusShape;

  trigger: FocusTrigger;
  transition: FocusTransition;

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

  backgroundImageUrl?: string;
  viewport: NestSceneViewport;

  /** Scene-scoped editable manifest (see DEVIATION note above). */
  objects: EditableNestObject[];

  ambiencePresetId?: string;

  /** Reserved for nested navigation (deferred); must be empty/absent in M7C. */
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
