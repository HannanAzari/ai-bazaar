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

// M22.2 — the SHIPPED master prompt, ported from the real-photo mug lab (v5,
// docs/mug-prompt-log.md) and generalized to any object. It is self-contained (it
// does NOT use buildBasePrompt) because the mug test proved that base's generic
// "palette: parchment/plaster/stone" clause was REPAINTING real objects (white mug
// → cream). The three hard-won rules: (1) preserve the object's TRUE colours + its
// own markings, warm the LIGHT not the object; (2) all markings sit flat ON the
// surface, never floating/detached; (3) lock centered framing at ~70% with even
// margins. Tonal params lean faithful so the local fallback matches the hosted look.
const buildFurnitureV4: PromptBuilder = (input) => {
  const style = mergeStyle(NESTUDIO_STYLE, input.style);
  const subject = input.subject || "home object";
  const positive = [
    `A single ${subject} rendered as one asset in the Nestudio Classic library — a soft stylized 3D render, warm, premium and cozy, with subtle ambient occlusion and a clean readable silhouette, as if handcrafted to sit beside the other Nestudio objects`,
    "faithfully preserve THIS object's exact design, proportions and distinctive details — its true material colours and any painted markings, patterns or lettering that belong to the object itself",
    "only the LIGHTING is warm (a soft key from the upper-left); the object is not recoloured or tinted, and any coloured markings keep their own true, even colour",
    "all markings and decoration sit flat ON the object's surface — never detached, floating, or hovering beside it",
    "soft matte materials, never glossy, never plastic, never chrome",
    "front-facing three-quarter view; the whole object sits comfortably centered at about 70 percent of the frame with equal generous margins on all four sides — no part near or touching any edge, nothing cropped, no perspective distortion",
    "one soft grounded contact shadow directly beneath, never floating",
    "on a fully transparent background — no scene, no hands, no added text, no watermark",
  ].concat(input.notes ? [input.notes.trim()] : []).join(". ");
  const negative =
    "photorealistic, glossy or chrome materials, harsh shadows, isometric 30-degree view, busy or opaque background, scene, hands, fingers, watermark, added text or logos, floating or detached decoration, markings beside or separated from the object, recoloured object, warm-tinted or muddy colours, object touching the frame edge, cropped, clipped, extra objects, clutter, low quality";
  return {
    kind: input.kind,
    subject,
    positive,
    negative,
    style,
    tags: dedupe([input.kind, ...tokenize(subject)]),
    params: { size: 1024, background: "transparent", guidance: 7, subjectType: "object", relight: 0.08, saturation: 0.85, satCap: 0.9, warmth: 0.2 },
    promptVersion: "furniture@4",
  };
};

// M23 — the DNA-LOCKED master. furniture@4 solved fidelity (preserve the object's
// true colours + own markings, no floating decoration, centered framing). M23 added
// the missing half: the permanent RENDERING LANGUAGE, discovered by single-variable
// iteration on a real mug (docs/nestudio-object-dna.md). The variable that turned an
// "AI product render" into an "intentionally designed Nestudio object" was MATERIAL:
// a deeply matte, hand-painted / gouache finish with soft visible brush shading (zero
// gloss), lit by a single soft warm key with warm ambient occlusion pooling in the
// crevices — painterly volume, not a studio softbox. v5 = v4's identity-preservation
// (true colours, own markings, no floating decoration, centered ~70% framing) rendered
// in that frozen language (matte hand-painted finish + warm sculptural key/AO + softly
// sculpted handcrafted form). Tonal params lean matte/warm so the local fallback tracks.
const buildFurnitureV5: PromptBuilder = (input) => {
  const style = mergeStyle(NESTUDIO_STYLE, input.style);
  const subject = input.subject || "home object";
  const positive = [
    `A single ${subject} rendered as one asset in the Nestudio library — an original, intentionally DESIGNED object, an artistic interpretation with a clean readable silhouette, as if hand-crafted by one artist to sit beside the other Nestudio objects`,
    "faithfully preserve THIS object's identity — its overall silhouette, proportions and the distinctive details, patterns and markings that make it itself; simplify only incidental surface noise, keep whatever strengthens its character",
    "gently sculpted, handcrafted form — every edge softened, every corner a subtle radius, small handmade imperfections; never CAD, never scanned, never perfectly geometric",
    "material: a deeply MATTE, hand-painted finish with a soft chalky surface and gentle visible brush shading, like a hand-crafted illustrated toy — never glossy, never plastic, never chrome, no sheen, no specular highlight, no wet look, only a soft powdery grain",
    "lighting: a single soft warm key light from the upper-left wrapping gently around the form, with rich warm ambient occlusion pooling in the crevices and undersides — a soft painterly shadow terminator that models the volume; gentle, never harsh, never HDR, no rim light",
    "colour: a restrained warm palette; the object keeps its own true colours and any coloured markings keep their own even colour — only the LIGHT is warm, the object is not recoloured or tinted; nothing fully saturated, no pure white, no pure black, no pure RGB",
    "all markings and decoration sit flat ON the object's surface — never detached, floating, or hovering beside it",
    "front-facing, eye-level; the whole object sits comfortably centered at about 70 percent of the frame with equal generous margins on all four sides — nothing cropped, no perspective distortion, not isometric",
    "one soft grounded contact shadow directly beneath, never floating, never a dramatic cast shadow",
    "on a fully transparent background — no scene, no hands, no added text, no watermark",
  ].concat(input.notes ? [input.notes.trim()] : []).join(". ");
  const negative =
    "photograph, product photo, HDR, studio lighting, rim light, glossy, gloss, sheen, specular highlight, glaze, wet look, reflective, plastic, chrome, photorealistic, hyperrealistic, photographic texture, procedural noise, harsh shadows, isometric 30-degree view, perspective distortion, busy or opaque background, scene, hands, fingers, watermark, added text or logos, floating or detached decoration, markings beside or separated from the object, recoloured object, warm-tinted or muddy colours, pure white, pure black, object touching the frame edge, cropped, clipped, extra objects, clutter, low quality";
  return {
    kind: input.kind,
    subject,
    positive,
    negative,
    style,
    tags: dedupe([input.kind, ...tokenize(subject)]),
    params: { size: 1024, background: "transparent", guidance: 7, subjectType: "object", relight: 0.06, saturation: 0.8, satCap: 0.85, warmth: 0.28 },
    promptVersion: "furniture@5",
  };
};

// M24 — the SHAPE-DNA master. M23 froze how a Nestudio object is *rendered*; M24
// froze how it is *shaped*, so a lamp, chair, plant, house and mug all read as one
// family from their silhouette alone — the "3-second silhouette test" (a moat that's
// far harder to copy than a texture). Discovered by generating five radically different
// shape philosophies (inflated / industrial / expressive / scandi / invent) and filling
// each solid black: only the invented direction produced a NEW outline. Its three
// signatures — a confident tapered PEDESTAL foot, a single-radius rounded PEBBLE mass,
// and a bold NEGATIVE-SPACE cut-out for any opening — became the family shape rule.
// v6 = v5's frozen rendering language, but the object's FORM is now re-authored in that
// shape language instead of copying the reference silhouette (docs/nestudio-shape-dna.md).
const buildFurnitureV6: PromptBuilder = (input) => {
  const style = mergeStyle(NESTUDIO_STYLE, input.style);
  const subject = input.subject || "home object";
  const positive = [
    `A single ${subject}, an original Nestudio object — designed as if Nestudio invented it from scratch: still instantly recognizable as a ${subject}, yet unmistakably one of a family from its silhouette alone`,
    `preserve only the object's essential identity — the few features that make it read as a ${subject}; do NOT copy the proportions or outline of any reference, re-author the form in the Nestudio shape language below`,
    "Nestudio shape language: soft continuous-curvature surfaces resolved to a single signature radius; a calm, rounded, gently pebble-like primary mass with generous friendly volume; where the object meets the ground it lifts onto a small confident tapered pedestal foot rather than sitting flat; any handle, opening, hole or gap is expressed as one bold, clean NEGATIVE-SPACE cut-out with soft thick rounded borders, never a thin attached part; the whole form must read instantly and unmistakably from its silhouette",
    "material: a deeply MATTE, hand-painted finish with a soft chalky surface and gentle visible brush shading, like a hand-crafted illustrated toy — never glossy, never plastic, never chrome, no sheen, no specular highlight, only a soft powdery grain",
    "lighting: a single soft warm key light from the upper-left with rich warm ambient occlusion pooling in the crevices, cut-out and undersides — a soft painterly terminator that models the volume; gentle, never harsh, never HDR, no rim light",
    "colour: a restrained warm palette; the object keeps its own true colours and any coloured markings keep their own even colour — only the LIGHT is warm, the object is not recoloured or tinted; nothing fully saturated, no pure white, no pure black, no pure RGB",
    "front-facing, eye-level; the whole object sits comfortably centered at about 70 percent of the frame with equal generous margins on all four sides — nothing cropped, no perspective distortion, not isometric",
    "one soft grounded contact shadow directly beneath, never floating, never a dramatic cast shadow",
    "on a fully transparent background — no scene, no hands, no added text, no watermark",
  ].concat(input.notes ? [input.notes.trim()] : []).join(". ");
  const negative =
    "photograph, product photo, HDR, studio lighting, rim light, glossy, gloss, sheen, specular highlight, glaze, wet look, reflective, plastic, chrome, photorealistic, hyperrealistic, photographic texture, harsh shadows, isometric 30-degree view, perspective distortion, flat bottom, sitting flat, no foot, thin attached handle, fiddly handle, sharp corners, hard edges, busy or noisy silhouette, copies the reference outline, generic mug shape, cylinder, busy or opaque background, scene, hands, fingers, watermark, added text or logos, floating or detached decoration, recoloured object, warm-tinted or muddy colours, pure white, pure black, object touching the frame edge, cropped, clipped, extra objects, clutter, low quality";
  return {
    kind: input.kind,
    subject,
    positive,
    negative,
    style,
    tags: dedupe([input.kind, ...tokenize(subject)]),
    params: { size: 1024, background: "transparent", guidance: 7, subjectType: "object", relight: 0.06, saturation: 0.8, satCap: 0.85, warmth: 0.28 },
    promptVersion: "furniture@6",
  };
};

// VS01 correction — the REINTERPRETATION master. furniture@6 was a *fidelity* prompt
// ("faithfully preserve the exact design, only the light is warm"), so the hosted model
// image-EDITED the photo and returned a photo-cutout: photographic lighting, the literal
// printed word, a baked shadow, a painted checker background. furniture@7 instead tells
// the model to REBUILD the object from scratch as a Nestudio asset (the proven M23
// dna-C-freeze caliber), keep only identity, and — crucially — render it on a plain
// FLAT SOLID-COLOUR background (never "transparent", which the model paints as a checker)
// so post-process can key it to TRUE alpha. No baked shadow (the room grounds it).
const buildFurnitureV7: PromptBuilder = (input) => {
  const style = mergeStyle(NESTUDIO_STYLE, input.style);
  const subject = input.subject || "home object";
  const positive = [
    `A single ${subject}, DESIGNED and rebuilt from scratch as an original Nestudio object — sculpted the way Nestudio's own artists would make it. It must NOT look like a photograph, and NOT look like the uploaded photo with its background removed; it is a fresh Nestudio asset that belongs beside the official Nestudio sofa, table, shelf and lamp`,
    `keep only its IDENTITY — the overall silhouette, approximate proportions, its one or two distinctive features and its handmade personality — then re-sculpt everything else into soft Nestudio form`,
    "form: a softly sculpted, simplified, gently inflated rounded 3D shape with one soft signature radius and small handcrafted imperfections; a clean readable silhouette; the top opening gently visible",
    "material: a warm MATTE hand-painted surface with subtle painterly shading and gentle warm ambient occlusion in the crevices; restrained warm colours; never glossy, never plastic, never shiny, no reflections, no photographic texture, no product-photography lighting",
    "lighting: a single soft warm key from the upper-left only — no photographed hand, no fingers, no room light, no window, no curtain, no harsh studio light",
    "any lettering, words or markings are re-rendered as a SIMPLIFIED hand-painted mark sitting flat ON the matte surface — clearly painted by the Nestudio artist, never the photographic printed word from the source",
    "camera: the Nestudio life-simulation camera — front-facing and slightly elevated, about a 10 degree downward tilt, roughly 35mm, so the top opening reads; never eye-level, never isometric, no perspective distortion, no wide angle",
    "composition: the whole object centred at about 62 percent of the frame with generous even margins on every side; nothing clipped or touching an edge; bottom-centre grounded but with NO drawn shadow and NO floating halo",
    "background: place the object on a plain, FLAT, single SOLID-COLOUR studio background (a calm cool sage-green), with absolutely no checkerboard, no transparency pattern, no gradient, no scene and no shadow — a clean solid fill that can be keyed out to true transparency afterwards",
  ].concat(input.notes ? [input.notes.trim()] : []).join(". ");
  const negative =
    "photograph, photo, photographic, photo cutout, cut-out, the original photo with background removed, photographic lighting, reflections, glossy, shiny, wet look, product photo, studio product photography, hand, fingers, arm, holding, curtain, window, room, scene, floor, checkerboard, checkered background, transparency pattern, gradient background, baked shadow, drop shadow, floor shadow, cast shadow, floating halo, isometric, eye-level, 30-degree parallel, wide-angle distortion, clipped, cropped, touching the edge, watermark, added text, printed photographic word, gibberish text, deformed, low quality";
  return {
    kind: input.kind,
    subject,
    positive,
    negative,
    style,
    tags: dedupe([input.kind, ...tokenize(subject)]),
    params: { size: 640, background: "transparent", guidance: 7, subjectType: "object", relight: 0.05, saturation: 0.82, satCap: 0.85, warmth: 0.3 },
    promptVersion: "furniture@7",
  };
};

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
  "furniture@4": buildFurnitureV4,
  "furniture@5": buildFurnitureV5,
  "furniture@6": buildFurnitureV6,
  "furniture@7": buildFurnitureV7,
  "decoration@1": buildDecorationPrompt,
  "avatar@1": buildAvatarPrompt,
  "background@1": buildBackgroundPrompt,
  "house@1": buildHousePrompt,
};

/** The live version per kind. Bumping this is how a prompt ships — no engine edit. */
export const ACTIVE_PROMPT_VERSION: Record<string, string> = {
  furniture: "furniture@7",
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
