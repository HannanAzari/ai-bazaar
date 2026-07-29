// ── M24D §1 — the scene the runtime replays ──────────────────────────────────
//
// One place that turns a canonical `NestDocument` into exactly what a renderer needs, so
// Editor Preview and the public visitor cannot disagree about what a Nest contains.
//
// Everything here is PURE and free of React and Supabase — which is the point. The
// previous split (a static `NestPreview` for visitors, `NestSceneNavigator` for the
// editor) existed because scene resolution lived inside components. With it extracted,
// both modes read the same functions and the same document.

import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";
import type { NestFocusArea, NestDetailScene } from "@/lib/nest-focus-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import { predefinedSurfacesForAsset } from "@/lib/nest-surface-catalog";
import type { EditableSurfaceDef, SurfaceContent } from "@/lib/nest-surface-types";

/** A focus region plus the child scene it opens. Resolved once, used by both modes. */
export type ResolvedFocus = {
  area: NestFocusArea;
  /** The crop the camera moves to. Normalised in the MAIN scene's 0..1 space. */
  crop: { x: number; y: number; width: number; height: number };
  /** Objects the creator placed INSIDE the focus, in the focused view's own 0..1 space. */
  objects: EditableNestObject[];
  scene?: NestDetailScene;
};

/** A surface with content, ready to draw. Bounds are object-local (0..1). */
export type ResolvedSurface = {
  id: string;
  name: string;
  /** Object-local rectangle inside the placement's box. */
  bounds: EditableSurfaceDef["bounds"];
  content: SurfaceContent;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Every focus region in a document, with its child objects attached.
 *
 * A region with no detail scene is still returned: it is a valid zoom-only region, and
 * dropping it would silently discard creator intent.
 */
export function resolveFocusRegions(doc: NestDocument): ResolvedFocus[] {
  const areas = doc.scene?.focusAreas ?? [];
  const scenes = doc.scene?.detailScenes ?? [];
  return areas.map((area) => {
    const scene =
      scenes.find((s) => s.id === area.targetSceneId) ??
      scenes.find((s) => s.parentFocusAreaId === area.id);
    const b = area.bounds;
    return {
      area,
      crop: {
        x: clamp01(b.x),
        y: clamp01(b.y),
        width: Math.min(1, Math.max(0.02, b.width)),
        height: Math.min(1, Math.max(0.02, b.height)),
      },
      objects: scene?.objects ?? [],
      scene,
    };
  });
}

/**
 * The camera transform that moves the main scene to a focus crop.
 *
 * Returned as a scale + translate in the SAME normalised space the objects live in, so
 * the background and every object move together. This is the "one transform" rule: a
 * focused view is the main scene under a transform, never a re-laid-out scene.
 */
export function focusCameraTransform(crop: ResolvedFocus["crop"]): {
  scale: number;
  originX: number;
  originY: number;
} {
  // Fill the stage with the crop, preserving aspect (the smaller axis wins so nothing
  // outside the crop leaks in).
  const scale = Math.min(1 / crop.width, 1 / crop.height);
  return {
    scale,
    // transform-origin as a percentage of the scene, so scaling pins the crop's centre.
    originX: clamp01(crop.x + crop.width / 2) * 100,
    originY: clamp01(crop.y + crop.height / 2) * 100,
  };
}

/**
 * The surfaces on a placement that actually have content.
 *
 * Content lives on the placement's `interaction.surfaces` bag (persisted since M23B), and
 * the geometry comes from the asset's catalogue definition. Neither needs editor state,
 * which is what lets a visitor render a surface at all.
 */
export function resolvePlacementSurfaces(p: NestPlacement): ResolvedSurface[] {
  const content = p.interaction?.surfaces;
  if (!content) return [];
  return predefinedSurfacesForAsset(p.assetId)
    .map((def) => {
      const c = content[def.id];
      return c ? { id: def.id, name: def.name, bounds: def.bounds, content: c } : null;
    })
    .filter((s): s is ResolvedSurface => s !== null);
}

/** True when this placement carries anything a visitor can interact with. */
export function placementIsInteractive(p: NestPlacement): boolean {
  return Boolean(p.linkUrl || p.interaction?.interactionId || p.interaction?.hotspots?.length);
}

/** Objects a focus scene contributes, in paint order. */
export function focusObjectsInPaintOrder(objects: EditableNestObject[]): EditableNestObject[] {
  return [...objects].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

// ── Long-term background contract (documented, not built this sprint) ─────────
//
// The canonical editable scene stays 3:4 forever — creator geometry is authored in it and
// must never be reinterpreted. A future immersive presentation adds, alongside it:
//
//   canonicalBackgroundUrl   3:4   the editable scene (today's `backgroundId`)
//   immersiveBackgroundUrl   9:16  a coordinated extension, generated from the same room
//   safeArea                       which band of the 9:16 the 3:4 scene occupies
//
// The runtime already accepts the extension without any geometry change: the 3:4 stage is
// positioned independently of whatever fills the space around it (see `SceneSurround`), so
// supplying `immersiveBackgroundUrl` only swaps what is drawn behind — object coordinates,
// focus crops and hotspots are untouched. This type is the seam; nothing generates it yet.
export type ImmersiveBackground = {
  /** 9:16 art coordinated with the room, drawn behind the canonical 3:4 scene. */
  immersiveBackgroundUrl?: string;
  /** Where the 3:4 scene sits inside the 9:16 art, normalised. Defaults to centred. */
  safeArea?: { x: number; y: number; width: number; height: number };
};
