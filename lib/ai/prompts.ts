/**
 * lib/ai/prompts.ts — the versioned prompt library.
 * -----------------------------------------------------------------------------
 * "Never concatenate prompt strings inside components." Every prompt is assembled
 * here from structured style tokens + intent, and every builder is VERSIONED:
 * `PROMPT_REGISTRY` maps `"<kind>@<version>"` → builder, and `ACTIVE_PROMPT_VERSION`
 * says which one is live per kind. A new prompt is a new version entry + a bump —
 * the engine never changes, and each asset records exactly which version made it
 * (`AssembledPrompt.promptVersion`). M21 ships furniture@2 (stronger consistency).
 */

import type { AssembledPrompt, PromptBuilder, PromptInput, StyleTokens } from "./types";
import { NESTUDIO_STYLE, mergeStyle } from "./style";

/** Shared assembly: subject + style descriptors + framing → positive/negative. */
export function buildBasePrompt(
  input: PromptInput,
  subjectClause: string,
  params: AssembledPrompt["params"],
  version = "custom@1",
  extraPositive: string[] = [],
): AssembledPrompt {
  const style: StyleTokens = mergeStyle(NESTUDIO_STYLE, input.style);
  const positive = [
    subjectClause,
    `in the ${style.name} style`,
    style.descriptors.join(", "),
    `palette: ${style.palette.join(", ")}`,
    style.lighting,
    style.framing,
    "on a fully transparent background, isolated, centered, no ground plane",
    ...extraPositive,
  ]
    .concat(input.notes ? [input.notes.trim()] : [])
    .join(". ");
  const negative = style.negative.join(", ");
  const tags = dedupe([input.kind, ...tokenize(input.subject)]);
  return {
    kind: input.kind,
    subject: input.subject,
    positive,
    negative,
    style,
    tags,
    params: { size: 1024, background: "transparent", ...params },
    promptVersion: version,
  };
}

/* ── Furniture / object builders (the enabled vertical) ────────────────────── */

const buildFurnitureV1: PromptBuilder = (input) =>
  buildBasePrompt(
    input,
    `A single ${input.subject || "piece of furniture"}, a cozy home object rendered as a clean placeable game asset`,
    { guidance: 7, subjectType: "object" },
    "furniture@1",
  );

// M21 — stronger style-consistency directives (Phase 3): explicit warm lighting,
// soft grounded shadow, matte finish, rounded premium proportions, front-facing,
// centered, no perspective distortion / floating shadow / background / text.
const buildFurnitureV2: PromptBuilder = (input) =>
  buildBasePrompt(
    input,
    `A single premium ${input.subject || "home object"}, one cozy Nestudio furniture asset`,
    { guidance: 7, subjectType: "object", relight: 0.22 },
    "furniture@2",
    [
      "warm key light from the upper-left with a soft, grounded contact shadow",
      "matte finish, rounded premium proportions, handcrafted feel",
      "front-facing three-quarter view, centered, no perspective distortion",
      "generous even margins, the whole object visible and not clipped",
    ],
  );

// M22 — the MASTER art-direction prompt. Every clause below is a locked Nestudio
// DNA rule, so a mug, a guitar and a plant come back as clearly one artist's hand.
//
//   Prompt version history & rationale
//   ─────────────────────────────────
//   v1  Baseline "clean placeable game asset" — read generic/AI, inconsistent
//       tone and framing across objects.
//   v2  Added explicit framing + lighting + shadow directives. Better, but still
//       drifted on saturation and material feel (some objects glossy/vivid).
//   v3  (this) LOCKED to a single design language: a named palette + saturation
//       ceiling ("gently desaturated, warm neutrals"), an explicit "no glossy
//       plastic / no exaggerated saturation / no unnecessary detail" ban, and a
//       "calm, premium, timeless, part of a matching set" framing so every asset
//       coheres with the rest of the collection — not just looks nice alone. The
//       tonal-lock params (saturation/warmth) travel with the prompt so the local
//       provider applies the SAME retune the hosted model is asked for.
const buildFurnitureV3: PromptBuilder = (input) =>
  buildBasePrompt(
    input,
    `A single ${input.subject || "home object"} as one asset in the Nestudio Classic collection — calm, premium and timeless, as if handcrafted by the Nestudio art team to sit beside their other objects`,
    // Tuned across the consistency test: a WHISPER of form-light (no diagonal sweep
    // on flat faces — the source art carries its own shading; the pipeline unifies
    // tone + shadow + matte) and warmer, fuller tone so neutrals stay parchment-family.
    { guidance: 7, subjectType: "object", relight: 0.07, saturation: 0.66, satCap: 0.56, warmth: 0.45 },
    "furniture@3",
    [
      "front-facing three-quarter view, perfectly centered, no perspective distortion",
      "soft warm key light from the upper-left, subtle ambient occlusion, one soft grounded contact shadow directly beneath (never floating)",
      "soft matte materials only — never glossy, never plastic, never chrome",
      "rounded forms and premium, restrained proportions; no unnecessary details",
      "gently desaturated warm-neutral palette (parchment, plaster, stone, one quiet accent), never exaggerated saturation",
      "generous even margins, whole object visible; transparent background; no text, no watermark, no shadow on any surface",
    ],
  );

/* ── Scaffolds for future studios (disabled in M20/M21) ────────────────────── */

export const buildDecorationPrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A small decorative ${input.subject || "trinket"} for a cozy home`, { guidance: 7, subjectType: "object" }, "decoration@1");

export const buildAvatarPrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A friendly character avatar of ${input.subject || "a person"}, warm and expressive`, { guidance: 6, subjectType: "character" }, "avatar@1");

export const buildBackgroundPrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A cozy room background: ${input.subject || "a warm interior"}`, { guidance: 6, subjectType: "scene", background: "opaque" }, "background@1");

export const buildHousePrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A cozy little house exterior: ${input.subject || "a storybook cottage"}`, { guidance: 7, subjectType: "structure" }, "house@1");

/* ── Registry + active versions ────────────────────────────────────────────── */

/** Every known prompt version, addressable by `"<kind>@<version>"`. */
export const PROMPT_REGISTRY: Record<string, PromptBuilder> = {
  "furniture@1": buildFurnitureV1,
  "furniture@2": buildFurnitureV2,
  "furniture@3": buildFurnitureV3,
  "decoration@1": buildDecorationPrompt,
  "avatar@1": buildAvatarPrompt,
  "background@1": buildBackgroundPrompt,
  "house@1": buildHousePrompt,
};

/** The live version per kind. Bumping this is how a prompt ships — no engine edit. */
export const ACTIVE_PROMPT_VERSION: Record<string, string> = {
  furniture: "furniture@3",
  decoration: "decoration@1",
  avatar: "avatar@1",
  background: "background@1",
  house: "house@1",
};

/** The active builder for a kind (optionally pin a specific version). */
export function getPromptBuilder(kind: string, version?: string): PromptBuilder {
  const key = version ?? ACTIVE_PROMPT_VERSION[kind];
  const builder = PROMPT_REGISTRY[key];
  if (!builder) throw new Error(`No prompt version registered: ${key}`);
  return builder;
}

/** Back-compat: active builder per kind (used by STUDIO_CONFIGS). */
export const PROMPT_BUILDERS: Record<string, PromptBuilder> = {
  furniture: getPromptBuilder("furniture"),
  decoration: getPromptBuilder("decoration"),
  avatar: getPromptBuilder("avatar"),
  background: getPromptBuilder("background"),
  house: getPromptBuilder("house"),
};

/** The active furniture builder (kept as a named export for tests/consumers). */
export const buildFurniturePrompt = getPromptBuilder("furniture");

/* ── small helpers ─────────────────────────────────────────────────────────── */

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
