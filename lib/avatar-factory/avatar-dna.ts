import type { AvatarSpec } from "@/lib/avatar-factory/translator";

// ── Avatar DNA — full-body identity generation language + spec-level checks ────
//
// The avatar engine is IMAGE-TO-IMAGE from the user's uploaded photo (identity must be
// preserved), rendered as a simplified premium Nestudio figure. This module owns the
// frozen Avatar DNA prompt and deterministic pre-generation checks. Image-level identity
// + anatomy are the user's eye (the two approval questions) — this is a spec guard only.

// Portrait, cover-fit into the editor. Full-body figures read best tall.
export const AVATAR_GEN_SIZE = "1024x1536";
export const AVATAR_DNA_VERSION = "avatar-dna-v1";

const DNA_STYLE = [
  "a single FULL-BODY character avatar of the person in the photo, head to feet, standing naturally and centered",
  "Nestudio world: warm, minimal, timeless, premium; simplified premium shapes; soft matte shading",
  "recognisable, respectful likeness of the SAME person — NOT photoreal, NOT uncanny, NOT a caricature",
  "front-facing, eye-level, one canonical camera; feet flat with a clean bottom anchor on an invisible ground",
  "fully transparent background — no room, no floor, no props, no shadow baked in",
  "clean facial structure; clean hands and limbs; exactly five fingers per hand; correct anatomy",
].join("; ");

const DNA_NEGATIVE = [
  "extra fingers", "missing fingers", "malformed hands", "fused fingers", "extra limbs", "extra arms",
  "extra legs", "deformed anatomy", "distorted proportions", "mutated body", "photoreal skin", "uncanny",
  "photograph", "3d render", "room", "furniture", "background scene", "floor", "wall", "baked shadow",
  "multiple people", "duplicate person", "cropped body", "cut-off feet", "floating", "text", "letters",
  "logos", "watermark", "brand marks", "nsfw", "nudity",
].join(", ");

export function buildAvatarPrompt(spec: AvatarSpec): { positive: string; negative: string } {
  const accessories = spec.accessories.filter(Boolean).join(", ");
  const positive = [
    `Generate ${DNA_STYLE}.`,
    `Style intensity: ${spec.styleIntensity}. Outfit: ${spec.outfitCategory} in ${spec.clothingPalette}. Hair: ${spec.hair}. Expression: ${spec.expression}.`,
    `Body proportion family: ${spec.bodyProportionFamily}. Pose: idle standing, arms relaxed at the sides.`,
    accessories ? `Visible accessories: ${accessories}.` : "",
    spec.generationSubject ? `Neutral description: ${spec.generationSubject}.` : "",
    "Preserve the person's recognisable identity respectfully. Full body from head to feet, transparent background, no text or logos.",
  ].filter(Boolean).join(" ");
  return { positive, negative: DNA_NEGATIVE };
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
