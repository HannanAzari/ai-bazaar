// Nestudio Master Style V2 — locked specs (V3.4).
//
// Two hard, immutable rule-sets that EVERY generated calibration asset must obey:
//   • Nestudio Camera Spec V1   (Task 2) — one camera for the whole catalog.
//   • Nestudio Object Rules V1  (Task 3) — exactly one isolated object, nothing else.
//
// These are the single source of truth for the camera + object language baked into
// the master prompt (lib/prompts.ts). They are expressed as (a) human-readable rule
// lists for the docs/UI, (b) prompt fragments folded into the master prompt, and
// (c) forbidden-token sets so tests can prove a prompt never re-opens a banned door
// (floors, pedestals, scenes, extra props, random perspective, …).

export type RuleSpec = {
  id: string;
  name: string;
  /** Human-readable, one rule per line — shown in docs + the calibration UI. */
  rules: string[];
  /** The exact phrasing folded into the master prompt. */
  promptFragment: string;
  /** Tokens that, if present in a positive prompt, VIOLATE the spec. */
  forbidden: string[];
};

// ── Task 2 — Nestudio Camera Spec V1 ─────────────────────────────────────────
// One camera. Same perspective, scale, and framing for every object so the whole
// catalog reads as a single set.
export const NESTUDIO_CAMERA_SPEC_V1: RuleSpec = {
  id: "nestudio_camera_v1",
  name: "Nestudio Camera Spec V1",
  rules: [
    "3/4 isometric view",
    "approximately 30-degree downward angle",
    "object fills most of the frame",
    "object centered in frame",
    "no cropping — the whole object is visible",
    "no pedestal, no floor, no ground plane",
    "no environment, no room scene",
    "no shadow platform or shadow catcher",
    "identical camera, scale, and framing across every object",
  ],
  // Positive phrasing only — the "no floor / no pedestal" language lives in the
  // negative prompt + the forbidden list, so this fragment never trips the detector.
  promptFragment:
    "Consistent 3/4 isometric camera at roughly a 30-degree downward angle, " +
    "the object centered and filling most of the frame, fully in view. " +
    "Identical camera, scale, and framing for every asset.",
  forbidden: [
    "front view",
    "side view",
    "top-down",
    "random perspective",
    "dramatic perspective",
    "cropped",
    "pedestal",
    "platform",
    "floor plane",
    "ground plane",
    "shadow platform",
    "shadow catcher",
    "room scene",
    "environment",
  ],
};

// ── Task 3 — Nestudio Object Rules V1 ────────────────────────────────────────
// Exactly ONE object. A chair is the chair — never chair + lamp + rug + side table.
export const NESTUDIO_OBJECT_RULES_V1: RuleSpec = {
  id: "nestudio_object_v1",
  name: "Nestudio Object Rules V1",
  rules: [
    "exactly one object — single subject only",
    "isolated on a transparent background (transparent PNG target)",
    "no extra props",
    "no supporting furniture",
    "no decorative scene",
    "no secondary objects",
    "a chair means a chair — not chair + lamp + rug + side table",
  ],
  // Positive phrasing only — the "no props / no scene" language lives in the
  // negative prompt + the forbidden list, so this fragment never trips the detector.
  promptFragment:
    "Exactly one isolated object and nothing else, presented alone on a transparent " +
    "background as a transparent PNG.",
  forbidden: [
    "multiple objects",
    "two objects",
    "set of",
    "furniture set",
    "extra props",
    "side table",
    "supporting furniture",
    "decorative scene",
    "secondary object",
    "background scene",
    "white background",
  ],
};

export const NESTUDIO_SPECS: RuleSpec[] = [NESTUDIO_CAMERA_SPEC_V1, NESTUDIO_OBJECT_RULES_V1];

/** The combined camera + object language folded into the master prompt. */
export function specPromptFragment(): string {
  return `${NESTUDIO_OBJECT_RULES_V1.promptFragment} ${NESTUDIO_CAMERA_SPEC_V1.promptFragment}`;
}

/** Every forbidden token across both specs (used to validate prompts + negatives). */
export function allForbiddenTokens(): string[] {
  return Array.from(new Set([...NESTUDIO_CAMERA_SPEC_V1.forbidden, ...NESTUDIO_OBJECT_RULES_V1.forbidden]));
}

/**
 * Return the spec's forbidden tokens that appear in a POSITIVE prompt (a violation).
 * Pure + case-insensitive — the basis of the camera/object-rule tests.
 */
export function specViolations(prompt: string, spec: RuleSpec): string[] {
  const haystack = prompt.toLowerCase();
  return spec.forbidden.filter((token) => haystack.includes(token.toLowerCase()));
}

/** True when a positive prompt obeys BOTH specs (no forbidden tokens present). */
export function obeysNestudioSpecs(prompt: string): boolean {
  return specViolations(prompt, NESTUDIO_CAMERA_SPEC_V1).length === 0 &&
    specViolations(prompt, NESTUDIO_OBJECT_RULES_V1).length === 0;
}
