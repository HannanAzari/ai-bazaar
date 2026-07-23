// ── Nestudio Visual DNA v1 — the ONE structured source of truth for the world ──
//
// Assets, Empty Nests and Avatars all inherit this. It is typed, versioned, serialisable
// and testable, and is INDEPENDENT of any generator — the Art Engine compiler
// (lib/art-engine) turns it into type-specific prompts + validators. Change a visual
// property HERE and it propagates to all three generators. Do not copy these values into
// the Avatar/Asset/Nest modules.

export const VISUAL_DNA_VERSION = "nestudio-visual-dna-v1";

export type VisualDNA = {
  version: string;
  lighting: string;
  warmth: string;
  contrast: string;
  saturation: string;
  materialResponse: string;
  edgeSoftness: string;
  ambientOcclusion: string;
  shadowLanguage: string;
  shapeLanguage: string;
  stylisation: string;
  detailDensity: string;
  silhouettePriority: string;
  cameraRelationship: string;
  thumbnailReadability: string;
  premiumFeel: string;
};

export const VISUAL_DNA: VisualDNA = {
  version: VISUAL_DNA_VERSION,
  lighting: "soft cinematic studio lighting — one warm key from the upper-front-left, gentle fill, a soft rim; no harsh speculars",
  warmth: "warm, inviting palette — warm neutrals with a soft accent colour; never cold or clinical",
  contrast: "gentle mid-contrast with soft roll-off in shadows and highlights",
  saturation: "muted-to-warm, harmonious saturation; never neon",
  materialResponse: "matte premium materials with a subtle, believable surface response; NO plastic toy shine, NO photoreal texture noise",
  edgeSoftness: "soft rounded edges; no hard vector outlines",
  ambientOcclusion: "subtle ambient occlusion in crevices and contact areas for depth",
  shadowLanguage: "soft form shadows; gentle, never harsh or crunchy",
  shapeLanguage: "rounded, sculpted, dimensional forms with real volume — simplified but rich, never flat",
  stylisation: "premium stylised 3D (Pixar / Nintendo emotional warmth) — NOT photoreal, NOT flat vector, NOT clip-art",
  detailDensity: "medium detail — enough to feel premium, restrained enough to read at a glance",
  silhouettePriority: "a clear, confident, instantly recognisable silhouette is the top priority",
  cameraRelationship: "one canonical front-facing, eye-level camera; consistent framing across the world",
  thumbnailReadability: "must read clearly at small editor-thumbnail size — no fine detail that muddies when shrunk",
  premiumFeel: "cohesive, warm, calm and premium — feels authored by one studio",
};

/** Shared negatives that keep every type in-world (the compiler merges type-specific ones). */
export const VISUAL_DNA_NEGATIVE = [
  "flat vector", "flat 2d illustration", "clip art", "hard outline", "sticker",
  "photoreal", "photo texture noise", "plastic toy shine", "glossy plastic",
  "cold lighting", "clinical", "neon", "oversaturated", "harsh shadows", "uncanny",
];

/** The shared world fragment injected into every generator's positive prompt. */
export function visualDnaFragment(dna: VisualDNA = VISUAL_DNA): string {
  return [
    `NESTUDIO VISUAL DNA (${dna.version}) — one shared world:`,
    `Lighting: ${dna.lighting}.`,
    `Warmth: ${dna.warmth}. Saturation: ${dna.saturation}. Contrast: ${dna.contrast}.`,
    `Materials: ${dna.materialResponse}.`,
    `Shape language: ${dna.shapeLanguage}; edges ${dna.edgeSoftness}.`,
    `Depth: ${dna.shadowLanguage}; ${dna.ambientOcclusion}.`,
    `Stylisation: ${dna.stylisation}. Detail: ${dna.detailDensity}.`,
    `Silhouette: ${dna.silhouettePriority}. Thumbnail: ${dna.thumbnailReadability}.`,
    `Overall: ${dna.premiumFeel}.`,
  ].join(" ");
}
