// ── Nestudio V2 — Editable Asset Surfaces (M8) ──────────────────────────────
//
// A **surface** is an asset-local VISUAL content slot: the photo inside a frame, the
// thumbnail on a TV screen, a book cover, a note on a board. It personalizes pixels
// *within* an object's artwork without generating new art, and is completely independent
// of interaction hotspots/bindings (a surface says WHAT is shown; a binding says what
// happens on tap). Additive + optional + backward-compatible.
//
// Storage split: the **catalog** (nest-surface-catalog.ts) owns the per-asset-type surface
// DEFINITIONS (id, name, type, bounds, acceptedContentTypes); an object INSTANCE stores
// only the per-surface CONTENT (`EditableNestObject.surfaces`, keyed by the def id). A
// resolved `EditableSurface` merges the two (nest-surfaces.ts). No AI, no cloud, no I/O.

import type { NormalizedRect } from "@/lib/nest-types";

/** The kind of a surface region. */
export type SurfaceType = "image" | "text" | "sticker" | "collage";
export const SURFACE_TYPES: SurfaceType[] = ["image", "text", "sticker", "collage"];

/** The content forms a surface may accept (drives the surface editor + validation). */
export type SurfaceContentType = "uploaded_image" | "url_thumbnail" | "text" | "emoji" | "sticker_asset";
export const SURFACE_CONTENT_TYPES: SurfaceContentType[] = [
  "uploaded_image",
  "url_thumbnail",
  "text",
  "emoji",
  "sticker_asset",
];

/** Text presets for a text surface. */
export type SurfaceTextVariant = "title" | "quote" | "goal" | "slogan" | "note";
export const SURFACE_TEXT_VARIANTS: SurfaceTextVariant[] = ["title", "quote", "goal", "slogan", "note"];

/**
 * The actual content placed on a surface (discriminated by `kind`). Local prototype only:
 * an image is a data-URL (from an upload / local gallery) or a plain URL; a text is a
 * short string with a preset; a sticker is an emoji or a sticker-asset id.
 */
export type SurfaceContent =
  | { kind: "image"; src: string; source?: "upload" | "url" | "gallery"; fit?: "cover" | "contain" }
  | { kind: "text"; text: string; variant?: SurfaceTextVariant }
  | { kind: "sticker"; emoji: string };

/** A predefined surface region on an asset TYPE (catalog entry) — no content. */
export interface EditableSurfaceDef {
  /** Stable id per asset type, e.g. "tv-screen", "frame-photo". */
  id: string;
  name: string;
  type: SurfaceType;
  /** Asset-local rectangle (normalized 0..1 within the object box). */
  bounds: NormalizedRect;
  /** The content forms this surface accepts. */
  acceptedContentTypes: SurfaceContentType[];
  /** Rounded corners hint for the render (px). */
  cornerRadiusPx?: number;
}

/** A surface with its instance content merged in (the Phase-2 EditableSurface shape). */
export interface EditableSurface extends EditableSurfaceDef {
  content?: SurfaceContent;
}

/** The per-instance content map stored on an object (keyed by surface def id). */
export type ObjectSurfaceContent = Record<string, SurfaceContent>;
