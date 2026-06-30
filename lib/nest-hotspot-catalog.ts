// ── Nestudio V2 — predefined hotspot catalog (M7B) ──────────────────────────
//
// Art-aligned hotspot definitions for the current core assets, kept out of any
// component. Normal creators don't draw regions — these ship with the asset and the
// creator only chooses what each one opens. Geometry is asset-local (0..1) and tuned
// against the actual cut-out art (see comments). Each predefined hotspot may carry a
// living-nest `interactionId` so the visitor effect matches the asset's state pack.
//
// HONESTY NOTE — the sprint's desk example lists Laptop/Microphone/Speaker/Notebook,
// but the current `desk-v2` art only visibly shows a **laptop** (centre), a
// **notebook** (right) and a small **desk lamp** (top-left). We define only those
// three genuine regions; a Microphone/Speaker region is intentionally NOT invented —
// it is reserved for a future composite-desk asset state (documented in
// docs/nest-connect-hotspots-v1.md).

import type { NestAssetHotspot, NestHotspotSemantic } from "@/lib/nest-hotspot-types";

type CatalogHotspot = {
  rel: string;
  name: string;
  semantic: NestHotspotSemantic;
  shape: NestAssetHotspot["shape"];
  interactionId?: string;
  ariaLabel?: string;
};

/** Predefined regions keyed by catalog asset id (asset-local 0..1 geometry). */
const CATALOG: Record<string, CatalogHotspot[]> = {
  // Media unit — the visible black screen panel only (pixel-measured PNG-local).
  "ast-tv": [
    { rel: "screen", name: "TV Screen", semantic: "video", interactionId: "tv_screen_video", shape: { type: "rect", x: 0.2, y: 0.11, width: 0.6, height: 0.48 }, ariaLabel: "TV screen — play video" },
  ],
  // Framed photo — the inner landscape image, inside the wooden border.
  "ast-framed-photo": [
    { rel: "photo", name: "Photo", semantic: "gallery", interactionId: "frame_focus_gallery", shape: { type: "rect", x: 0.18, y: 0.18, width: 0.64, height: 0.64 }, ariaLabel: "Framed photo — open gallery" },
  ],
  // Floor lamp — the cylindrical shade at the top only (pixel-measured; excludes the pole).
  "ast-floor-lamp": [
    { rel: "shade", name: "Lamp shade", semantic: "ambience", interactionId: "lamp_glow_ambience", shape: { type: "ellipse", x: 0.27, y: 0.12, width: 0.46, height: 0.16 }, ariaLabel: "Lamp — change ambience" },
  ],
  // Side plant — the leaf mass only (pixel-measured); the pot (below ~0.68) is excluded.
  "ast-side-plant": [
    { rel: "leaves", name: "Leaves", semantic: "animation", interactionId: "plant_leaf_sway", shape: { type: "ellipse", x: 0.15, y: 0.11, width: 0.66, height: 0.57 }, ariaLabel: "Plant leaves — sway" },
  ],
  // Avatar — the visible body (inside the padded PNG: x0.2–0.8, y0.1–0.92).
  "ast-avatar": [
    { rel: "body", name: "Avatar", semantic: "profile", interactionId: "avatar_greet", shape: { type: "rect", x: 0.2, y: 0.1, width: 0.6, height: 0.82 }, ariaLabel: "Creator — introduction" },
  ],
  // Writing desk — three genuine regions matching the art (laptop / notebook / desk lamp).
  "ast-desk": [
    { rel: "laptop", name: "Laptop", semantic: "website", shape: { type: "rect", x: 0.42, y: 0.29, width: 0.18, height: 0.14 }, ariaLabel: "Laptop — open website" },
    { rel: "notebook", name: "Notebook", semantic: "article", shape: { type: "rect", x: 0.62, y: 0.3, width: 0.14, height: 0.11 }, ariaLabel: "Notebook — read article" },
    { rel: "desk-lamp", name: "Desk lamp", semantic: "ambience", shape: { type: "rect", x: 0.12, y: 0.1, width: 0.16, height: 0.26 }, ariaLabel: "Desk lamp — ambience" },
  ],
  // Stacked books — read an article.
  "ast-stacked-books": [
    { rel: "books", name: "Books", semantic: "article", interactionId: "book_open_article", shape: { type: "rect", x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, ariaLabel: "Books — read article" },
  ],
  // Bookshelf — shelf-level regions (the art is too low-res for per-book taps).
  "ast-bookshelf": [
    { rel: "upper", name: "Upper shelf", semantic: "article", shape: { type: "rect", x: 0.24, y: 0.08, width: 0.52, height: 0.15 }, ariaLabel: "Upper shelf — read article" },
    { rel: "middle", name: "Middle shelf", semantic: "gallery", shape: { type: "rect", x: 0.24, y: 0.45, width: 0.52, height: 0.15 }, ariaLabel: "Middle shelf — open gallery" },
    { rel: "lower", name: "Lower shelf", semantic: "article", shape: { type: "rect", x: 0.24, y: 0.79, width: 0.52, height: 0.13 }, ariaLabel: "Lower shelf — read article" },
  ],
};

/** Whether an asset ships with predefined hotspots. */
export function hasPredefinedHotspots(assetId: string): boolean {
  return Boolean(CATALOG[assetId]?.length);
}

/**
 * The predefined hotspots for one asset *instance*, with deterministic
 * instance-scoped ids (`${instanceId}-<rel>`). Empty when the asset has none.
 */
export function predefinedHotspotsForInstance(assetId: string, instanceId: string): NestAssetHotspot[] {
  const defs = CATALOG[assetId];
  if (!defs) return [];
  return defs.map((d) => ({
    id: `${instanceId}-${d.rel}`,
    name: d.name,
    semantic: d.semantic,
    shape: d.shape,
    interactionId: d.interactionId,
    enabled: true,
    authoringMode: "predefined" as const,
    ariaLabel: d.ariaLabel,
  }));
}
