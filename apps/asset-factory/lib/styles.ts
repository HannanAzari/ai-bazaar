import { MASTER_PROMPT, NEGATIVE_PROMPT, CATEGORY_PROMPTS } from "@/lib/prompts";
import { type FactoryCategory } from "@/lib/types";

// Multi-style calibration (V3.2). Three candidate visual identities to compare
// before mass generation. Every family shares the SAME hard rules (the master
// spine: single isolated object, transparent PNG, 30° isometric, no props) and the
// SAME universal negative prompt — they differ only in rendering *descriptors* and
// style tokens. References (Royal Match / Clash) are QUALITY references only; we
// never mimic copyrighted art.

export type StyleFamilyId = "royal_match" | "modern_designer" | "clash";

export type StyleFamily = {
  id: StyleFamilyId;
  name: string;
  shortLabel: string;
  description: string;
  /** Style-specific rendering phrase appended after the shared spine. */
  descriptors: string;
  tokens: string[];
};

export const STYLE_FAMILIES: StyleFamily[] = [
  {
    id: "royal_match",
    name: "Royal Match Inspired",
    shortLabel: "Royal Match",
    description: "Glossy, colorful, rounded, playful — premium casual game art.",
    descriptors:
      "glossy colorful premium-casual game art, vibrant saturated palette, smooth rounded forms, " +
      "soft plastic-like sheen, cheerful and inviting, playful polish",
    tokens: ["glossy", "colorful", "playful", "rounded", "premium casual"],
  },
  {
    id: "modern_designer",
    name: "Modern Designer",
    shortLabel: "Modern",
    description: "Apple-like, minimalist, clean materials — premium furniture catalog.",
    descriptors:
      "minimalist modern designer catalog look, Apple-like clean materials, refined matte surfaces with subtle gloss, " +
      "neutral sophisticated palette, premium furniture presentation, understated elegance",
    tokens: ["minimalist", "clean materials", "matte finish", "modern", "designer catalog"],
  },
  {
    id: "clash",
    name: "Clash Inspired",
    shortLabel: "Clash",
    description: "Chunky, toy-like, bold silhouettes — highly readable game collectible.",
    descriptors:
      "chunky toy-like collectible, bold exaggerated silhouette, thick rounded forms, strong readable shapes, " +
      "hand-crafted stylized game-art finish, slightly oversized proportions",
    tokens: ["chunky", "toy-like", "bold silhouette", "highly readable", "collectible"],
  },
];

export const STYLE_FAMILY_IDS: StyleFamilyId[] = STYLE_FAMILIES.map((s) => s.id);
export const DEFAULT_STYLE_FAMILY: StyleFamilyId = "royal_match";

export function isStyleFamily(value: string): value is StyleFamilyId {
  return (STYLE_FAMILY_IDS as string[]).includes(value);
}

export function getStyleFamily(id: string): StyleFamily {
  return STYLE_FAMILIES.find((s) => s.id === id) ?? STYLE_FAMILIES[0];
}

export function styleLabel(id: string): string {
  return getStyleFamily(id).shortLabel;
}

/**
 * Compose a style-specific prompt. Always begins with the shared master spine, so
 * every family keeps the hard rules; the family descriptors + tokens steer the
 * look. The negative prompt is universal (see NEGATIVE_PROMPT).
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
