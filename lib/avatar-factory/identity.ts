// ── Avatar Identity Engine v1 — separate WHO from HOW ─────────────────────────
//
// The one-shot generator collapses everyone into one friendly mascot: good materials,
// generic faces. The fix is to make IDENTITY a first-class object and generate in two
// stages so the face stops being re-invented on every render.
//
//   Stage 1 · Identity Capture:  photo → head/face only → an approved AvatarIdentity
//             (the resemblance ANCHOR is the approved head image, not just text).
//   Stage 2 · Character Assembly: approved identity + AvatarBody + style + Visual DNA
//             → full body. The face is NOT negotiable; the body adapts to the face.
//
// This module owns the contracts + the two stage prompts. It does NOT touch the shared
// prompt compiler, GenerationStudio, or Visual DNA — it only READS visualDnaFragment for
// Stage 2 (the shared world the character must live in).

import { visualDnaFragment } from "@/lib/visual-dna";

export const AVATAR_IDENTITY_VERSION = "avatar-identity-v1";
export const AVATAR_BODY_VERSION = "avatar-body-v1";

// ── WHO ── the immutable-once-approved identity (Stage 1 output).
export type AvatarIdentity = {
  version: string;
  /** The approved head-only image — THE key to resemblance (Stage 2 conditions on this). */
  anchorImageUrl: string | null;
  faceShape: string;
  eyeShape: string;
  eyebrowShape: string;
  nose: string;
  mouth: string;
  smile: string;
  hairstyle: string;
  hairColour: string;
  facialHair: string; // "none" if absent
  glasses: string; // "none" if absent
  ears: string;
  neck: string;
  skinTone: string; // neutral visual descriptor for resemblance — never an ethnicity label
  distinguishingFeatures: string[];
  expression: string;
  /** Once true, the identity is frozen; future poses reuse it, never regenerate the face. */
  frozen: boolean;
};

// ── HOW (proportions) ── independent of identity. "rounded" ≠ "cute".
export type AvatarBuild = "slim" | "average" | "athletic" | "broad" | "curvy";
export type AvatarBody = {
  version: string;
  build: AvatarBuild;
  height: "short" | "average" | "tall";
  shoulders: "narrow" | "average" | "broad";
  legLength: "short" | "average" | "long";
  armLength: "short" | "average" | "long";
  stance: string; // natural stance
};

export const DEFAULT_AVATAR_BODY: AvatarBody = {
  version: AVATAR_BODY_VERSION,
  build: "average", height: "average", shoulders: "average", legLength: "average", armLength: "average",
  stance: "relaxed, weight even, arms resting naturally at the sides",
};

// ── HOW (presentation) ── style changes presentation only, never identity.
export type AvatarStylePreset = "soft" | "balanced" | "bold";
export const STYLE_PRESETS: Record<AvatarStylePreset, { palette: string; expression: string; posture: string }> = {
  soft: { palette: "a softer, gentler warm palette", expression: "a relaxed, gentle smile", posture: "a calm, relaxed posture" },
  balanced: { palette: "a neutral, true-to-life warm palette", expression: "a natural, easy expression", posture: "an upright, easy stance" },
  bold: { palette: "richer, more saturated warm colours", expression: "a confident, self-assured expression", posture: "a stronger, grounded, confident stance with a clearer silhouette" },
};

// ── STAGE 1 · Identity Capture ────────────────────────────────────────────────
// Head only. The whole job: "would someone who knows this person recognise them?"
export function buildIdentityCapturePrompt(): { positive: string; negative: string } {
  const positive = [
    "A head-and-shoulders portrait of the SAME person in the photo — this stage captures IDENTITY only.",
    "Preserve their exact face shape, eye shape, eyebrows, nose, mouth and natural smile, hairstyle, hair colour, ears, neck, facial hair, glasses and skin tone — it must be UNMISTAKABLY this person.",
    "Soften into a warm, premium Nestudio character (matte, soft light, gentle volume) WITHOUT losing the likeness — resemblance beats stylisation here.",
    "Head, face, hair and neckline ONLY. Transparent background. No body, no clothing below the neckline, no pose, no hands.",
    "Front-facing, eye-level, calm neutral-to-warm expression.",
  ].join(" ");
  const negative = [
    "generic face", "different person", "changed features", "beautified", "idealised face", "average face",
    "body", "full body", "torso", "shoulders down", "clothing", "hands", "arms", "pose",
    "photoreal", "flat vector", "plastic", "dead eyes", "doll eyes", "background", "text", "logos",
  ].join(", ");
  return { positive, negative };
}

// ── STAGE 2 · Character Assembly ──────────────────────────────────────────────
// The approved head image is the primary input (image-to-image). Keep the face; build the body.
export function buildCharacterAssemblyPrompt(body: AvatarBody, style: AvatarStylePreset): { positive: string; negative: string } {
  const s = STYLE_PRESETS[style];
  const positive = [
    visualDnaFragment(), // the shared Nestudio world — read-only
    "Build a FULL-BODY Nestudio character BELOW the provided head. The face, hair and head from the reference are FIXED — keep them EXACTLY, do not restyle, re-proportion or regenerate the face.",
    `Body (adapt to the face, do not round it into a mascot): build ${body.build}, ${body.height} height, ${body.shoulders} shoulders, ${body.legLength} legs, ${body.armLength} arms; ${body.stance}.`,
    `Presentation — ${style}: ${s.palette}; ${s.expression}; ${s.posture}. Presentation only — do NOT change the identity.`,
    "Idle standing, arms relaxed, feet flat with a clean bottom anchor. Fully transparent background. Clean five-finger hands, correct anatomy.",
  ].join(" ");
  const negative = [
    "changing the face", "different face", "regenerated face", "generic face", "rounded mascot", "cute-ified", "chibi",
    "extra fingers", "malformed hands", "extra limbs", "deformed anatomy", "cropped", "cut-off feet",
    "room", "furniture", "background", "floor", "wall", "baked ground shadow", "text", "logos", "photoreal", "flat vector", "plastic",
  ].join(", ");
  return { positive, negative };
}
