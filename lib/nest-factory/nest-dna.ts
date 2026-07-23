import type { NestSpec } from "@/lib/nest-factory/translator";
import { compileNestPrompt } from "@/lib/art-engine/compiler";

// ── Nest DNA — SUBJECT clauses only; the shared world + type style come from the Art
// Engine compiler (lib/art-engine). No visual-style prose lives here anymore.

// Portrait, cover-fit into the editor's canonical 3:4 stage.
export const NEST_GEN_SIZE = "1024x1536";
export const NEST_DNA_VERSION = "nest-dna-v1";
/** The editor stage aspect the room is composed for (cover-fit). */
export const NEST_EDITOR_ASPECT = "3:4";

export function buildNestPrompt(spec: NestSpec): { positive: string; negative: string } {
  const details = spec.architecturalDetails.filter(Boolean).join(", ");
  const subject = [
    `Room type: ${spec.category}. Mood: ${spec.mood}. Architectural style: ${spec.architecturalStyle}.`,
    `Walls: ${spec.walls} configuration. Floor: ${spec.floorMaterial}. Ceiling: ${spec.ceiling}. Windows: ${spec.windows}.`,
    `Palette: ${spec.palette}. Lighting: ${spec.lighting} (${spec.timeOfDay}).`,
    details ? `Architectural details: ${details}.` : "",
    spec.generationSubject ? `Scene: ${spec.generationSubject}.` : "",
  ];
  const compiled = compileNestPrompt(subject);
  return { positive: compiled.positive, negative: compiled.negative };
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
