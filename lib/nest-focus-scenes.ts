// ── Nestudio V2 — pure scene-graph helpers (M7C) ────────────────────────────
//
// Framework-free, deterministic logic for the Main → Focus Area → Detail Scene
// navigation graph. Validation, CRUD on Focus Areas + Detail Scenes, linking, and
// navigation resolution — every mutation a pure function returning a NEW document.
// No React/DOM, no I/O, no Math.random, no Date.now (timestamps are injected).
//
// One navigation level only (Main → Detail → Main); a Detail Scene owns no further
// Focus Areas. The Main scene id IS the document id; Detail Scene ids are
// deterministic `detail-<n>`; Focus Area ids are deterministic `focus-<n>`.

import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { validateEditorObject } from "@/lib/nest-editor-types";
import type {
  EditableSceneType,
  EditorSceneContext,
  FocusShape,
  FocusTargetType,
  FocusTransition,
  FocusTrigger,
  NestDetailScene,
  NestFocusArea,
  NestFocusBounds,
  NestFocusZoomRegion,
  NestNavigationState,
  PixelRect,
  NestSceneGraph,
  NestSceneViewport,
  SceneBackgroundSource,
} from "@/lib/nest-focus-types";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import { shapeContainsPoint } from "@/lib/nest-hotspots";
import {
  FOCUS_TRANSITIONS,
  FOCUS_TRIGGERS,
  MAX_FOCUS_DEPTH,
  MIN_FOCUS_AREA_SIZE,
} from "@/lib/nest-focus-types";

/** Fixed deterministic timestamp for the pure core (the UI passes a real one). */
const FOCUS_T = "2026-06-30T00:00:00.000Z";

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, p = 4): number => +n.toFixed(p);
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const inUnit = (n: number): boolean => n >= -1e-6 && n <= 1 + 1e-6;

/** The Main scene id of a document (the document id). */
export function mainSceneId(doc: Pick<EditableNestDocument, "id">): string {
  return doc.id;
}

const focusAreasOf = (doc: EditableNestDocument): NestFocusArea[] => doc.focusAreas ?? [];
const detailScenesOf = (doc: EditableNestDocument): NestDetailScene[] => doc.detailScenes ?? [];

// ── Validation ───────────────────────────────────────────────────────────────

/** Validate Focus Area bounds: finite, inside the scene, at/above the minimum size. */
function validateBounds(b: NestFocusBounds | undefined, at: string): string[] {
  const errors: string[] = [];
  if (!b || typeof b !== "object") return [`${at}: missing bounds`];
  for (const k of ["x", "y", "width", "height"] as const) {
    if (!finite(b[k])) errors.push(`${at}: bounds.${k} is not finite`);
    else if (!inUnit(b[k])) errors.push(`${at}: bounds.${k}=${b[k]} is outside [0,1]`);
  }
  if (finite(b.width) && b.width < MIN_FOCUS_AREA_SIZE - 1e-6) errors.push(`${at}: width below minimum ${MIN_FOCUS_AREA_SIZE}`);
  if (finite(b.height) && b.height < MIN_FOCUS_AREA_SIZE - 1e-6) errors.push(`${at}: height below minimum ${MIN_FOCUS_AREA_SIZE}`);
  if (finite(b.x) && finite(b.width) && b.x + b.width > 1 + 1e-6) errors.push(`${at}: bounds leave the scene (x+width>1)`);
  if (finite(b.y) && finite(b.height) && b.y + b.height > 1 + 1e-6) errors.push(`${at}: bounds leave the scene (y+height>1)`);
  return errors;
}

// ── M7C.1 hybrid target type (inference + migration) ───────────────────────────

/**
 * The effective target type of a Focus Area. Explicit `targetType` wins; otherwise a
 * `zoomRegion` payload implies "zoom_region"; otherwise (the pre-M7C.1 default) a
 * detail-scene link implies "detail_surface".
 */
export function focusTargetTypeOf(fa: NestFocusArea): FocusTargetType {
  if (fa.targetType) return fa.targetType;
  if (fa.zoomRegion) return "zoom_region";
  return "detail_surface";
}

/** The Detail Surface id a detail_surface area opens (prefers detailSurfaceId). */
export function detailSurfaceIdOf(fa: NestFocusArea): string {
  return fa.detailSurfaceId || fa.targetSceneId || "";
}

/**
 * Normalize a Focus Area to explicit M7C.1 fields without changing behaviour: fills in
 * `targetType` and, for detail surfaces, mirrors `targetSceneId` → `detailSurfaceId`.
 * This is how pre-M7C.1 detail links migrate to `detail_surface`.
 */
export function migrateFocusArea(fa: NestFocusArea): NestFocusArea {
  const targetType = focusTargetTypeOf(fa);
  if (targetType === "detail_surface") {
    return { ...fa, targetType, detailSurfaceId: detailSurfaceIdOf(fa) };
  }
  return { ...fa, targetType };
}

/** Validate a crop's bounds: finite, within [0,1], positive, and inside the scene. */
export function validateCropBounds(b: NestFocusBounds | undefined, at: string): string[] {
  const errors: string[] = [];
  if (!b || typeof b !== "object") return [`${at}: missing zoomRegion.cropBounds`];
  for (const k of ["x", "y", "width", "height"] as const) {
    if (!finite(b[k])) errors.push(`${at}: cropBounds.${k} is not finite`);
    else if (!inUnit(b[k])) errors.push(`${at}: cropBounds.${k}=${b[k]} is outside [0,1]`);
  }
  if (finite(b.width) && b.width <= 0) errors.push(`${at}: cropBounds.width must be > 0`);
  if (finite(b.height) && b.height <= 0) errors.push(`${at}: cropBounds.height must be > 0`);
  if (finite(b.x) && finite(b.width) && b.x + b.width > 1 + 1e-6) errors.push(`${at}: cropBounds leave the scene (x+width>1)`);
  if (finite(b.y) && finite(b.height) && b.y + b.height > 1 + 1e-6) errors.push(`${at}: cropBounds leave the scene (y+height>1)`);
  return errors;
}

/**
 * Validate one Focus Area (target-type aware). When `knownSceneIds` is given, a
 * detail_surface's target must be a known Detail Scene and must NOT equal the source
 * (no self/circular link). A zoom_region requires `zoomRegion.cropBounds` within [0,1]
 * and needs no detail scene.
 */
export function validateFocusArea(fa: NestFocusArea, index = 0, knownSceneIds?: Set<string>): string[] {
  const errors: string[] = [];
  const at = `focusArea[${index}]${fa?.id ? ` (${fa.id})` : ""}`;
  if (!fa || typeof fa !== "object") return [`${at}: not an object`];
  if (!fa.id) errors.push(`${at}: missing id`);
  if (!fa.name) errors.push(`${at}: missing name`);
  if (!fa.sourceSceneId) errors.push(`${at}: missing sourceSceneId`);
  errors.push(...validateBounds(fa.bounds, at));
  if (fa.shape != null && fa.shape !== "rect" && fa.shape !== "ellipse") errors.push(`${at}: invalid shape "${fa.shape}"`);
  if (!FOCUS_TRIGGERS.includes(fa.trigger)) errors.push(`${at}: invalid trigger "${fa.trigger}"`);
  if (!FOCUS_TRANSITIONS.includes(fa.transition)) errors.push(`${at}: invalid transition "${fa.transition}"`);
  if (typeof fa.enabled !== "boolean") errors.push(`${at}: enabled must be a boolean`);
  if (fa.targetType != null && fa.targetType !== "zoom_region" && fa.targetType !== "detail_surface") {
    errors.push(`${at}: invalid targetType "${fa.targetType}"`);
  }

  const targetType = focusTargetTypeOf(fa);
  if (targetType === "zoom_region") {
    // M7C.6: a zoom/entrance area needs a valid fixed-ratio focus rectangle — `focusBounds`
    // (V1) OR the legacy `zoomRegion.cropBounds`. (Editor-authored areas carry only
    // focusBounds; the fixtures carry both.)
    if (fa.focusBounds) errors.push(...validateBounds(fa.focusBounds, `${at}: focusBounds`));
    if (fa.zoomRegion) errors.push(...validateCropBounds(fa.zoomRegion.cropBounds, at));
    if (!fa.focusBounds && !fa.zoomRegion) errors.push(`${at}: zoom_region requires a focus rectangle (focusBounds) or zoomRegion.cropBounds`);
    // Child object/hotspot coordinates are LOCAL to the crop — validate in [0,1].
    (fa.zoomRegion?.childObjects ?? []).forEach((o, i) => {
      for (const k of ["x", "y", "width", "height"] as const) {
        if (!finite(o[k]) || !inUnit(o[k])) errors.push(`${at}: childObjects[${i}].${k} must be region-local (0..1)`);
      }
    });
  } else {
    const detailId = detailSurfaceIdOf(fa);
    if (!detailId) errors.push(`${at}: detail_surface requires detailSurfaceId (or targetSceneId)`);
    if (fa.sourceSceneId && detailId && fa.sourceSceneId === detailId) {
      errors.push(`${at}: circular link — target equals source`);
    }
    if (knownSceneIds && detailId && !knownSceneIds.has(detailId)) {
      errors.push(`${at}: targetSceneId "${detailId}" does not exist`);
    }
  }
  return errors;
}

/** Validate one Detail Scene (structure + scene-scoped objects + one-level rule). */
export function validateDetailScene(scene: NestDetailScene, index = 0): string[] {
  const errors: string[] = [];
  const at = `detailScene[${index}]${scene?.id ? ` (${scene.id})` : ""}`;
  if (!scene || typeof scene !== "object") return [`${at}: not an object`];
  if (!scene.id) errors.push(`${at}: missing id`);
  if (!scene.name) errors.push(`${at}: missing name`);
  if (scene.kind !== "detail") errors.push(`${at}: kind must be "detail"`);
  if (!scene.parentSceneId) errors.push(`${at}: missing parentSceneId`);
  // `parentFocusAreaId` may be empty for a detached/orphaned scene (a soft warning at the
  // graph level, not a hard error); when set, the back-reference is checked in
  // `validateSceneGraph`.
  if (!scene.viewport || !scene.viewport.aspectRatio) errors.push(`${at}: missing viewport.aspectRatio`);
  if (!Array.isArray(scene.objects)) {
    errors.push(`${at}: objects must be an array`);
  } else {
    const seen = new Set<string>();
    scene.objects.forEach((o, i) => {
      errors.push(...validateEditorObject(o, i).map((e) => `${at}: ${e}`));
      if (o?.instanceId) {
        if (seen.has(o.instanceId)) errors.push(`${at}: duplicate instanceId "${o.instanceId}"`);
        seen.add(o.instanceId);
      }
    });
  }
  // One navigation level: a Detail Scene owns no further Focus Areas in M7C.
  if (scene.focusAreas && scene.focusAreas.length > 0) {
    errors.push(`${at}: nested focusAreas are not supported (one navigation level)`);
  }
  return errors;
}

export interface SceneGraphValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a document's whole scene graph: unique ids, valid Focus Areas + Detail
 * Scenes, matched cross-references (each FA targets an existing scene; each scene's
 * parent FA exists and points back), no circular links. Orphaned Detail Scenes (no FA
 * targets them) are a soft warning. Pure + deterministic.
 */
export function validateSceneGraph(doc: EditableNestDocument): SceneGraphValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const main = mainSceneId(doc);
  const fas = focusAreasOf(doc);
  const scenes = detailScenesOf(doc);

  // Unique scene ids (detail ids unique + distinct from the main id).
  const sceneIds = new Set<string>();
  for (const s of scenes) {
    if (s.id === main) errors.push(`detail scene "${s.id}" collides with the main scene id`);
    if (sceneIds.has(s.id)) errors.push(`duplicate detail scene id "${s.id}"`);
    sceneIds.add(s.id);
  }

  // Focus Areas: unique ids, valid, target an existing scene.
  const faIds = new Set<string>();
  fas.forEach((fa, i) => {
    errors.push(...validateFocusArea(fa, i, sceneIds));
    if (fa?.id) {
      if (faIds.has(fa.id)) errors.push(`duplicate focusArea id "${fa.id}"`);
      faIds.add(fa.id);
    }
    if (fa?.sourceSceneId && fa.sourceSceneId !== main) {
      errors.push(`focusArea[${i}] (${fa.id}): sourceSceneId must be the main scene "${main}"`);
    }
  });

  // Detail Scenes: valid, parent references match, reachable.
  const targeted = new Set(fas.map((f) => f.targetSceneId));
  scenes.forEach((s, i) => {
    errors.push(...validateDetailScene(s, i));
    if (s.parentSceneId && s.parentSceneId !== main) {
      errors.push(`detailScene[${i}] (${s.id}): parentSceneId must be the main scene "${main}"`);
    }
    const parentFa = fas.find((f) => f.id === s.parentFocusAreaId);
    if (s.parentFocusAreaId && !parentFa) {
      errors.push(`detailScene[${i}] (${s.id}): parentFocusAreaId "${s.parentFocusAreaId}" does not exist`);
    } else if (parentFa && parentFa.targetSceneId !== s.id) {
      errors.push(`detailScene[${i}] (${s.id}): parent focus area does not point back to it`);
    }
    if (!targeted.has(s.id)) warnings.push(`detail scene "${s.id}" is orphaned (no focus area targets it)`);
  });

  return { ok: errors.length === 0, errors, warnings };
}

// ── Derived view ─────────────────────────────────────────────────────────────

/** Derive the serializable NestSceneGraph view from a document. */
export function buildSceneGraph(doc: EditableNestDocument): NestSceneGraph {
  return {
    rootSceneId: mainSceneId(doc),
    mainScene: { id: mainSceneId(doc), kind: "main", focusAreas: focusAreasOf(doc) },
    detailScenes: detailScenesOf(doc),
  };
}

// ── Geometry ─────────────────────────────────────────────────────────────────

/** Clamp Focus Area bounds inside the scene and to the minimum size. */
export function clampFocusBounds(b: NestFocusBounds): NestFocusBounds {
  const width = clamp(b.width, MIN_FOCUS_AREA_SIZE, 1);
  const height = clamp(b.height, MIN_FOCUS_AREA_SIZE, 1);
  const x = clamp(b.x, 0, 1 - width);
  const y = clamp(b.y, 0, 1 - height);
  return { x: round(x), y: round(y), width: round(width), height: round(height) };
}

/** Whether a point lies inside a Focus Area (rect or ellipse), respecting its shape. */
export function focusAreaContainsPoint(fa: NestFocusArea, x: number, y: number): boolean {
  const b = fa.bounds;
  if (x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height) return false;
  if ((fa.shape ?? "rect") === "rect") return true;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const rx = b.width / 2;
  const ry = b.height / 2;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** The topmost ENABLED Focus Area containing a point (last in array = on top). */
export function findFocusAreaAtPoint(focusAreas: NestFocusArea[], x: number, y: number): NestFocusArea | undefined {
  for (let i = focusAreas.length - 1; i >= 0; i--) {
    const fa = focusAreas[i];
    if (fa.enabled && !fa.locked && focusAreaContainsPoint(fa, x, y)) return fa;
  }
  return undefined;
}

// ── Navigation resolution (deterministic priority) ───────────────────────────

export type FocusNavResolution =
  | { kind: "hotspot" }
  | { kind: "focus"; focusArea: NestFocusArea }
  | { kind: "none" };

/**
 * Resolve a Main-scene tap with the documented priority:
 *   object hotspot  →  focus area  →  (whole-object fallback / empty).
 * `hotspotHit` is whether the tap landed on an object hotspot (the caller knows the
 * hotspot geometry / the stage handled it). When true, the hotspot wins and navigation
 * does not fire. Otherwise an enabled Focus Area under the point fires. Pure.
 */
export function resolveFocusNavigation(opts: {
  point: { x: number; y: number };
  focusAreas: NestFocusArea[];
  hotspotHit: boolean;
}): FocusNavResolution {
  if (opts.hotspotHit) return { kind: "hotspot" };
  const fa = findFocusAreaAtPoint(opts.focusAreas, opts.point.x, opts.point.y);
  return fa ? { kind: "focus", focusArea: fa } : { kind: "none" };
}

// ── Deterministic ids ─────────────────────────────────────────────────────────

function nextId(prefix: string, taken: Set<string>): string {
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** All focus-area ids in the document (main only in M7C). */
function allFocusAreaIds(doc: EditableNestDocument): Set<string> {
  return new Set(focusAreasOf(doc).map((f) => f.id));
}
function allDetailSceneIds(doc: EditableNestDocument): Set<string> {
  return new Set(detailScenesOf(doc).map((s) => s.id));
}

// ── Focus Area CRUD (pure) ─────────────────────────────────────────────────────

export interface AddFocusAreaSpec {
  name?: string;
  bounds: NestFocusBounds;
  shape?: FocusShape;
  trigger?: FocusTrigger;
  transition?: FocusTransition;
  previewHint?: string;
  ariaLabel?: string;
}

/** Add a Focus Area to the Main scene at clamped bounds with a deterministic id. */
export function addFocusArea(doc: EditableNestDocument, spec: AddFocusAreaSpec): { doc: EditableNestDocument; id: string } {
  const id = nextId("focus", allFocusAreaIds(doc));
  const fa: NestFocusArea = {
    id,
    name: spec.name ?? "Focus area",
    sourceSceneId: mainSceneId(doc),
    targetSceneId: "", // linked when a Detail Scene is created/linked
    bounds: clampFocusBounds(spec.bounds),
    shape: spec.shape ?? "rect",
    trigger: spec.trigger ?? "tap",
    transition: spec.transition ?? "fade_zoom",
    enabled: true,
    previewHint: spec.previewHint,
    ariaLabel: spec.ariaLabel,
  };
  return { doc: { ...doc, focusAreas: [...focusAreasOf(doc), fa] }, id };
}

/** Patch a Focus Area (geometry is re-clamped). Locked areas reject geometry edits. */
export function updateFocusArea(doc: EditableNestDocument, id: string, patch: Partial<NestFocusArea>): EditableNestDocument {
  const fas = focusAreasOf(doc);
  const fa = fas.find((f) => f.id === id);
  if (!fa) return doc;
  const merged: NestFocusArea = { ...fa, ...patch, id: fa.id, sourceSceneId: fa.sourceSceneId };
  if (patch.bounds) merged.bounds = fa.locked ? fa.bounds : clampFocusBounds(patch.bounds);
  return { ...doc, focusAreas: fas.map((f) => (f.id === id ? merged : f)) };
}

/**
 * Remove a Focus Area. By default the now-unreachable Detail Scene it pointed to is
 * also removed (safe — a scene with no entry is dead data). Pass
 * `{ keepScene: true }` to keep it as an orphan (reported by validation).
 */
export function removeFocusArea(doc: EditableNestDocument, id: string, opts: { keepScene?: boolean } = {}): EditableNestDocument {
  const fas = focusAreasOf(doc);
  const fa = fas.find((f) => f.id === id);
  if (!fa) return doc;
  let scenes = detailScenesOf(doc);
  if (!opts.keepScene && fa.targetSceneId) {
    scenes = scenes.filter((s) => s.id !== fa.targetSceneId);
  } else if (opts.keepScene && fa.targetSceneId) {
    scenes = scenes.map((s) => (s.id === fa.targetSceneId ? { ...s, parentFocusAreaId: "" } : s));
  }
  return { ...doc, focusAreas: fas.filter((f) => f.id !== id), detailScenes: scenes };
}

/** Link a Focus Area to an existing Detail Scene (keeps both references consistent). */
export function linkFocusAreaToScene(doc: EditableNestDocument, focusAreaId: string, sceneId: string): EditableNestDocument {
  const fas = focusAreasOf(doc);
  const scenes = detailScenesOf(doc);
  if (!fas.some((f) => f.id === focusAreaId) || !scenes.some((s) => s.id === sceneId)) return doc;
  return {
    ...doc,
    focusAreas: fas.map((f) => (f.id === focusAreaId ? { ...f, targetSceneId: sceneId } : f)),
    detailScenes: scenes.map((s) => (s.id === sceneId ? { ...s, parentFocusAreaId: focusAreaId } : s)),
  };
}

/** Unlink a Focus Area from its Detail Scene (the scene becomes an orphan). */
export function unlinkFocusArea(doc: EditableNestDocument, focusAreaId: string): EditableNestDocument {
  const fas = focusAreasOf(doc);
  const fa = fas.find((f) => f.id === focusAreaId);
  if (!fa) return doc;
  const scenes = detailScenesOf(doc).map((s) => (s.id === fa.targetSceneId ? { ...s, parentFocusAreaId: "" } : s));
  return { ...doc, focusAreas: fas.map((f) => (f.id === focusAreaId ? { ...f, targetSceneId: "" } : f)), detailScenes: scenes };
}

// ── Detail Scene CRUD (pure) ───────────────────────────────────────────────────

export interface CreateDetailSceneSpec {
  name?: string;
  /** When given, the new scene is linked to this Focus Area (both refs set). */
  focusAreaId?: string;
  backgroundImageUrl?: string;
  viewport?: Partial<NestSceneViewport>;
  objects?: EditableNestObject[];
  ambiencePresetId?: string;
  now?: string;
}

/** Create a Detail Scene with a deterministic id, optionally linked to a Focus Area. */
export function createDetailScene(doc: EditableNestDocument, spec: CreateDetailSceneSpec = {}): { doc: EditableNestDocument; scene: NestDetailScene } {
  const id = nextId("detail", allDetailSceneIds(doc));
  const now = spec.now ?? FOCUS_T;
  const scene: NestDetailScene = {
    id,
    name: spec.name ?? "Detail scene",
    kind: "detail",
    parentSceneId: mainSceneId(doc),
    parentFocusAreaId: spec.focusAreaId ?? "",
    backgroundImageUrl: spec.backgroundImageUrl ?? doc.backgroundImageUrl,
    viewport: { aspectRatio: spec.viewport?.aspectRatio ?? doc.aspectRatio, safeBounds: spec.viewport?.safeBounds, contentScale: spec.viewport?.contentScale },
    objects: spec.objects ?? [],
    ambiencePresetId: spec.ambiencePresetId ?? doc.ambiencePresetId,
    createdAt: now,
    updatedAt: now,
  };
  let next: EditableNestDocument = { ...doc, detailScenes: [...detailScenesOf(doc), scene] };
  if (spec.focusAreaId) next = linkFocusAreaToScene(next, spec.focusAreaId, id);
  return { doc: next, scene };
}

/** Duplicate a Detail Scene (fresh id, unlinked — no Focus Area targets the copy yet). */
export function duplicateDetailScene(doc: EditableNestDocument, sceneId: string, now: string = FOCUS_T): { doc: EditableNestDocument; id?: string } {
  const scene = detailScenesOf(doc).find((s) => s.id === sceneId);
  if (!scene) return { doc };
  const id = nextId("detail", allDetailSceneIds(doc));
  const copy: NestDetailScene = { ...scene, id, name: `${scene.name} copy`, parentFocusAreaId: "", createdAt: now, updatedAt: now };
  return { doc: { ...doc, detailScenes: [...detailScenesOf(doc), copy] }, id };
}

/** Remove a Detail Scene and unlink any Focus Areas that targeted it (no dangling links). */
export function removeDetailScene(doc: EditableNestDocument, sceneId: string): EditableNestDocument {
  const fas = focusAreasOf(doc).map((f) => (f.targetSceneId === sceneId ? { ...f, targetSceneId: "" } : f));
  return { ...doc, focusAreas: fas, detailScenes: detailScenesOf(doc).filter((s) => s.id !== sceneId) };
}

/** Replace a Detail Scene's scene-scoped objects (the detail editor commits through this). */
export function setDetailSceneObjects(doc: EditableNestDocument, sceneId: string, objects: EditableNestObject[], now: string = FOCUS_T): EditableNestDocument {
  return {
    ...doc,
    detailScenes: detailScenesOf(doc).map((s) => (s.id === sceneId ? { ...s, objects, updatedAt: now } : s)),
  };
}

// ── Lookups ────────────────────────────────────────────────────────────────────

export function getDetailScene(doc: EditableNestDocument, sceneId: string): NestDetailScene | undefined {
  return detailScenesOf(doc).find((s) => s.id === sceneId);
}

export function getFocusArea(doc: EditableNestDocument, focusAreaId: string): NestFocusArea | undefined {
  return focusAreasOf(doc).find((f) => f.id === focusAreaId);
}

/** The parent scene id of a scene (the main id for a detail scene; undefined for main). */
export function getParentScene(doc: EditableNestDocument, sceneId: string): string | undefined {
  if (sceneId === mainSceneId(doc)) return undefined;
  return getDetailScene(doc, sceneId)?.parentSceneId;
}

/** Detail scenes that no Focus Area targets (dead data). */
export function orphanDetailScenes(doc: EditableNestDocument): NestDetailScene[] {
  const targeted = new Set(focusAreasOf(doc).map((f) => f.targetSceneId));
  return detailScenesOf(doc).filter((s) => !targeted.has(s.id));
}

// ── Pure visitor-navigation transitions (drives the navigator; unit-testable) ──

/** Navigation is allowed to start only when idle (locked during a transition). */
export function canNavigate(state: NestNavigationState): boolean {
  return state.transitionState === "idle";
}

/** Begin entering a Detail Scene: keep the current scene visible while it animates out. */
export function beginEnter(state: NestNavigationState): NestNavigationState {
  return { currentSceneId: state.currentSceneId, previousSceneId: state.currentSceneId, transitionState: "entering" };
}

/** Begin exiting back to the parent: keep the current scene while it animates out. */
export function beginExit(state: NestNavigationState): NestNavigationState {
  return { currentSceneId: state.currentSceneId, previousSceneId: state.currentSceneId, transitionState: "exiting" };
}

/** Settle on a scene (transition complete). */
export function settleScene(sceneId: string): NestNavigationState {
  return { currentSceneId: sceneId, transitionState: "idle" };
}

/** Transition duration: a short fade under reduced motion, a fuller zoom otherwise. */
export function focusTransitionDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 180 : 420;
}

// ── M7C.1 — Zoom Region geometry (Phase 4) ─────────────────────────────────────

export interface ZoomTransform {
  /** Uniform scale (preserves aspect ratio). */
  scale: number;
  /** Translate as a percentage of the scene's own size, applied AFTER the scale. */
  translateXPct: number;
  translateYPct: number;
  /** CSS transform-origin string (the crop centre). */
  transformOrigin: string;
}

/** The neutral transform = the Main scene at rest (entry start / exit end). */
export const IDENTITY_ZOOM_TRANSFORM: ZoomTransform = {
  scale: 1,
  translateXPct: 0,
  translateYPct: 0,
  transformOrigin: "50% 50%",
};

/**
 * The CSS transform that makes a normalized `crop` fill the scene viewport while
 * preserving aspect ratio (Phase 4): a UNIFORM scale = min(1/cropW, 1/cropH) about the
 * crop centre, then a translate that recentres the crop in the viewport. `maxScale`
 * caps the enlargement (guards against over-softening tiny crops). Pure + deterministic.
 */
export function zoomTransform(crop: NestFocusBounds, maxScale?: number): ZoomTransform {
  const denom = Math.max(crop.width, crop.height);
  let scale = denom > 0 ? 1 / denom : 1;
  if (maxScale && maxScale > 0) scale = Math.min(scale, maxScale);
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return {
    scale: round(scale),
    // After scaling about the crop centre, move that centre to the viewport centre.
    translateXPct: round((0.5 - cx) * 100, 3),
    translateYPct: round((0.5 - cy) * 100, 3),
    transformOrigin: `${round(cx * 100, 3)}% ${round(cy * 100, 3)}%`,
  };
}

/** A ready-to-apply CSS `transform` string for a ZoomTransform. */
export function zoomTransformCss(t: ZoomTransform): string {
  return `translate(${t.translateXPct}%, ${t.translateYPct}%) scale(${t.scale})`;
}

// ── M7C.3 — Full-screen COVER transform (Phase 1) ──────────────────────────────
//
// The visitor focused view must FILL the usable viewport (cover), not fit inside it
// (the old contain `zoomTransform` left empty wall). The scene element is rendered at
// `sceneWidth × sceneHeight` (its natural 3:4) at the top-left of the focused viewport;
// this returns a px transform (origin 0 0) that scales the crop to COVER the viewport and
// centres the crop's centre in the viewport. Deterministic; clamps nothing — it never
// alters the saved crop, it only maps it to the screen.

export interface FocusViewportTransformInput {
  sceneWidth: number;
  sceneHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  cropBounds: NestFocusBounds;
}

export interface FocusViewportTransform {
  scale: number;
  translateX: number;
  translateY: number;
  cropPixelBounds: PixelRect;
}

export function focusViewportTransform(input: FocusViewportTransformInput): FocusViewportTransform {
  const { sceneWidth, sceneHeight, viewportWidth, viewportHeight, cropBounds } = input;
  const cropX = cropBounds.x * sceneWidth;
  const cropY = cropBounds.y * sceneHeight;
  const cropWidth = cropBounds.width * sceneWidth;
  const cropHeight = cropBounds.height * sceneHeight;
  // COVER: the larger ratio wins so the crop fully covers the viewport (overflow clipped).
  const scale = cropWidth > 0 && cropHeight > 0 ? Math.max(viewportWidth / cropWidth, viewportHeight / cropHeight) : 1;
  const cropCenterX = cropX + cropWidth / 2;
  const cropCenterY = cropY + cropHeight / 2;
  // Map the crop centre to the viewport centre (transform-origin 0 0).
  const translateX = viewportWidth / 2 - cropCenterX * scale;
  const translateY = viewportHeight / 2 - cropCenterY * scale;
  return {
    scale: round(scale, 5),
    translateX: round(translateX, 3),
    translateY: round(translateY, 3),
    cropPixelBounds: { x: round(cropX, 3), y: round(cropY, 3), width: round(cropWidth, 3), height: round(cropHeight, 3) },
  };
}

/** The CSS `transform` string for a FocusViewportTransform (transform-origin: 0 0). */
export function focusViewportTransformCss(t: FocusViewportTransform): string {
  return `translate(${t.translateX}px, ${t.translateY}px) scale(${t.scale})`;
}

/**
 * Map a scene-normalized point (0..1) to focused-viewport pixels under a transform — used
 * to verify a hotspot lands where expected after the zoom (Phase 7).
 */
export function mapScenePointThroughFocus(
  point: { x: number; y: number },
  t: FocusViewportTransform,
  scene: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: round(point.x * scene.width * t.scale + t.translateX, 3),
    y: round(point.y * scene.height * t.scale + t.translateY, 3),
  };
}

// ── M7C.3 — Suggested vs creator-authored crop (Phase 5) ───────────────────────

/** The crop source of a zoom area (absent ⇒ "suggested" for back-compat). */
export function cropSourceOf(fa: NestFocusArea): "suggested" | "creator_authored" {
  return fa.zoomRegion?.cropSource ?? "suggested";
}

/** Whether the creator has manually authored this crop (so the suggestion is locked out). */
export function isCropAuthored(fa: NestFocusArea): boolean {
  return cropSourceOf(fa) === "creator_authored";
}

/**
 * Whether the auto-suggested crop may be (re)applied automatically. NEVER once the crop is
 * creator-authored — moving/resizing assets, re-creation, etc. must not silently overwrite
 * it; the creator must explicitly choose "Use suggested crop". Pure.
 */
export function shouldAutoApplySuggestedCrop(fa: NestFocusArea): boolean {
  return !isCropAuthored(fa);
}

/** Which authoring overlay is active (mutually exclusive — the crop overlay replaces the
 *  trigger overlay so taps never fall through to asset selection). */
export function focusOverlayMode(isZoom: boolean, target: "trigger" | "crop"): "trigger" | "crop" {
  return isZoom && target === "crop" ? "crop" : "trigger";
}

// ── M7C.1 — Zoom Region child objects (Phase 9) ────────────────────────────────

/** The child objects + hotspots a zoom region reveals (empty for non-zoom areas). */
export function zoomRegionChildren(fa: NestFocusArea): {
  objects: EditableNestObject[];
  hotspots: NestAssetHotspot[];
} {
  const z: NestFocusZoomRegion | undefined = fa.zoomRegion;
  return { objects: z?.childObjects ?? [], hotspots: z?.childHotspots ?? [] };
}

/**
 * Child objects/hotspots are inactive in the Main view and active only once the zoom has
 * settled (not while transitioning). Pure predicate driving the renderer (Phase 9 / 13).
 */
export function zoomChildrenActive(opts: { inZoomScene: boolean; transitioning: boolean }): boolean {
  return opts.inZoomScene && !opts.transitioning;
}

/** Map a crop-LOCAL rect (0..1 inside the crop) to scene-normalized coordinates. */
export function cropLocalRectToScene(local: NestFocusBounds, crop: NestFocusBounds): NestFocusBounds {
  return {
    x: round(crop.x + local.x * crop.width),
    y: round(crop.y + local.y * crop.height),
    width: round(local.width * crop.width),
    height: round(local.height * crop.height),
  };
}

// ── M7C.1 — Zoom Region interaction priority (Phase 13) ────────────────────────

export type ZoomNavResolution =
  | { kind: "child_hotspot"; hotspot: NestAssetHotspot }
  | { kind: "child_object"; object: EditableNestObject }
  | { kind: "parent_hotspot"; hotspot: NestAssetHotspot }
  | { kind: "background" };

/**
 * Resolve a tap inside a settled Zoom Region with the documented priority (M7C.2):
 *   child hotspot → child object → focused parent-object hotspot → zoom-region background.
 * `point` is crop-LOCAL (0..1 inside the crop). Child objects are only considered when
 * focused (the caller passes the settled children). `parentHotspots` (optional) are the
 * focused parent object's own hotspots that stay live inside the zoom (e.g. the TV
 * screen → video). Deterministic; no double firing. The parent **Focus Area never fires
 * again** while focused (it is simply not consulted here).
 */
export function resolveZoomInteraction(opts: {
  point: { x: number; y: number };
  childHotspots: NestAssetHotspot[];
  childObjects: EditableNestObject[];
  parentHotspots?: NestAssetHotspot[];
}): ZoomNavResolution {
  for (let i = opts.childHotspots.length - 1; i >= 0; i--) {
    const h = opts.childHotspots[i];
    if (h.enabled && shapeContainsPoint(h.shape, opts.point.x, opts.point.y)) {
      return { kind: "child_hotspot", hotspot: h };
    }
  }
  for (let i = opts.childObjects.length - 1; i >= 0; i--) {
    const o = opts.childObjects[i];
    if (o.hidden || o.width <= 0 || o.height <= 0) continue;
    if (opts.point.x >= o.x && opts.point.x <= o.x + o.width && opts.point.y >= o.y && opts.point.y <= o.y + o.height) {
      return { kind: "child_object", object: o };
    }
  }
  for (let i = (opts.parentHotspots ?? []).length - 1; i >= 0; i--) {
    const h = opts.parentHotspots![i];
    if (h.enabled && shapeContainsPoint(h.shape, opts.point.x, opts.point.y)) {
      return { kind: "parent_hotspot", hotspot: h };
    }
  }
  return { kind: "background" };
}

// ── M7C.2 — Trigger vs crop accessors (Phase 3) ────────────────────────────────

/** V1 (M7C.4): the single focus rectangle = tap target AND zoom destination. The former
 *  trigger/crop accessors now both resolve to `focusBounds` (migrated from legacy). */
export function triggerBoundsOf(fa: NestFocusArea): NestFocusBounds {
  return focusBoundsOf(fa);
}
export function cropBoundsOf(fa: NestFocusArea): NestFocusBounds {
  return focusBoundsOf(fa);
}

const boundsArea = (b: NestFocusBounds): number => Math.max(0, b.width) * Math.max(0, b.height);

/** Whether a rect fully contains another (used to check a crop holds its subject). */
export function rectContains(outer: NestFocusBounds, inner: NestFocusBounds): boolean {
  return (
    inner.x >= outer.x - 1e-6 &&
    inner.y >= outer.y - 1e-6 &&
    inner.x + inner.width <= outer.x + outer.width + 1e-6 &&
    inner.y + inner.height <= outer.y + outer.height + 1e-6
  );
}

// ── M7C.2 — Focus-first Main-scene pointer resolution (Phase 1) ────────────────

export type MainScenePointerResolution =
  | { type: "focus"; focusAreaId: string }
  | { type: "hotspot"; objectId: string; hotspotId: string }
  | { type: "object"; objectId: string }
  | { type: "none" };

/**
 * The M7C.2 **focus-first** Main-scene tap resolver:
 *   enabled Focus Area  →  object hotspot  →  whole-object fallback  →  none.
 * A Focus Area OWNS the first tap inside its trigger region — the parent object's
 * hotspot/content does NOT fire from Main view. Overlapping Focus Areas resolve
 * deterministically: **smallest trigger region first**, then explicit `priority` (higher
 * wins), then stable id. Pure; no Math.random.
 *
 * (Distinct from the legacy `resolveFocusNavigation`, which models the old double-tap
 * path where the stage had already claimed a hotspot — retained for back-compat.)
 */
export function resolveMainScenePointerAction(opts: {
  point: { x: number; y: number };
  focusAreas: NestFocusArea[];
  objects: EditableNestObject[];
}): MainScenePointerResolution {
  const { x, y } = opts.point;

  // 1. Focus Areas own the tap (enabled, unlocked; the V1 rect = `focusBounds`).
  const inRect = (b: NestFocusBounds) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  const claiming = opts.focusAreas.filter((f) => f.enabled && !f.locked && inRect(focusBoundsOf(f)));
  if (claiming.length > 0) {
    claiming.sort(
      (a, b) =>
        boundsArea(focusBoundsOf(a)) - boundsArea(focusBoundsOf(b)) ||
        (b.priority ?? 0) - (a.priority ?? 0) ||
        a.id.localeCompare(b.id),
    );
    return { type: "focus", focusAreaId: claiming[0].id };
  }

  // 2. Object hotspot (topmost object first), only where no Focus Area claimed.
  const ordered = [...opts.objects]
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (b.o.zIndex ?? 0) - (a.o.zIndex ?? 0) || b.i - a.i);
  for (const { o } of ordered) {
    if (o.hidden || o.width <= 0 || o.height <= 0) continue;
    const lx = (x - o.x) / o.width;
    const ly = (y - o.y) / o.height;
    if (lx < 0 || lx > 1 || ly < 0 || ly > 1) continue;
    for (let h = (o.hotspots ?? []).length - 1; h >= 0; h--) {
      const hot = o.hotspots![h];
      if (hot.enabled && shapeContainsPoint(hot.shape, lx, ly)) {
        return { type: "hotspot", objectId: o.instanceId, hotspotId: hot.id };
      }
    }
  }

  // 3. Whole-object fallback.
  for (const { o } of ordered) {
    if (o.hidden || o.width <= 0 || o.height <= 0) continue;
    if (x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height) {
      return { type: "object", objectId: o.instanceId };
    }
  }

  return { type: "none" };
}

// ── M7C.2 — Interaction state machine (Phase 10) ───────────────────────────────

export type HybridFocusInteractionState = "main_idle" | "entering_focus" | "focused_idle" | "exiting_focus";

export function canEnterFocus(s: HybridFocusInteractionState): boolean {
  return s === "main_idle";
}
export function canInteractInFocus(s: HybridFocusInteractionState): boolean {
  return s === "focused_idle";
}
export function canExitFocus(s: HybridFocusInteractionState): boolean {
  return s === "focused_idle";
}
/** Begin entering focus (only from a settled Main view) — idempotent under rapid taps. */
export function focusEntryBegin(s: HybridFocusInteractionState): HybridFocusInteractionState {
  return canEnterFocus(s) ? "entering_focus" : s;
}
export function focusEntrySettle(s: HybridFocusInteractionState): HybridFocusInteractionState {
  return s === "entering_focus" ? "focused_idle" : s;
}
export function focusExitBegin(s: HybridFocusInteractionState): HybridFocusInteractionState {
  return canExitFocus(s) ? "exiting_focus" : s;
}
export function focusExitSettle(s: HybridFocusInteractionState): HybridFocusInteractionState {
  return s === "exiting_focus" ? "main_idle" : s;
}

// ── M7C.2 — Focus discovery hint policy (Phase 8) ──────────────────────────────

export interface DiscoveryHint {
  /** The single Focus Area to emphasise (undefined = show no hint). */
  focusAreaId?: string;
  /** Whether the hint may animate (false under reduced motion). */
  animated: boolean;
  /** Short transient label (e.g. "Explore media setup"). */
  label?: string;
}

/**
 * Pick the one Focus Area to gently hint on a first visit (Phase 8): the primary
 * (first enabled) area gets a subtle, single emphasis. After the visitor has focused once
 * (`hasFocusedOnce`), no hint is emphasised — later areas rely on press/hover feedback.
 * Under reduced motion the hint is static (`animated:false`). Pure + deterministic.
 */
export function selectDiscoveryHint(
  focusAreas: NestFocusArea[],
  opts: { hasFocusedOnce: boolean; reducedMotion: boolean },
): DiscoveryHint {
  if (opts.hasFocusedOnce) return { animated: false };
  const primary = focusAreas.find((f) => f.enabled && !f.locked);
  if (!primary) return { animated: false };
  return { focusAreaId: primary.id, animated: !opts.reducedMotion, label: primary.previewHint ?? "Explore" };
}

// ── M7C.2 — Recommended crop helper (Phase 13) ─────────────────────────────────

export type FocusCropCategory = "frame" | "media" | "bookshelf" | "generic";

/** Category-aware padding (fraction of the subject size added on EACH side). */
const CROP_PADDING: Record<FocusCropCategory, { x: number; y: number }> = {
  frame: { x: 0.45, y: 0.55 }, // small balanced wall context, frame stays the hero
  media: { x: 0.32, y: 0.5 }, // moderate — include the console below
  bookshelf: { x: 0.45, y: 0.16 }, // mostly vertical shelf context
  generic: { x: 0.35, y: 0.4 },
};

/**
 * Deterministically recommend a crop for an asset-backed Focus Area from the subject's
 * visual bounds + a category-aware padding, clamped to the scene. Pure — no computer
 * vision; uses calibration/visual bounds only. The creator can override; callers must
 * never silently overwrite an authored crop (offer "Use recommended crop").
 */
export function recommendCrop(visualBounds: NestFocusBounds, category: FocusCropCategory = "generic"): NestFocusBounds {
  const pad = CROP_PADDING[category];
  let width = clamp(visualBounds.width * (1 + pad.x * 2), MIN_FOCUS_AREA_SIZE, 1);
  let height = clamp(visualBounds.height * (1 + pad.y * 2), MIN_FOCUS_AREA_SIZE, 1);
  let x = visualBounds.x - visualBounds.width * pad.x;
  let y = visualBounds.y - visualBounds.height * pad.y;
  // Keep within the scene; if padding overflowed an edge, shrink the far side.
  x = clamp(x, 0, 1 - width);
  y = clamp(y, 0, 1 - height);
  if (x + width > 1) width = 1 - x;
  if (y + height > 1) height = 1 - y;
  // Guarantee the subject still fits inside the crop.
  if (visualBounds.x < x) x = clamp(visualBounds.x, 0, 1 - width);
  if (visualBounds.y < y) y = clamp(visualBounds.y, 0, 1 - height);
  if (visualBounds.x + visualBounds.width > x + width) width = clamp(visualBounds.x + visualBounds.width - x, MIN_FOCUS_AREA_SIZE, 1 - x);
  if (visualBounds.y + visualBounds.height > y + height) height = clamp(visualBounds.y + visualBounds.height - y, MIN_FOCUS_AREA_SIZE, 1 - y);
  return { x: round(x), y: round(y), width: round(width), height: round(height) };
}

// ── M7C.4 — V1 fixed-ratio Focus Area (single rectangle, in-place cinematic zoom) ──
//
// One creator-authored `focusBounds` is BOTH the Main-Nest tap target and the exact
// region that fills the Nest viewport on focus. Because scene x is normalized to width
// and y to height of the SAME 3:4 box, a rectangle whose on-screen aspect matches the
// Nest is a NORMALIZED SQUARE (w == h) — that is the V1 ratio constraint.

/** The normalized width/height ratio a focus rect must hold to fill the viewport (=1). */
export const FOCUS_RECT_NORMALIZED_RATIO = 1;

/** Clamp + round a rect inside the scene at/above the minimum size (square preserved). */
function clampSquare(x: number, y: number, s: number): NestFocusBounds {
  const side = clamp(s, MIN_FOCUS_AREA_SIZE, 1);
  const cx = clamp(x, 0, 1 - side);
  const cy = clamp(y, 0, 1 - side);
  return { x: round(cx), y: round(cy), width: round(side), height: round(side) };
}

/**
 * Coerce any rect to the locked focus ratio (a normalized square), preserving its centre
 * where possible, clamped inside the scene at the minimum size. Deterministic.
 */
export function fitRectToAspectRatio(rect: NestFocusBounds): NestFocusBounds {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  // Average the two dimensions so neither axis dominates; clamp to a side that fits.
  let side = (Math.max(rect.width, MIN_FOCUS_AREA_SIZE) + Math.max(rect.height, MIN_FOCUS_AREA_SIZE)) / 2;
  side = clamp(side, MIN_FOCUS_AREA_SIZE, 1);
  return clampSquare(cx - side / 2, cy - side / 2, side);
}

/** Move a focus rect by (dx,dy) WITHOUT changing its dimensions, clamped inside the scene. */
export function moveRectInsideBounds(rect: NestFocusBounds, dx: number, dy: number): NestFocusBounds {
  return {
    x: round(clamp(rect.x + dx, 0, 1 - rect.width)),
    y: round(clamp(rect.y + dy, 0, 1 - rect.height)),
    width: round(rect.width),
    height: round(rect.height),
  };
}

/**
 * Resize a focus rect from one corner with the OPPOSITE corner anchored, keeping the
 * locked square ratio. `dirX`/`dirY` ∈ {-1,1} pick the dragged corner; `pointer` is the
 * new normalized pointer position. The square side grows to the larger axis span, clamped
 * so the rect stays inside the scene with the anchor fixed, at/above the minimum size.
 */
export function resizeRectWithLockedAspect(
  rect: NestFocusBounds,
  dir: { dirX: number; dirY: number },
  pointer: { x: number; y: number },
): NestFocusBounds {
  // Anchor = the corner opposite the dragged one.
  const ax = dir.dirX < 0 ? rect.x + rect.width : rect.x;
  const ay = dir.dirY < 0 ? rect.y + rect.height : rect.y;
  // Largest available square side toward the dragged direction (keeps the anchor inside).
  const maxSide = Math.min(dir.dirX < 0 ? ax : 1 - ax, dir.dirY < 0 ? ay : 1 - ay);
  let side = Math.max(Math.abs(pointer.x - ax), Math.abs(pointer.y - ay));
  side = clamp(side, MIN_FOCUS_AREA_SIZE, Math.max(MIN_FOCUS_AREA_SIZE, maxSide));
  const nx = dir.dirX < 0 ? ax - side : ax;
  const ny = dir.dirY < 0 ? ay - side : ay;
  return { x: round(nx), y: round(ny), width: round(side), height: round(side) };
}

// ── Cinematic same-stage transform (Phase 5) ───────────────────────────────────

export interface CinematicFocusTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/** The identity transform = the Main Nest at rest. */
export const IDENTITY_FOCUS_TRANSFORM: CinematicFocusTransform = { scale: 1, translateX: 0, translateY: 0 };

/**
 * The transform that makes `focusBounds` fill the viewport exactly (the scene is rendered
 * at the viewport size). `scale = viewportWidth / focusPixelWidth` (= viewportHeight /
 * focusPixelHeight, equal because the ratio matches); translate maps the focus origin to
 * the viewport origin. transform-origin must be 0 0. Pure + deterministic.
 */
export function cinematicFocusTransform(input: {
  viewportWidth: number;
  viewportHeight: number;
  focusBounds: NestFocusBounds;
}): CinematicFocusTransform {
  const { viewportWidth, viewportHeight, focusBounds } = input;
  const fpw = focusBounds.width * viewportWidth;
  const fph = focusBounds.height * viewportHeight;
  void fph;
  const scale = fpw > 0 ? viewportWidth / fpw : 1;
  return {
    scale: round(scale, 5),
    translateX: round(-(focusBounds.x * viewportWidth) * scale, 3),
    translateY: round(-(focusBounds.y * viewportHeight) * scale, 3),
  };
}

/** Measurement-free CSS for the cinematic transform (transform-origin: 0 0). */
export function cinematicFocusTransformCss(focusBounds: NestFocusBounds): { transform: string; transformOrigin: string } {
  const scale = focusBounds.width > 0 ? 1 / focusBounds.width : 1;
  const txPct = focusBounds.width > 0 ? -(focusBounds.x / focusBounds.width) * 100 : 0;
  const tyPct = focusBounds.height > 0 ? -(focusBounds.y / focusBounds.height) * 100 : 0;
  return { transform: `translate(${round(txPct, 4)}%, ${round(tyPct, 4)}%) scale(${round(scale, 5)})`, transformOrigin: "0 0" };
}

// ── Migration from legacy (trigger/crop) → focusBounds (Phase 2) ───────────────

/** A sensible default focus rect when nothing else is available. */
const DEFAULT_FOCUS_RECT: NestFocusBounds = { x: 0.34, y: 0.38, width: 0.32, height: 0.32 };

/**
 * The authoritative focus rectangle of an area. Prefers the new `focusBounds`; otherwise
 * MIGRATES deterministically from the legacy `cropBounds` (preferred) → `bounds`
 * (trigger) → a default, coerced to the locked ratio and clamped. Never mutates `fa`.
 */
export function focusBoundsOf(fa: NestFocusArea): NestFocusBounds {
  if (fa.focusBounds) return fa.focusBounds;
  const legacy = fa.zoomRegion?.cropBounds ?? fa.bounds ?? DEFAULT_FOCUS_RECT;
  return fitRectToAspectRatio(legacy);
}

/**
 * Return a copy of `fa` with an explicit `focusBounds` set from the legacy fields (for
 * writing forward in the V1 contract). Legacy fields are preserved, not destroyed.
 */
export function normalizeLegacyFocusArea(fa: NestFocusArea): NestFocusArea {
  if (fa.focusBounds) return fa;
  return { ...fa, focusBounds: focusBoundsOf(fa) };
}

// ── M7C.5 — minimal creator authoring helpers ──────────────────────────────────

/** The auto-name for a newly added Focus Area (`Focus area N`). Deterministic. */
export function nextFocusAreaName(focusAreas: NestFocusArea[]): string {
  return `Focus area ${focusAreas.length + 1}`;
}

// ── M7C.6 — Focus Areas as entrances to nested editable child scenes ───────────
//
// A Focus Area links to an editable CHILD SCENE (a NestDetailScene). The child scene's
// visual base is the parent transformed to the area's focusBounds (`parent_crop`); its
// `objects` are scene-LOCAL (0..1 of the focused viewport). The same editor + visitor
// navigator operate on this scene graph. Built additively over the existing detail-scene
// storage so older documents/tests stay valid.

/** The child scene id a Focus Area opens (prefers childSceneId; legacy detail/target). */
export function childSceneIdOf(fa: NestFocusArea): string {
  return fa.childSceneId || fa.detailSurfaceId || fa.targetSceneId || "";
}

/** A unified, read-friendly view of any scene in the graph (root or a child). */
export interface EditorSceneView {
  id: string;
  name: string;
  sceneType: EditableSceneType;
  objects: EditableNestObject[];
  focusAreas: NestFocusArea[];
  parentSceneId?: string;
  parentFocusAreaId?: string;
  backgroundSource?: SceneBackgroundSource;
  aspectRatio: string;
  ambiencePresetId?: string;
}

/** Resolve a scene id ("" / root id = Main) to its unified view. */
export function getEditorScene(doc: EditableNestDocument, sceneId: string): EditorSceneView {
  const main = mainSceneId(doc);
  if (!sceneId || sceneId === main) {
    return { id: main, name: doc.name, sceneType: "main", objects: doc.objects, focusAreas: focusAreasOf(doc), aspectRatio: doc.aspectRatio, ambiencePresetId: doc.ambiencePresetId };
  }
  const s = getDetailScene(doc, sceneId);
  if (!s) return getEditorScene(doc, main);
  const sceneType: EditableSceneType = s.sceneType ?? (s.backgroundSource?.type === "parent_crop" ? "focus" : "detail_surface");
  return {
    id: s.id,
    name: s.name,
    sceneType,
    objects: s.objects,
    focusAreas: s.focusAreas ?? [],
    parentSceneId: s.parentSceneId,
    parentFocusAreaId: s.parentFocusAreaId,
    backgroundSource: s.backgroundSource,
    aspectRatio: s.viewport.aspectRatio,
    ambiencePresetId: s.ambiencePresetId,
  };
}

/** The Focus Area (in any scene) that leads INTO a given child scene. */
export function focusAreaForChildScene(doc: EditableNestDocument, childSceneId: string): NestFocusArea | undefined {
  const all = [focusAreasOf(doc), ...detailScenesOf(doc).map((s) => s.focusAreas ?? [])].flat();
  return all.find((f) => childSceneIdOf(f) === childSceneId);
}

/**
 * The resolved visual base of a child Focus Scene (`parent_crop`): the parent scene's
 * objects + the focus rectangle to transform them by. The editor and visitor both render
 * THIS so the authored crop and the visited crop are identical. Returns `undefined` for the
 * Main scene, an image-backed detail surface, or a missing/broken parent — the caller then
 * shows an explicit error state, never a blank room (M7C.7). Pure.
 */
export interface FocusSceneBase {
  parentSceneId: string;
  focusBounds: NestFocusBounds;
  /** The parent scene's objects, for rendering the read-only transformed base. */
  parentObjects: EditableNestObject[];
  /** The parent scene's aspect ratio (matches the focused viewport). */
  parentAspectRatio: string;
}

export function resolveFocusSceneBase(doc: EditableNestDocument, sceneId: string): FocusSceneBase | undefined {
  const main = mainSceneId(doc);
  if (!sceneId || sceneId === main) return undefined;
  const scene = getDetailScene(doc, sceneId);
  if (!scene) return undefined;
  const bg = scene.backgroundSource;
  if (!bg || bg.type !== "parent_crop") return undefined;
  const parentObjects = bg.parentSceneId === main ? doc.objects : getDetailScene(doc, bg.parentSceneId)?.objects;
  if (!parentObjects) return undefined; // broken parent reference → error state, not an empty room
  return { parentSceneId: bg.parentSceneId, focusBounds: bg.focusBounds, parentObjects, parentAspectRatio: doc.aspectRatio };
}

/**
 * Ensure a Focus Area has an editable child scene (`parent_crop` base). Idempotent: if one
 * already exists it is returned. Legacy `zoomRegion.childObjects` (crop-local 0..1, which
 * equals the focused-viewport 0..1) migrate into the new child scene's objects. Pure;
 * `now` is injected.
 */
export function ensureFocusChildScene(
  doc: EditableNestDocument,
  focusAreaId: string,
  now: string = FOCUS_T,
): { doc: EditableNestDocument; childSceneId: string } {
  const fa = focusAreasOf(doc).find((f) => f.id === focusAreaId);
  if (!fa) return { doc, childSceneId: "" };
  const existing = childSceneIdOf(fa);
  if (existing && getDetailScene(doc, existing)) return { doc, childSceneId: existing };

  const id = nextId("detail", allDetailSceneIds(doc));
  const main = mainSceneId(doc);
  const scene: NestDetailScene = {
    id,
    name: fa.name,
    kind: "detail",
    sceneType: "focus",
    backgroundSource: { type: "parent_crop", parentSceneId: main, focusBounds: focusBoundsOf(fa) },
    parentSceneId: main,
    parentFocusAreaId: fa.id,
    viewport: { aspectRatio: doc.aspectRatio },
    objects: fa.zoomRegion?.childObjects ?? [],
    ambiencePresetId: doc.ambiencePresetId,
    createdAt: now,
    updatedAt: now,
  };
  const next: EditableNestDocument = {
    ...doc,
    detailScenes: [...detailScenesOf(doc), scene],
    focusAreas: focusAreasOf(doc).map((f) => (f.id === focusAreaId ? { ...f, childSceneId: id, targetSceneId: id } : f)),
  };
  return { doc: next, childSceneId: id };
}

/** Give every root Focus Area an editable child scene (deterministic migration). */
export function migrateDocumentToSceneGraph(doc: EditableNestDocument, now: string = FOCUS_T): EditableNestDocument {
  let next = doc;
  for (const fa of focusAreasOf(doc)) {
    next = ensureFocusChildScene(next, fa.id, now).doc;
  }
  return next;
}

// ── Editor scene stack (pure) ──────────────────────────────────────────────────

/** The root editing context (Main scene). "" marks Main (matches the editor's convention). */
export function rootEditorSceneContext(): EditorSceneContext {
  return { activeSceneId: "", sceneStack: [""] };
}
export function activeEditorScene(ctx: EditorSceneContext): string {
  return ctx.activeSceneId;
}
export function editorSceneDepth(ctx: EditorSceneContext): number {
  return Math.max(0, ctx.sceneStack.length - 1);
}
export function canEnterEditorScene(ctx: EditorSceneContext): boolean {
  return editorSceneDepth(ctx) < MAX_FOCUS_DEPTH;
}
export function canExitEditorScene(ctx: EditorSceneContext): boolean {
  return ctx.sceneStack.length > 1;
}
export function parentEditorScene(ctx: EditorSceneContext): string | undefined {
  return ctx.sceneStack.length >= 2 ? ctx.sceneStack[ctx.sceneStack.length - 2] : undefined;
}
/** Push a child scene (no-op past MAX_FOCUS_DEPTH). */
export function enterEditorScene(ctx: EditorSceneContext, childSceneId: string): EditorSceneContext {
  if (!canEnterEditorScene(ctx)) return ctx;
  return { activeSceneId: childSceneId, sceneStack: [...ctx.sceneStack, childSceneId] };
}
/** Pop one level (returns directly to the parent). */
export function exitEditorScene(ctx: EditorSceneContext): EditorSceneContext {
  if (!canExitEditorScene(ctx)) return ctx;
  const stack = ctx.sceneStack.slice(0, -1);
  return { activeSceneId: stack[stack.length - 1], sceneStack: stack };
}

/** Depth of a scene in the document (Main = 0). Follows parentSceneId chains. */
export function documentSceneDepth(doc: EditableNestDocument, sceneId: string): number {
  let depth = 0;
  let cur = sceneId;
  const main = mainSceneId(doc);
  const seen = new Set<string>();
  while (cur && cur !== main && !seen.has(cur)) {
    seen.add(cur);
    const s = getDetailScene(doc, cur);
    if (!s) break;
    depth += 1;
    cur = s.parentSceneId;
  }
  return depth;
}

/** Whether a Focus Area is visitable (the M7C.6 fix: a zoom/entrance area needs only a
 *  valid focus rectangle — `zoomRegion` is NOT required, so editor-authored areas show). */
export function isVisitableFocusArea(fa: NestFocusArea): boolean {
  if (!fa.enabled || fa.locked) return false;
  return focusTargetTypeOf(fa) === "zoom_region" ? true : Boolean(detailSurfaceIdOf(fa));
}

/** Whether deleting a Focus Area would discard authored child content (objects/hotspots/
 *  nested areas in its child scene) — drives the delete confirmation. */
export function focusAreaHasContent(doc: EditableNestDocument, focusAreaId: string): boolean {
  const fa = focusAreasOf(doc).find((f) => f.id === focusAreaId);
  if (!fa) return false;
  const child = getDetailScene(doc, childSceneIdOf(fa));
  if (!child) return false;
  return (child.objects?.length ?? 0) > 0 || (child.focusAreas?.length ?? 0) > 0;
}
