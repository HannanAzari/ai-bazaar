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
// TWO visual references (architecture correction): the ORIGINAL PHOTO answers WHO (primary
// likeness), the APPROVED IDENTITY REFERENCE answers HOW THEY APPEAR IN NESTUDIO (hair
// treatment, face stylisation, material/lighting). The approved portrait is NOT "pixel-locked"
// — generation may still redraw it, so the original photo stays in the request as the highest
// identity authority. Keep the face; build the body beneath it.
export function buildCharacterAssemblyPrompt(body: AvatarBody, style: AvatarStylePreset): { positive: string; negative: string } {
  const s = STYLE_PRESETS[style];
  const positive = [
    visualDnaFragment(), // the shared Nestudio world — read-only
    "Two references are provided: (1) the ORIGINAL PHOTO — the real person, HIGHEST identity priority; (2) the APPROVED IDENTITY REFERENCE — the agreed Nestudio interpretation of their face, hair treatment, material and lighting.",
    "Preserve the person from the ORIGINAL PHOTO and the approved stylised face from the APPROVED IDENTITY REFERENCE. Build a FULL-BODY Nestudio character beneath the approved identity. Do NOT redesign the person.",
    "Do not broaden the face, do not round the cheeks, do not thicken the neck, do not enlarge the head, do not substitute generic mascot eyes, do not substitute a generic smile.",
    `Body — adult proportions, built from the selected profile (never inferred from the head): build ${body.build}, ${body.height} height, ${body.shoulders} shoulders, ${body.legLength} legs, ${body.armLength} arms; ${body.stance}. Head roughly 10% smaller than a typical one-shot result, legs long relative to the torso; no childlike or wide-torso defaults.`,
    `Presentation — ${style}: ${s.palette}; ${s.expression}; ${s.posture}. Presentation only — do NOT change identity or body build.`,
    "Idle standing, arms relaxed, feet flat with a clean bottom anchor. Fully transparent background. Clean five-finger hands, correct anatomy.",
  ].join(" ");
  const negative = [
    "changing the face", "different face", "regenerated face", "generic face", "rounded mascot", "cute-ified", "chibi",
    "broadened face", "rounded cheeks", "thick neck", "enlarged head", "oversized head", "childlike proportions", "wide torso",
    "extra fingers", "malformed hands", "extra limbs", "deformed anatomy", "cropped", "cut-off feet",
    "room", "furniture", "background", "floor", "wall", "baked ground shadow", "text", "logos", "photoreal", "flat vector", "plastic",
  ].join(", ");
  return { positive, negative };
}

// ── Dual-reference contract ───────────────────────────────────────────────────
// Stage 2 REQUIRES both references, ordered by identity authority. Throws if either is
// missing — the workflow must never silently fall back to a single reference.
export const STAGE2_REFERENCE_ROLES = ["original-photo", "approved-identity"] as const;

export function assembleReferences(originalPhotoUrl?: string | null, approvedIdentityUrl?: string | null): [string, string] {
  if (!originalPhotoUrl) throw new Error("Stage 2 requires the ORIGINAL PHOTO (primary likeness reference).");
  if (!approvedIdentityUrl) throw new Error("Stage 2 requires the APPROVED IDENTITY REFERENCE.");
  return [originalPhotoUrl, approvedIdentityUrl];
}

// ── Body proportion safety ────────────────────────────────────────────────────
// A head-and-shoulders photo carries NO reliable body signal. Build must be an explicit
// founder/user choice (or a full-body reference) — never inferred from a headshot.
export const AVATAR_BUILDS: AvatarBuild[] = ["slim", "average", "athletic", "broad", "curvy"];

export const PROPORTION_POLICY = {
  inferBuildFromHeadshot: false, // NEVER — the #1 cause of "short and rounded" defaults
  childlikeByDefault: false,
  headScaleVsOneShot: 0.9, // ~10% smaller head than current one-shot results
  legsRelativeToTorso: "long",
  autoWideTorso: false,
  autoThickNeck: false,
} as const;

/** Resolve a body from an EXPLICIT build selection. Never reads an image; never guesses. */
export function resolveAvatarBody(build: AvatarBuild, opts?: { fullBodyReference?: boolean }): AvatarBody {
  const broad = build === "broad" || build === "athletic";
  return {
    version: AVATAR_BODY_VERSION,
    build,
    height: "average",
    shoulders: broad ? "broad" : "average",
    legLength: "long", // adult proportions — legs long relative to the torso
    armLength: "average",
    stance: opts?.fullBodyReference
      ? "natural adult stance consistent with the full-body reference"
      : "natural, upright adult stance, weight even, arms resting at the sides",
  };
}

// ── FREEZE ── an approved identity, ready to be reused for every future generation.
export type IdentityApproval = {
  approvedBy: "founder" | "user";
  approvedByUserId: string; // owner scope — a frozen identity is always owned; never anonymous
  at: string; // ISO timestamp (caller-supplied)
};

export type FrozenIdentity = AvatarIdentity & { frozen: true; approval: IdentityApproval };

export class IdentityFreezeError extends Error {}

/**
 * Freeze a candidate into an approved identity. Requires EXPLICIT approval with an owner, and
 * refuses to silently overwrite an identity that is already frozen (create a new one instead).
 */
export function freezeIdentity(
  candidate: AvatarIdentity,
  approval: IdentityApproval | null | undefined,
  opts?: { existing?: AvatarIdentity | null },
): FrozenIdentity {
  if (opts?.existing?.frozen) {
    throw new IdentityFreezeError("This identity is already frozen — create a new identity rather than silently overwriting the approved one.");
  }
  if (!approval || !approval.approvedByUserId) {
    throw new IdentityFreezeError("An identity cannot be frozen without explicit founder/user approval.");
  }
  return { ...candidate, frozen: true, approval };
}

// ── COMPOSE ── the full Stage-2 request. Style is presentation only: it never mutates the
// frozen identity or the chosen body. Returned identity/body are the exact inputs (proof of
// separation). References are required and ordered by authority.
export type AssemblyRequest = {
  positive: string;
  negative: string;
  references: [string, string]; // [original photo, approved identity]
  referenceRoles: typeof STAGE2_REFERENCE_ROLES;
  identity: AvatarIdentity;
  body: AvatarBody;
  style: AvatarStylePreset;
  pose: "idle-standing";
};

export function composeAssembly(params: {
  identity: AvatarIdentity;
  body: AvatarBody;
  style: AvatarStylePreset;
  originalPhotoUrl?: string | null;
  approvedIdentityUrl?: string | null;
}): AssemblyRequest {
  const references = assembleReferences(params.originalPhotoUrl, params.approvedIdentityUrl);
  const { positive, negative } = buildCharacterAssemblyPrompt(params.body, params.style);
  return {
    positive,
    negative,
    references,
    referenceRoles: STAGE2_REFERENCE_ROLES,
    identity: params.identity, // passed through untouched — presets never change identity
    body: params.body, // passed through untouched — presets never change build
    style: params.style,
    pose: "idle-standing",
  };
}
