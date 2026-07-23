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

// ── Avatar Art Direction v1 (candidate) ───────────────────────────────────────
// The official Nestudio avatar brief. Warm, approachable, premium, timeless — an honestly
// stylised soft-3D character that is unmistakably the real person, never cartoon/anime/
// plastic/AI-looking. Tuned from founder feedback on real generations, then frozen as the
// Avatar Golden Reference. Edit the WORDS here; the compiler machinery is untouched.
export const AVATAR_TYPE_DNA: TypeDNA = {
  key: "avatar",
  version: "avatar-art-v1-candidate",
  positive: [
    "a single full-body character portrait of the SAME real person, standing calmly head to feet, centered",
    "the official Nestudio avatar look: warm, approachable, premium, timeless — a soft, sculpted character with gentle believable volume, honestly stylised but never cartoonish",
    "the balance of realism, stylisation and simplicity: clearly the person, softened and simplified — NOT photoreal and NOT flat, none of the three exaggerated at the expense of the others",
    "face: calm, warm, expressive; ALIVE eyes with soft moist catchlights and real depth (never dead, glassy or doll-like); natural skin with gentle warmth and a soft subsurface glow — matte, never glossy",
    "hair: believable VOLUME with soft directional strands that catch the light — sculpted and dimensional, never a flat colour block or a solid helmet",
    "clothing: soft real fabric with gentle folds and weight; natural relaxed shoulders",
    "materials: matte, warm and tactile throughout — absolutely no glossy plastic sheen and no toy shine",
    "a clear, confident silhouette that stays instantly recognisable even as a tiny thumbnail",
    "ONE canonical Nestudio light: a soft warm key from the upper front, gentle fill, a soft rim — calm and consistent; this light is part of the Nestudio identity",
  ],
  negative: [
    "anime", "manga", "Pixar clone", "Disney clone", "Dreamworks", "emoji", "mobile game character", "video game NPC",
    "corporate mascot", "generic avatar", "default character", "AI-generated look", "generic AI face", "uncanny",
    "dead eyes", "doll eyes", "glassy eyes", "plastic toy", "action figure", "glossy plastic", "wax figure",
    "flat illustration", "flat vector", "cel-shaded flat", "sticker", "chibi", "super-deformed", "big head tiny body",
    "weak resemblance", "generic hairstyle", "flat hair", "helmet hair",
    "extra fingers", "missing fingers", "malformed hands", "fused fingers", "extra limbs", "extra arms", "extra legs", "deformed anatomy", "distorted proportions",
    "multiple people", "duplicate person", "cropped body", "cut-off feet", "floating",
    "room", "furniture", "background scene", "floor", "wall", "baked ground shadow", "text", "logos", "watermark", "nsfw", "nudity",
  ],
  hardConstraints: [
    "fully transparent background — no room, no floor, no props, no baked ground shadow",
    "full body from head to feet, never cropped; a calm idle standing pose with arms relaxed at the sides; feet flat and correct",
    "clean correct hands with exactly five fingers each; natural shoulders and neck; no extra or malformed limbs",
    "recognisable respectful likeness — preserve hair, face shape, expression, glasses, facial hair, skin tone, important accessories and general clothing identity",
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
