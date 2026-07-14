/**
 * lib/ai/prompts.ts — modular prompt builders.
 * -----------------------------------------------------------------------------
 * "Never concatenate prompt strings inside components." Every prompt is assembled
 * here from structured style tokens + intent. There is one builder per asset kind;
 * they all share `buildBasePrompt`, so adding Avatar/Background/House later is a
 * ~10-line builder, not a rewrite.
 *
 * `PROMPT_BUILDERS` is the registry the engine reads — a studio references its
 * builder by kind and never touches raw strings.
 */

import type { AssembledPrompt, PromptBuilder, PromptInput, StyleTokens } from "./types";
import { NESTUDIO_STYLE, mergeStyle } from "./style";

/** Shared assembly: subject + style descriptors + framing → positive/negative. */
export function buildBasePrompt(input: PromptInput, subjectClause: string, params: AssembledPrompt["params"]): AssembledPrompt {
  const style: StyleTokens = mergeStyle(NESTUDIO_STYLE, input.style);
  const positive = [
    subjectClause,
    `in the ${style.name} style`,
    style.descriptors.join(", "),
    `palette: ${style.palette.join(", ")}`,
    style.lighting,
    style.framing,
    "on a fully transparent background, isolated, centered, no ground plane",
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
  };
}

/** Furniture / object generation — the one enabled vertical in M20. */
export const buildFurniturePrompt: PromptBuilder = (input) =>
  buildBasePrompt(
    input,
    `A single ${input.subject || "piece of furniture"}, a cozy home object rendered as a clean placeable game asset`,
    { guidance: 7, subjectType: "object" },
  );

/**
 * Scaffolds for future studios — registered so the shape is proven, but their
 * studios are disabled in M20. Each is intentionally a thin wrapper over
 * `buildBasePrompt`: that is the whole point of the architecture.
 */
export const buildDecorationPrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A small decorative ${input.subject || "trinket"} for a cozy home`, { guidance: 7, subjectType: "object" });

export const buildAvatarPrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A friendly character avatar of ${input.subject || "a person"}, warm and expressive`, { guidance: 6, subjectType: "character" });

export const buildBackgroundPrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A cozy room background: ${input.subject || "a warm interior"}`, { guidance: 6, subjectType: "scene", background: "opaque" });

export const buildHousePrompt: PromptBuilder = (input) =>
  buildBasePrompt(input, `A cozy little house exterior: ${input.subject || "a storybook cottage"}`, { guidance: 7, subjectType: "structure" });

/** The registry the engine dispatches through. */
export const PROMPT_BUILDERS: Record<string, PromptBuilder> = {
  furniture: buildFurniturePrompt,
  decoration: buildDecorationPrompt,
  avatar: buildAvatarPrompt,
  background: buildBackgroundPrompt,
  house: buildHousePrompt,
};

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
