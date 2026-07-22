import type { NestSpec } from "@/lib/nest-factory/translator";

// ── Nest DNA — the empty-room generation language + a spec-level DNA score ────
//
// The image engine for Nests is TEXT-TO-IMAGE (no cutout/edit pass): there is no
// object to preserve, only architecture to author. This module owns the frozen
// Nest DNA prompt and a deterministic score of how well a spec obeys it.

// Portrait, cover-fit into the editor's canonical 3:4 stage. GPT Image's portrait
// size; the room is composed for a straight-on, eye-level, front-wall camera.
export const NEST_GEN_SIZE = "1024x1536";
export const NEST_DNA_VERSION = "nest-dna-v1";
/** The editor stage aspect the room is composed for (cover-fit). */
export const NEST_EDITOR_ASPECT = "3:4";

const DNA_STYLE = [
  "an EMPTY interior room — bare architectural stage, no furniture and no objects of any kind",
  "Nestudio world: warm, minimal, timeless, premium, inviting",
  "matte materials, soft diffuse lighting, gentle soft shadows, cohesive warm palette",
  "one canonical camera: straight-on, eye-level, centered, the front wall facing the viewer, no tilt, no fisheye, natural (not wide-angle) lens",
  "clean readable geometry, generous empty floor and wall space ready to be decorated later",
].join("; ");

// Everything a decoratable stage must NOT contain.
const DNA_NEGATIVE = [
  "furniture", "sofa", "couch", "chair", "stool", "desk", "table", "bed", "shelf", "bookshelf",
  "cabinet", "wardrobe", "rug", "carpet", "lamp", "plant", "flowers", "vase", "artwork", "paintings",
  "posters", "picture frames", "decorations", "ornaments", "clutter", "props", "electronics", "TV",
  "people", "person", "human", "figure", "pet", "animal",
  "text", "letters", "words", "captions", "labels", "logos", "watermark", "signage", "brand",
  "photoreal clutter", "messy", "fisheye", "tilted horizon", "warped corners", "floating walls",
].join(", ");

export function buildNestPrompt(spec: NestSpec): { positive: string; negative: string } {
  const details = spec.architecturalDetails.filter(Boolean).join(", ");
  const positive = [
    `Generate ${DNA_STYLE}.`,
    `Room type: ${spec.category}. Mood: ${spec.mood}. Architectural style: ${spec.architecturalStyle}.`,
    `Walls: ${spec.walls} configuration. Floor: ${spec.floorMaterial}. Ceiling: ${spec.ceiling}. Windows: ${spec.windows}.`,
    `Palette: ${spec.palette}. Lighting: ${spec.lighting} (${spec.timeOfDay}).`,
    details ? `Architectural details: ${details}.` : "",
    spec.generationSubject ? `Scene: ${spec.generationSubject}.` : "",
    "The room MUST be completely empty of furniture, objects, people and text — architecture only.",
  ].filter(Boolean).join(" ");
  return { positive, negative: DNA_NEGATIVE };
}

const FURNITURE_WORDS = /\b(sofa|couch|chair|desk|table|bed|shelf|lamp|plant|rug|tv|television|poster|painting|art|people|person|man|woman|furniture|decor)\b/i;
const WARM_WORDS = /\b(warm|matte|soft|minimal|timeless|premium|inviting|cozy|calm|muted|natural)\b/i;

/**
 * Deterministic DNA adherence score for a spec (0–1) with human-readable checks.
 * This scores the SPEC, not the pixels — an honest pre-generation signal that the
 * request stays inside the Nest language. (Image-level review is the founder's eye.)
 */
export function scoreNestDna(spec: NestSpec): { score: number; checks: { label: string; ok: boolean }[] } {
  const subject = `${spec.generationSubject} ${spec.architecturalDetails.join(" ")}`;
  const moodPalette = `${spec.mood} ${spec.palette} ${spec.lighting}`;
  const checks = [
    { label: "Canonical camera", ok: spec.compatibilityVersion === "front-facing-v1" },
    { label: "Walls defined", ok: Boolean(spec.walls) && Boolean(spec.floorMaterial) },
    { label: "Empty (no furniture in prompt)", ok: !FURNITURE_WORDS.test(subject) },
    { label: "Warm / matte / minimal tone", ok: WARM_WORDS.test(moodPalette) },
    { label: "Brand-neutral", ok: spec.brandNeutral.ok !== false },
    { label: "Safe", ok: spec.moderation.ok !== false },
  ];
  const score = checks.filter((c) => c.ok).length / checks.length;
  return { score: Math.round(score * 100) / 100, checks };
}
