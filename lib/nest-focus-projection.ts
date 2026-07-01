// ── Nestudio V2 — Focus-Scene spatial projection & inheritance (M7C.8) ─────────
//
// The ONE shared transform between a child Focus Scene's local space and its parent
// scene's space, plus the two derived (never-persisted) views that flow across that
// boundary:
//
//   • INHERITED parent objects  — parent objects that intersect the Focus Area, exposed
//     inside the child scene as read-only INTERACTION PROXIES (Part A). Their art is NOT
//     redrawn (it is already in the flattened parent-crop base — strategy A); only their
//     hotspots/bindings are surfaced, aligned to the crop.
//   • PROJECTED child objects   — native child objects drawn back in the Main Nest as a
//     read-only projection at the matching small position inside the Focus Area (Part B).
//
// The child-local ↔ parent transform is the EXACT inverse of the renderer's cinematic
// crop transform (`cinematicFocusTransformCss`): the focused viewport IS the `focusBounds`
// rectangle of the parent enlarged to fill the stage. Because `focusBounds` is
// square-normalized (`w == h`, so the crop's on-screen aspect matches the Nest), the same
// per-axis mapping holds for x and y. Rendering, hit-testing and tests all go through here.
//
// Pure: no React/DOM, no I/O, no Math.random, no Date.now (timestamps are injected).

import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import type { NestAssetHotspot, NestHotspotContentBinding } from "@/lib/nest-hotspot-types";
import type { NestDetailScene, NestFocusBounds } from "@/lib/nest-focus-types";
import {
  focusBoundsOf,
  focusAreaForChildScene,
  getDetailScene,
  mainSceneId,
  resolveFocusSceneBase,
} from "@/lib/nest-focus-scenes";

type Rect = NestFocusBounds;
type Point = { x: number; y: number };

const round = (n: number, p = 6): number => +n.toFixed(p);

// ── The shared transform (child-local 0..1 of the focused viewport ↔ parent 0..1) ──

/** Map a child-local rect (0..1 of the focused viewport) into parent-scene coordinates. */
export function childToParentRect(child: Rect, focus: Rect): Rect {
  return {
    x: round(focus.x + child.x * focus.width),
    y: round(focus.y + child.y * focus.height),
    width: round(child.width * focus.width),
    height: round(child.height * focus.height),
  };
}

/** Map a parent-scene rect into child-local coordinates (0..1 of the focused viewport). */
export function parentToChildRect(parent: Rect, focus: Rect): Rect {
  if (focus.width <= 0 || focus.height <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: round((parent.x - focus.x) / focus.width),
    y: round((parent.y - focus.y) / focus.height),
    width: round(parent.width / focus.width),
    height: round(parent.height / focus.height),
  };
}

export function childToParentPoint(p: Point, focus: Rect): Point {
  return { x: round(focus.x + p.x * focus.width), y: round(focus.y + p.y * focus.height) };
}
export function parentToChildPoint(p: Point, focus: Rect): Point {
  if (focus.width <= 0 || focus.height <= 0) return { x: 0, y: 0 };
  return { x: round((p.x - focus.x) / focus.width), y: round((p.y - focus.y) / focus.height) };
}

/** Whether two normalized rects overlap (touching edges do not count). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The overlapping rect of `a` and `b`, or null when they do not overlap. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x: round(x), y: round(y), width: round(right - x), height: round(bottom - y) };
}

// ── Stable identity (derived ids never collide with persisted instance ids) ────

export const INHERITED_PREFIX = "inherited:";

/** A stable derived id for an inherited parent object inside a child scene. */
export function inheritedObjectId(parentObjectId: string): string {
  return `${INHERITED_PREFIX}${parentObjectId}`;
}
export function isInheritedObjectId(id: string): boolean {
  return id.startsWith(INHERITED_PREFIX);
}
/** The parent object id behind a derived inherited id (null if not inherited). */
export function parseInheritedObjectId(derivedId: string): string | null {
  return derivedId.startsWith(INHERITED_PREFIX) ? derivedId.slice(INHERITED_PREFIX.length) : null;
}
/** The child-scene override key for one inherited hotspot. */
export function inheritedBindingKey(parentObjectId: string, hotspotId: string): string {
  return `${parentObjectId}::${hotspotId}`;
}

// ── Part A — inherited parent objects (interaction proxies) ────────────────────

/** A read-only, never-persisted view of a parent object surfaced inside a child scene. */
export interface InheritedFocusObject {
  /** Stable derived id (`inherited:<parentObjectId>`) — distinct from any persisted id. */
  derivedId: string;
  parentSceneId: string;
  parentObjectId: string;
  assetId: string;
  /** The parent object's box mapped into child-local (0..1 of the focused viewport). */
  childBounds: NestFocusBounds;
  rotation?: number;
  flipX?: boolean;
  /** Inherited paint order (relative to the parent scene). */
  zIndex: number;
  /** Asset-local hotspots with their EFFECTIVE binding (child override beats parent). */
  hotspots: NestAssetHotspot[];
  /** Inherited objects are never movable from the child scene. */
  locked: true;
  inherited: true;
  hidden?: boolean;
  ariaLabel?: string;
}

/** Resolve a child override binding for one inherited hotspot, else the parent's binding. */
export function resolveInheritedHotspotBinding(
  scene: NestDetailScene | undefined,
  parentObjectId: string,
  hotspot: NestAssetHotspot,
): NestHotspotContentBinding | undefined {
  const override = scene?.inheritedBindings?.[inheritedBindingKey(parentObjectId, hotspot.id)];
  return override ?? hotspot.binding;
}

/**
 * The parent objects that intersect a child Focus Scene's Focus Area, as read-only
 * inherited interaction proxies (Part A). Geometry/art stay owned by the parent; only the
 * binding can be overridden per child scene. Empty for the Main scene, image surfaces, a
 * broken parent, or when no parent object overlaps the crop. Pure.
 */
export function resolveInheritedFocusObjects(doc: EditableNestDocument, childSceneId: string): InheritedFocusObject[] {
  const base = resolveFocusSceneBase(doc, childSceneId);
  if (!base) return [];
  const scene = getDetailScene(doc, childSceneId);
  const focus = base.focusBounds;
  const out: InheritedFocusObject[] = [];
  for (const o of base.parentObjects) {
    if (o.hidden) continue;
    const box: Rect = { x: o.x, y: o.y, width: o.width, height: o.height };
    if (!rectsIntersect(box, focus)) continue;
    const hotspots = (o.hotspots ?? []).map((h) => ({
      ...h,
      binding: resolveInheritedHotspotBinding(scene, o.instanceId, h),
    }));
    out.push({
      derivedId: inheritedObjectId(o.instanceId),
      parentSceneId: base.parentSceneId,
      parentObjectId: o.instanceId,
      assetId: o.assetId,
      childBounds: parentToChildRect(box, focus),
      rotation: o.rotation,
      flipX: o.flipX,
      zIndex: o.zIndex,
      hotspots,
      locked: true,
      inherited: true,
      ariaLabel: o.assetId,
    });
  }
  return out.sort((a, b) => a.zIndex - b.zIndex);
}

/**
 * Set (or clear, when `binding` is undefined) a child-scene override for an inherited
 * hotspot. Never touches the parent object. One updated document; pure (`now` injected).
 */
export function setInheritedHotspotBinding(
  doc: EditableNestDocument,
  childSceneId: string,
  parentObjectId: string,
  hotspotId: string,
  binding: NestHotspotContentBinding | undefined,
  now: string,
): EditableNestDocument {
  const key = inheritedBindingKey(parentObjectId, hotspotId);
  return {
    ...doc,
    detailScenes: (doc.detailScenes ?? []).map((s) => {
      if (s.id !== childSceneId) return s;
      const next = { ...(s.inheritedBindings ?? {}) };
      if (binding) next[key] = binding;
      else delete next[key];
      return { ...s, inheritedBindings: next, updatedAt: now };
    }),
  };
}

// ── Part B — child objects projected back into the Main Nest ───────────────────

/** Paint order base so projections render ABOVE Main native objects (within their clip). */
export const PROJECTED_Z_BASE = 1000;

/** A read-only, never-persisted projection of a child object in the parent (Main) scene. */
export interface ProjectedChildObject {
  /** The OWNING child object's id (identity only — no second object is persisted). */
  instanceId: string;
  childSceneId: string;
  focusAreaId: string;
  assetId: string;
  /** The object's child-local box (0..1 of the focused viewport) — for the clipped render. */
  childBounds: NestFocusBounds;
  /** The Focus Area rectangle on the parent scene (the projection's clip region). */
  focusBounds: NestFocusBounds;
  /** The object mapped + clipped into parent-scene coordinates (for hit-testing/tests). */
  parentBounds: NestFocusBounds;
  /** The object's plane (drives object-bottom vs object-center, matching the child render). */
  plane: EditableNestObject["plane"];
  /** M8: the object's editable-surface content, so projections show the same personalization. */
  surfaces?: EditableNestObject["surfaces"];
  rotation?: number;
  flipX?: boolean;
  /** Paint order relative to Main objects (always above, ordered by child z then scene). */
  zIndex: number;
}

/** Whether a child object should project into its parent, honouring the projection policy. */
export function shouldProjectChild(obj: EditableNestObject, mode: "editor" | "visitor" = "visitor"): boolean {
  if (obj.hidden) return false;
  const policy = obj.projection;
  if (policy && policy.showInParent === false) return false; // explicit opt-out
  if (mode === "editor" && policy?.parentVisibility === "preview_only") return false;
  return true; // default-on (absent policy ⇒ project)
}

/**
 * Every eligible child Focus-Scene object projected into the Main Nest (Part B). Only
 * ONE nesting level participates: depth-1 Focus Scenes (`parent_crop`) whose parent IS the
 * Main scene. Deeper nesting is ignored (V1). Pure; reads, never mutates.
 */
export function projectChildObjectsToMain(
  doc: EditableNestDocument,
  opts: { mode?: "editor" | "visitor" } = {},
): ProjectedChildObject[] {
  const mode = opts.mode ?? "visitor";
  const main = mainSceneId(doc);
  const out: ProjectedChildObject[] = [];
  let order = 0;
  for (const scene of doc.detailScenes ?? []) {
    const bg = scene.backgroundSource;
    if (!bg || bg.type !== "parent_crop" || bg.parentSceneId !== main) continue; // one level, Main parent only
    const fa = focusAreaForChildScene(doc, scene.id);
    if (!fa) continue;
    const focus = focusBoundsOf(fa);
    for (const o of scene.objects) {
      if (!shouldProjectChild(o, mode)) continue;
      const box: Rect = { x: o.x, y: o.y, width: o.width, height: o.height };
      const parentBounds = childToParentRect(box, focus);
      const clipped = intersectRect(parentBounds, focus);
      if (!clipped) continue; // entirely outside the Focus Area — nothing to project
      out.push({
        instanceId: o.instanceId,
        childSceneId: scene.id,
        focusAreaId: fa.id,
        assetId: o.assetId,
        childBounds: box,
        focusBounds: focus,
        parentBounds: clipped,
        plane: o.plane,
        surfaces: o.surfaces,
        rotation: o.rotation,
        flipX: o.flipX,
        zIndex: PROJECTED_Z_BASE + order * 100 + o.zIndex,
      });
    }
    order += 1;
  }
  return out;
}

/** Set the projection policy of one child object (e.g. opt a child out of Main). Pure. */
export function setChildProjectionPolicy(
  doc: EditableNestDocument,
  childSceneId: string,
  instanceId: string,
  policy: EditableNestObject["projection"],
  now: string,
): EditableNestDocument {
  return {
    ...doc,
    detailScenes: (doc.detailScenes ?? []).map((s) =>
      s.id === childSceneId
        ? { ...s, objects: s.objects.map((o) => (o.instanceId === instanceId ? { ...o, projection: policy } : o)), updatedAt: now }
        : s,
    ),
  };
}
