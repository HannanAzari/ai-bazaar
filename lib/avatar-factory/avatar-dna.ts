import type { AvatarSpec } from "@/lib/avatar-factory/translator";
import { VISUAL_DNA_NEGATIVE, visualDnaFragment } from "@/lib/visual-dna";

// ── Avatar DNA — full-body identity generation language + spec-level checks ────
//
// The avatar engine is IMAGE-TO-IMAGE from the user's uploaded photo (identity must be
// preserved), rendered as a simplified premium Nestudio figure. This module owns the
// frozen Avatar DNA prompt and deterministic pre-generation checks. Image-level identity
// + anatomy are the user's eye (the two approval questions) — this is a spec guard only.

// Portrait, cover-fit into the editor. Full-body figures read best tall.
export const AVATAR_GEN_SIZE = "1024x1536";
// v2 = the premium soft-3D art direction (replaces the rejected flat-vector v1). The style
// is calibrated + founder-approved in the Avatar Calibration Lab BEFORE user generation.
export const AVATAR_DNA_VERSION = "avatar-dna-v2-3d";

// The approved Nestudio character direction: a soft, premium, stylised 3D character —
// Pixar/Nintendo emotional readability, NOT flat vector, NOT photoreal, NOT chibi.
const DNA_STYLE = [
  "a single FULL-BODY stylised 3D character portrait of the SAME person in the photo, head to feet, standing naturally and centered",
  "soft premium 3D character art (Pixar / Nintendo emotional warmth) — rounded, sculpted, dimensional forms with gentle volume",
  "large expressive but believable eyes with soft catchlights; clean sculpted face; warm friendly readable expression",
  "dimensional sculpted hair with real volume and soft strands (never a flat colour block); simplified but rich clothing folds",
  "warm matte materials, subtle ambient occlusion, soft cinematic studio lighting, gentle rim light, soft form shadows on the body",
  "believable natural proportions (adult, NOT chibi, NOT toy proportions unless requested); strong clear silhouette; readable at small editor size",
  "recognisable respectful likeness — clearly the same person — stylised, NOT photoreal, NOT flat vector, NOT clip-art, NOT uncanny",
  "front-facing, eye-level, one canonical camera; feet flat with a clean bottom anchor on an invisible ground",
  "fully transparent background — no room, no floor, no props; no baked cast shadow on the ground",
  "clean hands and limbs; exactly five fingers per hand; correct anatomy",
].join("; ");

const DNA_NEGATIVE = [
  "flat vector", "flat 2d illustration", "flat colour blocks", "clip art", "sticker", "logo mark", "minimal line art",
  "cel-shaded flat", "generic avatar", "default character", "photograph", "photoreal skin pores", "uncanny",
  "chibi", "super-deformed", "toy proportions", "big head tiny body",
  "extra fingers", "missing fingers", "malformed hands", "fused fingers", "extra limbs", "extra arms", "extra legs",
  "deformed anatomy", "distorted proportions", "mutated body",
  "room", "furniture", "background scene", "floor", "wall", "baked ground shadow",
  "multiple people", "duplicate person", "cropped body", "cut-off feet", "floating", "text", "letters",
  "logos", "watermark", "brand marks", "nsfw", "nudity",
].join(", ");

export function buildAvatarPrompt(spec: AvatarSpec): { positive: string; negative: string } {
  const accessories = spec.accessories.filter(Boolean).join(", ");
  // styleIntensity nudges how far from photo → stylised, without changing identity.
  const intensity =
    spec.styleIntensity === "subtle" ? "keep stylisation gentle — very close to the real person, just softened and sculpted"
    : spec.styleIntensity === "stylised" ? "push the premium 3D stylisation further while keeping a clear likeness"
    : "balanced premium 3D stylisation with a clear likeness";
  const positive = [
    visualDnaFragment(), // the shared Nestudio world — same as Assets + Empty Nests
    `Generate ${DNA_STYLE}.`,
    `${intensity}.`,
    // IDENTITY PRESERVATION (Part 3): the photo is the identity input, not mere inspiration.
    "IDENTITY: use the uploaded photo as the identity source. Preserve the person's face shape, hairstyle, hair colour, visible glasses/accessories, facial hair as-is, general expression, skin appearance, and body type. Do NOT change apparent gender presentation, do NOT remove glasses, do NOT invent facial hair, do NOT swap the hairstyle for a generic one, do NOT alter skin tone.",
    `Outfit: ${spec.outfitCategory} in ${spec.clothingPalette}. Hair: ${spec.hair}. Expression: ${spec.expression}.`,
    `Body proportion family: ${spec.bodyProportionFamily}. Pose: idle standing, arms relaxed at the sides.`,
    accessories ? `Keep these visible accessories: ${accessories}.` : "",
    spec.generationSubject ? `Neutral description: ${spec.generationSubject}.` : "",
    "Full body from head to feet, transparent background, no text or logos.",
  ].filter(Boolean).join(" ");
  const negative = Array.from(new Set([...VISUAL_DNA_NEGATIVE, ...DNA_NEGATIVE.split(", ")])).join(", ");
  return { positive, negative };
}

// Words that would signal a sensitive-attribute leak into the neutral description.
const SENSITIVE_LEAK = /\b(ethnic|race|racial|nationality|religio|christian|muslim|jewish|hindu|buddhist|gay|lesbian|straight|sexual|disab|wheelchair|liberal|conservative|republican|democrat|wealthy|poor|age\s*\d|years?\s*old|\b\d{1,2}\s*yo\b)/i;

export function scoreAvatarDna(spec: AvatarSpec): { score: number; checks: { label: string; ok: boolean }[] } {
  const subject = `${spec.generationSubject} ${spec.hair} ${spec.outfitCategory} ${spec.accessories.join(" ")}`;
  const checks = [
    { label: "Idle-standing pose", ok: spec.canonicalPose === "idle-standing" },
    { label: "Transparent + full-body", ok: spec.transparency === true },
    { label: "Private (owner-scoped)", ok: spec.privacyScope === "private-user" },
    { label: "No sensitive attributes", ok: !SENSITIVE_LEAK.test(subject) },
    { label: "Safe", ok: spec.moderation.ok !== false },
  ];
  const score = checks.filter((c) => c.ok).length / checks.length;
  return { score: Math.round(score * 100) / 100, checks };
}
