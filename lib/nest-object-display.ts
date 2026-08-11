// ── M27B-1 §P1 — ONE answer to "what appears inside this object?" ────────────
//
// THE ARCHITECTURE THIS FIXES.
//
// The editor and the runtime answered that question through different systems, and only
// one of them was right:
//
//   • the RUNTIME read `interaction.asset.connection` (what Connect writes) and drew it
//     into the asset's aperture from `SURFACE_CATALOG`;
//   • the EDITOR read `object.surfaces` — the separate M8 surface-content store — and had
//     no reference to `connection` anywhere at all.
//
// So a creator uploaded a photo, Connect stored it, Preview showed it inside the frame,
// and Edit showed a bare empty frame. Same document, two sources of truth.
//
// This module is now the single source. Both surfaces call it; neither re-implements the
// conditions. The M8 `SurfaceContentLayer` still exists for legacy per-surface content, but
// it is no longer a competing answer for Connect media — see `nest-runtime.tsx`, which
// draws a legacy surface only when the display resolver has not claimed that same surface.
//
// Pure: no React, no DOM, no Supabase.

import { capabilitiesForAsset, placementContents, resolveConnection, visualStateOf, type AssetInteractionConfig, type ConnectedContent, type ConnectedContentKind } from "@/lib/nest-asset-interaction";
import { predefinedSurfacesForAsset } from "@/lib/nest-surface-catalog";
import { clampContentIndex } from "@/lib/nest-media-session";
import type { NestPlacement } from "@/lib/nest-document-types";
import type { NormalizedRect } from "@/lib/nest-types";

/** What to physically draw inside an object's media aperture. */
export type ObjectDisplayContent = {
  /** The image to paint. Already resolved — a storage URL or a derived thumbnail. */
  src: string;
  /** The aperture, in the object's own 0..1 box. */
  bounds: NormalizedRect;
  /** How the picture sits in the aperture. */
  fit: "cover" | "contain";
  cornerRadiusPx?: number;
  /** The content kind that produced it, for callers that style by type. */
  kind: ConnectedContentKind;
  /** The surface id claimed, so a legacy surface layer can avoid double-drawing it. */
  surfaceId: string;
};

/**
 * `authoring` — the creator is composing. Content shows regardless of the object's visual
 * state, because a TV that is "off" would otherwise give the creator no feedback that their
 * video attached at all.
 *
 * `runtime` — a visitor is looking. State gates it: an off TV shows an off TV.
 *
 * The FRAME behaves identically under both, because its only state shows its screen. That
 * is what makes the acceptance invariant hold — a photo visible in Preview is necessarily
 * already visible in Edit.
 */
export type DisplayMode = "authoring" | "runtime";

/**
 * The picture for an object, or null when there is nothing to draw.
 *
 * Returns null — rather than a partial result — whenever ANY link in the chain is missing:
 * no aperture in the catalogue, no connection, a connection the asset does not accept, a
 * state that hides the screen, or a content kind with no still image. Callers render it or
 * they do not; there is no half-configured case for them to interpret.
 */
export function resolveObjectDisplayContent(input: {
  assetId: string;
  connection: ConnectedContent | null | undefined;
  /** The object's current visual state. Ignored entirely in `authoring` mode. */
  state?: string | null;
  mode: DisplayMode;
}): ObjectDisplayContent | null {
  const def = capabilitiesForAsset(input.assetId);
  const surfaceId = def?.screenSurfaceId;
  if (!surfaceId) return null; // this asset has no aperture — nothing can be drawn into it

  const surface = predefinedSurfacesForAsset(input.assetId).find((s) => s.id === surfaceId);
  if (!surface) return null; // declared an aperture but the catalogue has no bounds for it

  const c = input.connection;
  if (!c) return null;

  // A visitor sees the object's state; a creator sees their content.
  if (input.mode === "runtime" && !visualStateOf(input.assetId, input.state ?? "")?.showsScreen) return null;

  const src = displaySrc(c);
  if (!src) return null;

  return {
    src,
    bounds: surface.bounds,
    // `cover` fills the aperture: a photo should reach the edges of its mount and a video
    // still should fill the screen, rather than sitting letterboxed inside the moulding.
    fit: "cover",
    ...(surface.cornerRadiusPx != null ? { cornerRadiusPx: surface.cornerRadiusPx } : {}),
    kind: c.kind,
    surfaceId,
  };
}

/**
 * The still for a connection, or null when that kind has no picture.
 *
 * An explicit `thumbnailUrl` always wins — for YouTube it is derived in `resolveConnection`
 * from the parsed video id, so by the time it reaches here it is already present.
 */
function displaySrc(c: ConnectedContent): string | null {
  if (c.thumbnailUrl) return c.thumbnailUrl;
  if (c.kind === "image") return c.url ?? null;
  // `video`, `website` and `audio` have no derivable still yet. A website favicon or a
  // video poster frame would each be their own piece of work.
  return null;
}

// ── Adapters ─────────────────────────────────────────────────────────────────
//
// Two shapes carry a connection — the published `NestPlacement` and the editor's
// `EditableNestObject` — and they nest it differently. These exist so neither caller has to
// know that, and so there is exactly one place that maps each shape onto the resolver.

/** The published/visitor/feed shape. */
export function placementDisplayContent(
  p: NestPlacement,
  state: string | null,
  mode: DisplayMode = "runtime",
  contentIndex?: number,
): ObjectDisplayContent | null {
  // ── M27B-3A1 — the SESSION index, when a visitor has swiped ────────────────
  //
  // Absent, the creator's stored order decides — so Home, a cold Preview and a first page
  // load all show the item the creator put first. Only a visitor who has actually swiped
  // sees anything else, and that choice is never written back.
  //
  // `state` is untouched by any of this: which photo is showing and what the object LOOKS
  // like are separate questions, and conflating them is what would have blanked the frame.
  const list = placementContents(p);
  const connection =
    contentIndex == null ? resolveConnection(p) : list[clampContentIndex(contentIndex, list.length)] ?? null;
  return resolveObjectDisplayContent({ assetId: p.assetId, connection, state, mode });
}

/**
 * The editor shape.
 *
 * Note it does NOT go through `resolveConnection`, which takes a placement — so the
 * YouTube thumbnail derivation would be skipped. `connectionForEditableObject` applies the
 * same normalisation, which is what keeps Edit and Preview showing the identical picture.
 */
export function editableObjectDisplayContent(
  o: { assetId: string; assetInteraction?: AssetInteractionConfig },
  mode: DisplayMode = "authoring",
): ObjectDisplayContent | null {
  return resolveObjectDisplayContent({ assetId: o.assetId, connection: connectionForEditableObject(o), mode });
}

/**
 * Normalise an editor object's connection exactly as the runtime normalises a placement's.
 *
 * Built by round-tripping through the real placement conversion rather than duplicating
 * `resolveConnection`'s rules (accepted-kind check, URL safety, YouTube id validation and
 * thumbnail derivation). Duplicating them is precisely how Edit and Preview drifted apart
 * in the first place.
 */
export function connectionForEditableObject(o: {
  assetId: string;
  assetInteraction?: AssetInteractionConfig;
}): ConnectedContent | null {
  const cfg = o.assetInteraction;
  if (!cfg) return null;
  // M27B-2 — the WHOLE config travels, not just the legacy `connection`, so an object
  // holding a `contents` list resolves its current item exactly as the runtime does.
  // A minimal placement carrying the same interaction bag the publish conversion writes.
  const asPlacement = {
    id: "display-probe",
    assetId: o.assetId,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    zIndex: 1,
    interaction: { asset: cfg },
  } as unknown as NestPlacement;
  return resolveConnection(asPlacement);
}
