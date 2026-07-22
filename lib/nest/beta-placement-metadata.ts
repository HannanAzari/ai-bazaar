/**
 * lib/nest/beta-placement-metadata.ts — production placement metadata for Beta assets.
 * -----------------------------------------------------------------------------
 * Phase 2, Sprint 2. The five-object asset family passed; the in-room composite failed on
 * PLACEMENT (arbitrary manual scales, floor-hosted electronics, overlaps). This declares
 * the correct placement rules per asset so the REAL editor hosts them properly — no PNG
 * changes, no editor redesign. The editor-consumed subset (compatibleSlotTypes, defaultScale,
 * anchor, plane) maps into the fixture; the richer fields document intent for the placement
 * system and future data passes.
 *
 * PURE DATA.
 */

export type PhysicalSize = "small" | "medium" | "large";
export type PlacementPlane = "floor" | "surface" | "wall";

export type PlacementMetadata = {
  /** Rough real-world footprint class — drives default scale + host expectations. */
  physicalSize: PhysicalSize;
  /** Default editor scale (fraction of the room's reference width). */
  defaultScale: number;
  /** Bottom-anchored placement point (x,y in the object's own 0..1 box). */
  anchor: { x: number; y: number };
  /** Where it lives by default. */
  plane: PlacementPlane;
  /** Editor slot types it can host on (drives snapping + guardrails). */
  acceptedHosts: string[];
  /** Preferred region of the room. */
  preferredZone: string;
  /** Render-order band. */
  zIndexRange: [number, number];
  contactShadow: boolean;
  wallMountable: boolean;
  /** Can stand on the floor on its own (vs. must sit on a host surface). */
  standsIndependently: boolean;
};

export const BETA_PLACEMENT: Record<string, PlacementMetadata> = {
  // Certified laptop — TABLETOP object; reduce ~15–20% from the prior 0.42 default.
  "ast-laptop-v1-certified": {
    physicalSize: "small", defaultScale: 0.34, anchor: { x: 0.5, y: 1 }, plane: "surface",
    acceptedHosts: ["desk", "table"], preferredZone: "desk", zIndexRange: [40, 60],
    contactShadow: true, wallMountable: false, standsIndependently: false,
  },
  "ast-tv-beta": {
    physicalSize: "medium", defaultScale: 0.40, anchor: { x: 0.5, y: 1 }, plane: "surface",
    acceptedHosts: ["media", "wall"], preferredZone: "media-wall", zIndexRange: [30, 50],
    contactShadow: true, wallMountable: true, standsIndependently: false,
  },
  "ast-bookshelf-beta": {
    physicalSize: "large", defaultScale: 0.42, anchor: { x: 0.5, y: 1 }, plane: "floor",
    acceptedHosts: ["shelf", "floor"], preferredZone: "back-wall", zIndexRange: [10, 25],
    contactShadow: true, wallMountable: false, standsIndependently: true,
  },
  "ast-plant-beta": {
    physicalSize: "medium", defaultScale: 0.30, anchor: { x: 0.5, y: 1 }, plane: "floor",
    acceptedHosts: ["plant", "floor", "table"], preferredZone: "corner", zIndexRange: [35, 55],
    contactShadow: true, wallMountable: false, standsIndependently: true,
  },
  "ast-sofa-beta": {
    physicalSize: "large", defaultScale: 0.52, anchor: { x: 0.5, y: 1 }, plane: "floor",
    acceptedHosts: ["seat", "floor"], preferredZone: "center-against-wall", zIndexRange: [15, 30],
    contactShadow: true, wallMountable: false, standsIndependently: true,
  },
};
