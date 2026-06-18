import { MASTER_PROMPT, NEGATIVE_PROMPT, CATEGORY_PROMPTS, STYLE_TOKENS, NESTUDIO_DNA } from "@/lib/prompts";
import { type FactoryCategory } from "@/lib/types";

// Nestudio Master Style V2 (V3.4). The multi-style experiments (royal_match /
// modern_designer / clash) are RETIRED — we now calibrate ONE locked identity:
// `nestudio_v2`. The "family" surface is kept (as a single entry) so generation
// plumbing, jobs, and the UI keep working unchanged while there is exactly one
// style to pick. The hard camera + object rules live in lib/nestudio-spec.ts and
// are folded into MASTER_PROMPT; this module just carries the style descriptors +
// tokens and composes per-category prompts.

export type StyleFamilyId = "nestudio_v2";

export type StyleFamily = {
  id: StyleFamilyId;
  name: string;
  shortLabel: string;
  description: string;
  /** Style-specific rendering phrase appended after the shared spine. */
  descriptors: string;
  tokens: string[];
};

export const NESTUDIO_V2: StyleFamily = {
  id: "nestudio_v2",
  name: "Nestudio Master Style V2",
  shortLabel: "Nestudio V2",
  description:
    "Premium collectible room objects with a modern Scandinavian DNA — soft rounded geometry, " +
    "tactile natural materials, warm cohesive palette, one shared lighting signature. " +
    "Same world, different personality. Not toy-like, not puffy, not realistic, not icon-pack.",
  // V3.5 — the identity layer is the Nestudio DNA itself (not a generic "neutral
  // premium palette"). Personality varies per-object via the subject, never here.
  descriptors: NESTUDIO_DNA,
  tokens: STYLE_TOKENS,
};

export const STYLE_FAMILIES: StyleFamily[] = [NESTUDIO_V2];

export const STYLE_FAMILY_IDS: StyleFamilyId[] = STYLE_FAMILIES.map((s) => s.id);
export const DEFAULT_STYLE_FAMILY: StyleFamilyId = "nestudio_v2";

export function isStyleFamily(value: string): value is StyleFamilyId {
  return value === "nestudio_v2";
}

export function getStyleFamily(id: string): StyleFamily {
  return STYLE_FAMILIES.find((s) => s.id === id) ?? NESTUDIO_V2;
}

export function styleLabel(id: string): string {
  return getStyleFamily(id).shortLabel;
}

/**
 * Compose the Nestudio V2 prompt. Always begins with the shared master spine (which
 * already carries the locked camera + object rules), then the style descriptors and
 * tokens. The negative prompt is universal (see NEGATIVE_PROMPT).
 */
export function buildStyledPrompt(
  category: FactoryCategory,
  styleId: string,
  options: { subject?: string; extra?: string } = {},
): string {
  const family = getStyleFamily(styleId);
  const subject = options.subject?.trim() || CATEGORY_PROMPTS[category];
  const parts = [MASTER_PROMPT, subject, family.descriptors];
  if (options.extra?.trim()) parts.push(options.extra.trim());
  parts.push(family.tokens.join(", "));
  return parts.join(", ");
}

export type StyledPrompt = {
  styleId: StyleFamilyId;
  category: FactoryCategory;
  prompt: string;
  negativePrompt: string;
};

export function buildStyledPromptPair(
  category: FactoryCategory,
  styleId: string,
  options: { subject?: string; extra?: string } = {},
): StyledPrompt {
  return {
    styleId: getStyleFamily(styleId).id,
    category,
    prompt: buildStyledPrompt(category, styleId, options),
    negativePrompt: NEGATIVE_PROMPT,
  };
}

/** A subject-less master preview for the UI (master spine + family descriptors). */
export function styleMasterPreview(styleId: string): string {
  const family = getStyleFamily(styleId);
  return `${MASTER_PROMPT} ${family.descriptors}.`;
}
