/**
 * lib/asset-dna.ts — the Nestudio Asset DNA, as a typed constant.
 * -----------------------------------------------------------------------------
 * The CODE mirror of docs/design/NESTUDIO_ASSET_DNA.md. This is the ONE place the
 * Nestudio object look is defined. Prompts are ASSEMBLED from this DNA, never
 * hand-written — so improving the look means improving the DNA (or the cutout, or
 * the provider), not rewriting a paragraph buried in one prompt.
 *
 * The M32 architecture principle: the PROVIDER is interchangeable; the DNA is
 * constant. Every provider adapter receives this exact object + the user's cutout
 * and must satisfy it. Providers are judged against it (the benchmark scorecard),
 * never by prompt cleverness.
 *
 * PURE DATA — no React, no DOM, no provider SDK. Usable on the client, in an API
 * route, in a script, or in a test.
 *
 * Canonical origin of every value: docs/design/RENDERING_DNA.md +
 * docs/nestudio-camera-dna-lock.md. If those change, change this in the same commit.
 */

export const ASSET_DNA_VERSION = "asset-dna@1";

/* ── Structured spec (the 17 fields) ─────────────────────────────────────────── */

export type AssetDna = {
  version: string;
  /** Animal-Crossing life-sim camera — slightly elevated, never eye-level/iso. */
  camera: { heightCm: number; tiltDeg: number; focalMm: number; clause: string };
  lens: { clause: string };
  /** ~70% framing rule. */
  framing: { fill: number; clause: string };
  /** Even transparent margin, fraction of the square. */
  padding: { fraction: number; clause: string };
  lighting: { keyHex: string; clause: string };
  material: { clause: string };
  texture: { clause: string };
  edge: { clause: string };
  ambientOcclusion: { clause: string };
  /** No baked shadow — engine composites cool-plum at placement. */
  shadow: { baked: false; contactHex: string; clause: string };
  colour: { accentsMax: number; clause: string };
  silhouette: { clause: string };
  shape: { primitives: string[]; clause: string };
  rendering: { clause: string };
  transparency: { clause: string };
  /** Square RGBA PNG export target. */
  export: { size: number; mime: "image/png"; clause: string };
  /** The single reinterpretation instruction that opens every prompt. */
  reinterpretation: string;
  /** The forbidden list (RENDERING_DNA §8), used as the negative prompt. */
  forbidden: string[];
};

export const NESTUDIO_ASSET_DNA: AssetDna = {
  version: ASSET_DNA_VERSION,
  camera: {
    heightCm: 180,
    tiltDeg: 10,
    focalMm: 37,
    clause:
      "camera: the Nestudio life-simulation camera — front-facing and slightly elevated, about a 10 degree downward tilt, roughly 35mm, so the top surfaces read; never eye-level, never isometric",
  },
  lens: { clause: "no wide-angle distortion, no strong cinematic perspective, only subtle natural convergence" },
  framing: {
    fill: 0.62,
    clause: "the whole object centred at about 62 percent of the frame, fully visible, nothing clipped or touching an edge",
  },
  padding: { fraction: 0.12, clause: "generous, even transparent margins on all four sides" },
  lighting: {
    keyHex: "#fff6e0",
    clause: "lighting: a single soft warm key from the upper-left only — no rim light, no HDR, no studio softbox, no dramatic or photographic light",
  },
  material: {
    clause:
      "material: a warm, deeply MATTE, hand-painted surface with a soft chalky finish and gentle painterly shading, like a hand-crafted illustrated toy; the object keeps its own real material read (wood, ceramic, fabric, metal-painted-matte…) but never glossy, plastic, chrome, wet-look, specular or reflective",
  },
  texture: { clause: "only a soft powdery grain — no photographic texture, no procedural noise" },
  edge: { clause: "clean, gently soft edges — not razor-cut sticker edges, not a fuzzy halo" },
  ambientOcclusion: {
    clause: "gentle warm ambient occlusion pooling in crevices, undersides and the inside of cut-outs — hand-painted shading, not a render pass",
  },
  shadow: {
    baked: false,
    contactHex: "#46365a",
    clause: "the object is grounded at bottom-centre but carries NO drawn shadow and NO floating halo — the room composites its cool-plum contact shadow later",
  },
  colour: {
    accentsMax: 1,
    clause:
      "keep the object's OWN true colours — only the light is warm, never recolour or tint the object; at most one accent colour; nothing fully saturated, no pure white, no pure black, no pure RGB",
  },
  silhouette: {
    clause: "a clean, instantly readable silhouette — recognisable as its identity from the outline alone (the 3-second silhouette test)",
  },
  shape: {
    primitives: ["pebble", "capsule", "arch"],
    clause: "form: softly sculpted, simplified, gently inflated rounded 3D built from Nestudio's primitives (pebble mass, capsule limb, arch span) with one soft signature radius and small handcrafted imperfections",
  },
  rendering: {
    clause: "a stylized life-simulation game look (Animal Crossing / The Sims) — it must belong beside the official Nestudio sofa, table, shelf and lamp",
  },
  transparency: {
    clause:
      "place the object on a plain, FLAT, single SOLID-COLOUR studio background (a calm cool sage-green) with no checkerboard, no transparency pattern, no gradient, no scene and no shadow — a clean solid fill that is keyed out to true transparency afterwards",
  },
  export: { size: 640, mime: "image/png", clause: "delivered as a single isolated transparent PNG, one object only, no text and no watermark" },
  reinterpretation:
    "DESIGNED and rebuilt from scratch as an original Nestudio object — sculpted the way Nestudio's own artists would make it. It must NOT look like a photograph, and NOT look like the uploaded photo with its background removed; keep only its IDENTITY (overall silhouette, approximate proportions, its one or two distinctive features and its handmade personality), then re-sculpt everything else into soft Nestudio form. Any lettering is re-rendered as a SIMPLIFIED hand-painted mark flat on the matte surface, never the photographic printed word",
  forbidden: [
    "photograph", "photo", "photographic", "photo cutout", "cut-out", "the original photo with background removed",
    "photographic lighting", "reflections", "glossy", "shiny", "wet look", "product photo", "studio product photography",
    "hand", "fingers", "arm", "holding", "curtain", "window", "room", "scene", "floor",
    "checkerboard", "checkered background", "transparency pattern", "gradient background",
    "baked shadow", "drop shadow", "floor shadow", "cast shadow", "floating halo",
    "isometric", "eye-level", "30-degree parallel", "wide-angle distortion",
    "clipped", "cropped", "touching the edge", "watermark", "added text", "printed photographic word",
    "gibberish text", "deformed", "low quality",
  ],
};

/* ── Prompt assembly (derived from the DNA, never authored) ───────────────────── */

export type AssetDnaPrompt = {
  positive: string;
  negative: string;
  dnaVersion: string;
};

/**
 * Compose the provider-agnostic prompt for one subject FROM the DNA. Every provider
 * gets the same text; the adapter only decides how to deliver it. `notes` is an
 * optional user nudge appended verbatim (kept minimal — we do not optimise prompts).
 */
export function buildAssetDnaPrompt(subject: string, notes?: string, dna: AssetDna = NESTUDIO_ASSET_DNA): AssetDnaPrompt {
  const s = (subject || "home object").trim();
  const positive = [
    `A single ${s}, ${dna.reinterpretation}`,
    dna.shape.clause,
    dna.silhouette.clause,
    dna.material.clause,
    dna.texture.clause,
    dna.ambientOcclusion.clause,
    dna.lighting.clause,
    dna.colour.clause,
    dna.camera.clause,
    dna.lens.clause,
    `${dna.framing.clause}, with ${dna.padding.clause}`,
    dna.shadow.clause,
    dna.rendering.clause,
    dna.transparency.clause,
    dna.export.clause,
  ]
    .concat(notes && notes.trim() ? [notes.trim()] : [])
    .join(". ");
  const negative = dna.forbidden.join(", ");
  return { positive, negative, dnaVersion: dna.version };
}

/* ── Benchmark scorecard (judge by consistency, not prompts) ──────────────────── */

export type BenchmarkDimension = { key: string; label: string; test: string };

/** The 10 dimensions every provider's output is scored on (0–2 each; max 20).
 *  Mirrors docs/design/NESTUDIO_ASSET_DNA.md §4. */
export const BENCHMARK_DIMENSIONS: BenchmarkDimension[] = [
  { key: "camera", label: "Camera & perspective", test: "slightly-elevated ~10°, not eye-level, not isometric" },
  { key: "material", label: "Material & finish", test: "matte hand-painted, no gloss/plastic/photo texture" },
  { key: "lighting", label: "Lighting & AO", test: "single warm upper-left key + warm pooled AO, no HDR/rim" },
  { key: "colour", label: "Colour fidelity", test: "keeps true colours; one accent; no pure white/black" },
  { key: "silhouette", label: "Silhouette", test: "passes the 3-second silhouette read" },
  { key: "shape", label: "Shape language", test: "rounded, softly inflated, pebble/capsule/arch" },
  { key: "transparency", label: "Transparency", test: "true alpha, no checker, clean feathered edge" },
  { key: "reinterpretation", label: "Reinterpretation", test: "rebuilt Nestudio object, not a photo cutout" },
  { key: "framing", label: "Framing & padding", test: "centered, ~70%, generous even margins, nothing clipped" },
  { key: "identity", label: "Identity preserved", test: "still recognisably the user's real thing" },
];

export const BENCHMARK_MAX_SCORE = BENCHMARK_DIMENSIONS.length * 2;
