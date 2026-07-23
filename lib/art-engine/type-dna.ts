// ── Art Engine — Type DNA ─────────────────────────────────────────────────────
//
// The type-specific half of the world (the shared half lives in lib/visual-dna.ts).
// Each type declares what IT varies and what IT forbids, on top of the shared Visual DNA.
// The compiler (./compiler.ts) merges Shared Visual DNA + Type DNA + subject into a prompt.

export type ArtType = "avatar" | "asset" | "nest";

export type TypeDNA = {
  key: ArtType;
  version: string;
  /** Type-specific positive clauses (added after the shared world fragment). */
  positive: string[];
  /** Type-specific negatives (merged with the shared negatives). */
  negative: string[];
  /** Non-negotiable output requirements. */
  hardConstraints: string[];
  /** Canonical camera for this type. */
  camera: string;
};

export const AVATAR_TYPE_DNA: TypeDNA = {
  key: "avatar",
  version: "avatar-dna-v1",
  positive: [
    "a single FULL-BODY stylised 3D character of the SAME person, head to feet, standing naturally and centered",
    "large expressive but believable eyes with soft catchlights; clean sculpted face; warm friendly readable expression",
    "dimensional sculpted hair with real volume and soft strands (never a flat colour block)",
    "simplified but rich clothing folds; believable adult proportions (NOT chibi, NOT toy)",
    "feet flat with a clean bottom anchor on an invisible ground",
  ],
  negative: [
    "corporate avatar", "generic emoji character", "default character", "chibi", "super-deformed", "big head tiny body", "weak resemblance", "generic hairstyle",
    "extra fingers", "missing fingers", "malformed hands", "fused fingers", "extra limbs", "extra arms", "extra legs", "deformed anatomy", "distorted proportions",
    "multiple people", "duplicate person", "cropped body", "cut-off feet", "floating",
    "room", "furniture", "background scene", "floor", "wall", "baked ground shadow", "text", "logos", "watermark", "nsfw", "nudity",
  ],
  hardConstraints: [
    "fully transparent background — no room, no floor, no props, no baked ground shadow",
    "full body from head to feet, never cropped",
    "clean hands with exactly five fingers each; correct anatomy; no extra or malformed limbs",
    "recognisable respectful likeness of the person; preserve face shape, hairstyle, hair colour, glasses/accessories, facial hair, skin appearance and body type",
    "no text or logos",
  ],
  camera: "avatar-front-v1",
};

export const ASSET_TYPE_DNA: TypeDNA = {
  key: "asset",
  version: "asset-dna-v1",
  positive: [
    "a single home object rendered with MATERIAL TRUTH (the real material reads correctly — metal as metal, timber as timber, fabric as fabric)",
    "canonical front-facing pose; the object sits believably as if on an invisible surface",
    "clean confident silhouette that reads instantly at editor-thumbnail size",
  ],
  negative: ["wooden bleed on non-timber materials", "random photoreal texture noise", "busy detail that muddies at small size", "cast ground shadow"],
  hardConstraints: [
    "fully transparent background (native alpha), object isolated",
    "no baked room, floor, wall or cast shadow",
    "canonical pose and camera; no tilt or perspective distortion",
    "no invented text or logos",
  ],
  camera: "front-facing-v1",
};

export const NEST_TYPE_DNA: TypeDNA = {
  key: "nest",
  version: "nest-dna-v1",
  positive: [
    "an EMPTY interior room — a bare architectural stage with no furniture and no objects of any kind",
    "generous empty floor and wall placement zones, ready to be decorated later",
    "readable architecture with gentle depth; a space the Nestudio characters would inhabit",
  ],
  negative: ["furniture", "sofa", "chair", "desk", "table", "shelf", "rug", "lamp", "plant", "decorations", "clutter", "people", "photoreal estate render", "generic empty 3d box", "warped corners", "pasted-on foreground", "fisheye"],
  hardConstraints: [
    "one canonical straight-on, eye-level editor camera; front wall facing the viewer; natural (not wide-angle) lens",
    "completely empty of furniture, objects, people and text — architecture only",
    "no warped or floating geometry",
  ],
  camera: "front-facing-v1",
};

export const TYPE_DNA: Record<ArtType, TypeDNA> = {
  avatar: AVATAR_TYPE_DNA,
  asset: ASSET_TYPE_DNA,
  nest: NEST_TYPE_DNA,
};
