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
import type { NestHotspotShape } from "@/lib/nest-hotspot-types";
import {
  interactionForHotspot,
  interactionForPlacement,
  interactionProblem,
  NO_INTERACTION,
  type NestInteraction,
} from "@/lib/nest-interaction";
import { childSceneIdOf, cinematicFocusTransformCss, focusBoundsOf } from "@/lib/nest-focus-scenes";

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

/**
 * Every focus region in a document, with its child objects attached.
 *
 * A region with no detail scene is still returned: it is a valid zoom-only region, and
 * dropping it would silently discard creator intent.
 *
 * ── M24E: the crop comes from `focusBoundsOf`, not from `area.bounds` ──────────
 *
 * `NestFocusArea` carries two rectangles. `bounds` is the LEGACY pre-M7C.4 trigger box;
 * `focusBounds` is the V1 contract — the single rectangle the creator actually drags,
 * which is both the tap target and the camera crop. `focus-editor-overlay.tsx` authors
 * `focusBounds`, so reading `bounds` here meant the runtime framed a different rectangle
 * from the one the creator drew, or (on a region authored purely through the new overlay)
 * fell back to whatever stale `bounds` the area was created with.
 *
 * `focusBoundsOf` is the same function the editor overlay and `FocusedZoomStage` call, and
 * it migrates legacy areas deterministically. Sharing it is the point: a second copy of
 * this decision is how the editor and the visitor drifted apart in the first place.
 */
export function resolveFocusRegions(doc: NestDocument): ResolvedFocus[] {
  const areas = doc.scene?.focusAreas ?? [];
  const scenes = doc.scene?.detailScenes ?? [];
  return areas.map((area) => {
    // M24E — `childSceneId` is what `ensureFocusChildScene` writes when the creator first
    // enters a region to place things inside it. Matching only `targetSceneId` missed
    // every region authored that way, so the books resolved to no scene and no objects.
    const scene =
      scenes.find((s) => s.id === childSceneIdOf(area)) ??
      scenes.find((s) => s.id === area.targetSceneId) ??
      scenes.find((s) => s.parentFocusAreaId === area.id);
    return {
      area,
      crop: focusBoundsOf(area),
      objects: scene?.objects ?? [],
      scene,
    };
  });
}

/**
 * The camera transform that moves the main scene to a focus crop.
 *
 * Delegates to `cinematicFocusTransformCss` — the canonical transform the editor's focused
 * view already uses — so the creator's focused view and the visitor's are the same move,
 * not two implementations that agree by coincidence. `transform-origin: 0 0` with a
 * translate is what makes the crop land exactly on the viewport; a centre-origin scale is
 * only equivalent for a perfectly centred crop, which is why this now delegates instead of
 * recomputing.
 *
 * `scale` is returned alongside the CSS because the runtime needs it to keep hit targets
 * and control chrome at a constant on-screen size inside a focus.
 */
export function focusCameraTransform(crop: ResolvedFocus["crop"]): {
  scale: number;
  transform: string;
  transformOrigin: string;
} {
  const css = cinematicFocusTransformCss(crop);
  return {
    scale: crop.width > 0 ? 1 / crop.width : 1,
    transform: css.transform,
    transformOrigin: css.transformOrigin,
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

// ── M24E — hotspots: the part the runtime never rendered ─────────────────────
//
// `nest_objects.interaction.hotspots` has persisted the creator's regions AND their
// bindings since M23B — the data was verified present in the live database. The runtime
// simply never read it: `NestPreview` looked only at `placement.linkUrl`, so a TV whose
// screen the creator had bound to a YouTube URL rendered the assigned image and then
// ignored every tap. "Surface content shows but nothing happens" is exactly this.

/** A hotspot ready to draw and to tap: object-local geometry plus a resolved action. */
export type ResolvedHotspot = {
  id: string;
  name: string;
  /** Object-local rectangle (0..1 inside the placement's box), from the creator's shape. */
  bounds: { x: number; y: number; width: number; height: number };
  ellipse: boolean;
  interaction: NestInteraction;
  ariaLabel: string;
  /** Set when the creator configured something the runtime cannot execute (dev-visible). */
  problem: string | null;
};

const rectOf = (s: NestHotspotShape) => ({ x: s.x, y: s.y, width: s.width, height: s.height });

/**
 * The interactive hotspots on a placement.
 *
 * Only regions that actually DO something are returned — an unconfigured catalogue hotspot
 * would otherwise cover the object with an invisible button that swallows taps and does
 * nothing, which is worse than no hotspot at all. Malformed ones are returned WITH their
 * problem so the runtime can surface them in development rather than dropping them
 * silently.
 */
export function resolvePlacementHotspots(p: NestPlacement): ResolvedHotspot[] {
  const hotspots = p.interaction?.hotspots ?? [];
  const out: ResolvedHotspot[] = [];
  for (const h of hotspots) {
    if (!h.enabled) continue;
    const interaction = interactionForHotspot(h);
    const problem = interactionProblem(h);
    if (interaction.type === "none" && !problem) continue; // never configured — not a target
    out.push({
      id: h.id,
      name: h.name,
      bounds: rectOf(h.shape),
      ellipse: h.shape.type === "ellipse",
      interaction,
      ariaLabel: h.ariaLabel || h.binding?.label || h.name,
      problem,
    });
  }
  return out;
}

/**
 * The action for the placement AS A WHOLE, used only when no hotspot claims the tap.
 *
 * A hotspot is the more specific thing the creator drew, so it always wins; this is the
 * fallback for the simple "link this whole object" authoring path.
 */
export function placementFallbackInteraction(p: NestPlacement): NestInteraction {
  return resolvePlacementHotspots(p).length ? NO_INTERACTION : interactionForPlacement(p);
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
