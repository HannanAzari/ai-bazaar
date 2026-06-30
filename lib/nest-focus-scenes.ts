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
  FocusShape,
  FocusTransition,
  FocusTrigger,
  NestDetailScene,
  NestFocusArea,
  NestFocusBounds,
  NestNavigationState,
  NestSceneGraph,
  NestSceneViewport,
} from "@/lib/nest-focus-types";
import {
  FOCUS_TRANSITIONS,
  FOCUS_TRIGGERS,
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

/**
 * Validate one Focus Area. When `knownSceneIds` is given, the `targetSceneId` must be a
 * known Detail Scene and must NOT equal the `sourceSceneId` (no self/circular link).
 */
export function validateFocusArea(fa: NestFocusArea, index = 0, knownSceneIds?: Set<string>): string[] {
  const errors: string[] = [];
  const at = `focusArea[${index}]${fa?.id ? ` (${fa.id})` : ""}`;
  if (!fa || typeof fa !== "object") return [`${at}: not an object`];
  if (!fa.id) errors.push(`${at}: missing id`);
  if (!fa.name) errors.push(`${at}: missing name`);
  if (!fa.sourceSceneId) errors.push(`${at}: missing sourceSceneId`);
  if (!fa.targetSceneId) errors.push(`${at}: missing targetSceneId`);
  errors.push(...validateBounds(fa.bounds, at));
  if (fa.shape != null && fa.shape !== "rect" && fa.shape !== "ellipse") errors.push(`${at}: invalid shape "${fa.shape}"`);
  if (!FOCUS_TRIGGERS.includes(fa.trigger)) errors.push(`${at}: invalid trigger "${fa.trigger}"`);
  if (!FOCUS_TRANSITIONS.includes(fa.transition)) errors.push(`${at}: invalid transition "${fa.transition}"`);
  if (typeof fa.enabled !== "boolean") errors.push(`${at}: enabled must be a boolean`);
  if (fa.sourceSceneId && fa.targetSceneId && fa.sourceSceneId === fa.targetSceneId) {
    errors.push(`${at}: circular link — target equals source`);
  }
  if (knownSceneIds && fa.targetSceneId && !knownSceneIds.has(fa.targetSceneId)) {
    errors.push(`${at}: targetSceneId "${fa.targetSceneId}" does not exist`);
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
