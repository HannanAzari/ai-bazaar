// ── Avatar Translator — uploaded photo → structured, PRIVACY-SAFE avatar spec ──
//
// Mirrors the asset/nest translators, but for a real person's identity. The founder
// reviews/edits this BEFORE any expensive generation. Server route: app/api/ai/avatar/translate.
//
// PRIVACY LAW (hard): never infer, classify, store or expose ethnicity, religion,
// sexuality, health/disability, political identity, socioeconomic status. Do not guess
// age. Neutral visual descriptions only — the minimum needed to redraw the person as a
// Nestudio avatar.

// Reserved pose vocabulary. v1 GENERATES only "idle-standing"; the rest are reserved so future
// pose generation reuses the SAME frozen avatar identity/version (never redesigns the person).
export type AvatarPose = "idle-standing" | "seated" | "greeting" | "thinking" | "look-left" | "look-right" | "happy";
export const AVATAR_POSES: AvatarPose[] = ["idle-standing", "seated", "greeting", "thinking", "look-left", "look-right", "happy"];
export const AVATAR_V1_POSE: AvatarPose = "idle-standing";
export type StyleIntensity = "subtle" | "balanced" | "stylised";
export type AvatarUse = "profile" | "editor";

export type AvatarSpec = {
  displayName: string;
  styleIntensity: StyleIntensity;
  outfitCategory: string; // "casual", "smart-casual", "formal", "sporty"… (clothing kind, not identity)
  clothingPalette: string; // "warm neutrals", "navy + white"…
  hair: string; // neutral visual: length/style/colour — NOT ethnicity
  accessories: string[]; // "glasses", "cap", "watch" (visible items only)
  expression: string; // "neutral", "gentle smile"
  bodyProportionFamily: string; // "standard" | "slim" | "broad" — a proportion family, not a judgement
  canonicalPose: AvatarPose;
  transparency: true;
  intendedUses: AvatarUse[];
  privacyScope: "private-user";
  estimatedCostUsd: number;
  moderation: { ok: boolean; note: string };
  /** Neutral visual description handed to the generator. Describes clothing/hair/pose only. */
  generationSubject: string;
};

export const AVATAR_CAMERA_DNA_VERSION = "avatar-front-v1";

/** Reference/identity read (vision) + full-body generation from the photo. */
export const AVATAR_REFERENCE_COST = 0.17;
export const AVATAR_GENERATION_COST = 0.28;
export function estimateAvatarCost(): number {
  return Math.round((AVATAR_REFERENCE_COST + AVATAR_GENERATION_COST) * 100) / 100;
}

const STYLE_INTENSITIES: StyleIntensity[] = ["subtle", "balanced", "stylised"];

export function buildAvatarTranslatorSystemPrompt(): string {
  return [
    "You are the Nestudio Avatar Translator. You are shown ONE photo of a real person the user has permission to use. Produce a strict JSON spec to redraw them as a simplified, premium, full-body Nestudio avatar.",
    "",
    "PRIVACY LAW — you MUST obey:",
    "- NEVER infer, name, classify or output ethnicity, race, nationality, religion, sexuality, health or disability, political identity, or socioeconomic status.",
    "- Do NOT guess age or output an age/age-range.",
    "- Describe ONLY neutral, visible appearance needed to redraw the person: hair length/style/colour, clothing kind + colours, visible accessories, expression, and a broad body-proportion family (slim/standard/broad).",
    "- Do NOT describe skin tone as an identity marker; do not comment on attractiveness, body judgements, or any sensitive trait.",
    "",
    "STYLE: warm, minimal, timeless, premium; simplified shapes; recognisable but NOT photoreal, NOT a caricature. Full-body, standing naturally, transparent background, one front-facing camera.",
    `styleIntensity ∈ ${STYLE_INTENSITIES.join(", ")}.`,
    "Return ONLY a JSON object with keys: displayName, styleIntensity, outfitCategory, clothingPalette, hair, accessories (string array), expression, bodyProportionFamily, moderation {ok:boolean,note:string}, generationSubject.",
    "generationSubject: one neutral sentence describing the person's clothing, hair and pose to redraw — NO sensitive attributes, no age, no identity labels.",
    "moderation.ok=false for unsafe content (minors in unsafe contexts, explicit content, etc.).",
  ].join("\n");
}
