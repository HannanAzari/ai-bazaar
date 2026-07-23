// ── Nestudio Visual DNA v1 — ONE world across Assets, Empty Nests and Avatars ──
//
// A single enforceable specification of the shared premium-soft-3D world. Every generator
// (avatar-dna, nest-dna, and — already embodied — the certified furniture@8 asset prompt)
// includes `visualDnaFragment()` so the three types feel born in the same world without
// looking identical. Change the world in ONE place here.

export const VISUAL_DNA_VERSION = "nestudio-visual-dna-v1";

export const VISUAL_DNA = {
  version: VISUAL_DNA_VERSION,
  lighting: "soft cinematic studio lighting — one warm key from the upper-front-left, gentle fill, a soft rim; no harsh speculars",
  warmth: "warm, inviting palette — warm neutrals with a soft accent colour; never cold or clinical",
  contrast: "gentle mid-contrast with soft roll-off in shadows and highlights",
  materials: "matte premium materials with a subtle, believable surface response; NO plastic toy shine, NO photoreal texture noise",
  edges: "soft rounded edges and clean confident silhouettes; no hard vector outlines",
  shapeLanguage: "rounded, sculpted, dimensional forms with real volume — simplified but rich, never flat",
  saturation: "muted-to-warm, harmonious saturation; never neon",
  shadow: "soft form shadows and subtle ambient occlusion in crevices and contact areas",
  stylisation: "premium stylised 3D (Pixar / Nintendo emotional warmth) — NOT photoreal, NOT flat vector, NOT clip-art",
  detail: "medium detail: readable and premium at small editor-thumbnail size",
  camera: "one canonical front-facing, eye-level camera",
} as const;

/** The shared world fragment injected into every generator's positive prompt. */
export function visualDnaFragment(): string {
  const d = VISUAL_DNA;
  return [
    `NESTUDIO VISUAL DNA (${d.version}) — one shared world:`,
    `Lighting: ${d.lighting}.`,
    `Warmth: ${d.warmth}. Saturation: ${d.saturation}. Contrast: ${d.contrast}.`,
    `Materials: ${d.materials}.`,
    `Shape language: ${d.shapeLanguage}; ${d.edges}.`,
    `Depth: ${d.shadow}.`,
    `Stylisation: ${d.stylisation}. Detail: ${d.detail}.`,
  ].join(" ");
}

/** Shared negatives that keep every type in-world. */
export const VISUAL_DNA_NEGATIVE = [
  "flat vector", "flat 2d illustration", "clip art", "hard outline", "sticker",
  "photoreal", "photo texture noise", "plastic toy shine", "glossy plastic",
  "cold lighting", "clinical", "neon", "oversaturated", "harsh shadows", "uncanny",
];
