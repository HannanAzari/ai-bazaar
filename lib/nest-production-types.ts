// ── Nestudio Production Library — types (M10) ────────────────────────────────
//
// The curated library that sits between raw generated candidates and the public
// creator flow. Admins approve/curate candidates into this library; onboarding +
// the editor read ONLY curated items. Purely additive — reuses the V2 Nest contract
// primitives (NestAssetCategory, NestSlotType, NestEditableSurface) from nest-types.
//
// Storage for M10 is local (fixtures + localStorage). No Supabase, no auth, no AI.

import type { NestAssetCategory, NestEditableSurface, NestSlotType } from "@/lib/nest-types";

/**
 * Curation status. Assets/backgrounds/templates are NEVER hard-deleted — they move
 * between these statuses so old Nests never break when something is pulled from the
 * public flow.
 * - draft: imported from candidates, not yet curated (not shown to creators)
 * - approved: curated, shown in onboarding + editor
 * - featured: curated + promoted (shown first)
 * - hidden: temporarily withheld from onboarding (still resolvable by id for old Nests)
 * - archived: retired from the public flow (still resolvable by id for old Nests)
 */
export type ProductionLibraryStatus = "draft" | "approved" | "hidden" | "archived" | "featured";

/** The statuses that make an item appear in the public creator/onboarding flow. */
export const ONBOARDING_VISIBLE_STATUSES: ProductionLibraryStatus[] = ["approved", "featured"];

/** One admin curation decision, persisted so it survives reloads. */
export type ProductionReviewDecision = {
  itemId: string;
  itemType: ProductionItemType;
  status: ProductionLibraryStatus;
  decidedAt: string;
  note?: string;
};

export type ProductionItemType = "background" | "asset" | "template";

/** LOD variants (web-optimized) for a library image. */
export type ProductionVariants = {
  mobile?: string;
  standard?: string;
  focus?: string;
};

/** Normalized footprint hint the editor uses to size/anchor an asset. */
export type ProductionVisualBounds = {
  aspect?: string; // "16:9"
  width?: number; // normalized 0..1 default footprint width
  height?: number;
  anchor?: { x: number; y: number };
};

export type ProductionHotspot = {
  id: string;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  action: string;
};

/** A curated placeable object. */
export type ProductionAsset = {
  id: string;
  name: string;
  category: NestAssetCategory;
  /** Display image (usually the transparent cut-out). */
  imageUrl: string;
  /** Transparent cut-out master (alpha), when available. */
  cutoutUrl?: string;
  variants: ProductionVariants;
  visualBounds?: ProductionVisualBounds;
  compatibleSlotTypes: NestSlotType[];
  editableSurfaces?: NestEditableSurface[];
  hotspots?: ProductionHotspot[];
  cameraDnaVersion: string;
  status: ProductionLibraryStatus;
  tags: string[];
  /** Where it came from in public/nests/.../candidates (provenance). */
  sourceCandidateId?: string;
};

/** A curated background stage. */
export type ProductionBackground = {
  id: string;
  name: string;
  /** Personality/style label ("Loft · concrete & brick"). */
  style?: string;
  imageUrl: string;
  variants: ProductionVariants;
  cameraDnaVersion: string;
  status: ProductionLibraryStatus;
  tags: string[];
  sourceCandidateId?: string;
};

/** One asset placed inside a template, normalized to the background. */
export type ObjectPlacement = {
  assetId: string;
  slotType?: NestSlotType;
  /** Normalized base-centre position on the background (0..1). */
  x: number;
  y: number;
  scale?: number;
  zIndex?: number;
};

/** A curated, ready-to-use starting Nest (background + placed objects). */
export type ProductionTemplate = {
  id: string;
  name: string;
  persona: string;
  backgroundId: string;
  objectPlacements: ObjectPlacement[];
  status: ProductionLibraryStatus;
  tags: string[];
  previewImage?: string;
};

/** The whole curated library. */
export type ProductionLibrary = {
  backgrounds: ProductionBackground[];
  assets: ProductionAsset[];
  templates: ProductionTemplate[];
};

/** Publish visibility choices offered at the (stubbed) publish gate. */
export type NestPublishVisibility = "public" | "unlisted" | "followers" | "private";

export const PUBLISH_VISIBILITY_OPTIONS: { id: NestPublishVisibility; label: string; hint: string }[] = [
  { id: "public", label: "Public", hint: "Anyone can find and visit your Nest." },
  { id: "unlisted", label: "Unlisted", hint: "Only people with the link can visit." },
  { id: "followers", label: "Followers only", hint: "Only your followers can visit." },
  { id: "private", label: "Private", hint: "Only you can see it." },
];

/** Whether an item (by status) should appear in the public onboarding flow. */
export function isOnboardingVisible(status: ProductionLibraryStatus): boolean {
  return ONBOARDING_VISIBLE_STATUSES.indexOf(status) !== -1;
}
