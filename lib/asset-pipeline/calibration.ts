/**
 * lib/asset-pipeline/calibration.ts — the Sprint 1 calibration batch.
 * -----------------------------------------------------------------------------
 * Phase 2, Sprint 1: TEN hero objects, chosen to exercise every material family and a
 * spread of interaction patterns, so the founder can judge whether the material-aware
 * furniture@8 produces ONE coherent family — and whether the "wooden furniture" failure
 * is gone. We are NOT scaling; this is the gate before any production run.
 *
 * Source of truth for the calibration bench (app/dev/calibration) and any headless run.
 * PURE DATA — no DOM, no SDK.
 */

import type { ObjectMaterial } from "./materials";
import type { PreserveMode } from "./furniture-8";

/** The four Alphabet classes (Design Constitution §II). */
export type ObjectClass = "Story" | "Identity" | "Portal" | "Memory";

/** The 8 UOS interaction patterns (+ "static" for ambient objects). */
export type InteractionPattern =
  | "SCREEN"
  | "OPEN"
  | "BOOK"
  | "DRAWER"
  | "DISPLAY"
  | "PLAY"
  | "EXAMINE"
  | "TOGGLE"
  | "static";

export type CalibrationObject = {
  id: string;
  subject: string;
  objectClass: ObjectClass;
  material: ObjectMaterial;
  pattern: InteractionPattern;
  mode: PreserveMode;
  /** A reference photo under /public, or null when we don't yet have one (blocks its run). */
  input: string | null;
  /** Why this object is in the calibration set — what it proves. */
  proves: string;
  /** The ONE testable hypothesis this experiment tests (scientific review). */
  hypothesis: string;
  /** Object-specific things to watch when scoring — beyond the shared rubric. */
  probes: string[];
  /** The single benchmark object: perfect this first; it defines the whole language. */
  benchmark?: boolean;
};

/**
 * The ten. Materials deliberately span the whole vocabulary:
 *   matte-metal · screen · glass · polymer · timber · paper · fabric · ceramic · rubber · greenery.
 * Four objects have no reference photo yet (laptop, camera, vinyl player, rug) — flagged so
 * the run can't silently skip them.
 */
export const CALIBRATION_BATCH: CalibrationObject[] = [
  {
    id: "laptop",
    subject: "laptop computer",
    objectClass: "Portal",
    material: { primary: "matte-metal", accents: [{ family: "screen", part: "the open display" }] },
    pattern: "SCREEN",
    // Sprint 2 determinism: Preserve = high input_fidelity, so the model preserves the input
    // photo's already-canonical front geometry instead of re-rolling the camera (low fidelity
    // let the pose drift). Keys stay clean via the micro-text simplification clause.
    mode: "preserve",
    input: "/test-photos/laptop.jpg",
    proves: "the flagship wooden-failure case: a modern metal + glass-screen device must read cool and technical, not as a warm-wood antique",
    benchmark: true,
    hypothesis:
      "With material-aware furniture@8 and the warm-wood style references removed, a modern aluminium-and-glass laptop renders as a cool, technical, iconic Nestudio object with ZERO wooden-antique bleed — while still feeling warm and coherent beside the timber-and-fabric family (because warmth lives in the light, not the material).",
    probes: [
      "the lid and base read as one brushed-metal shell — no wood grain, no carved panels",
      "the open display is dark emissive glass, not a matte painted rectangle",
      "cool aluminium / graphite palette — no warm-beige tint anywhere on the body",
      "the keyboard deck reads as metal with dark keys, never carved timber",
      "it still sits in the same soft warm key light as the sofa (warmth in the light, not the body)",
    ],
  },
  {
    id: "tv",
    subject: "flat-screen television",
    objectClass: "Portal",
    material: { primary: "screen", accents: [{ family: "polymer", part: "the bezel and stand" }] },
    pattern: "SCREEN",
    mode: "simplify",
    input: "/references/tv.png",
    proves: "a large emissive screen reads as dark glass, not a painted matte panel",
    hypothesis:
      "A large flat screen renders as dark emissive glass set in a slim matte-polymer bezel — not as an opaque painted panel and not as a wooden slab.",
    probes: [
      "the screen is dark glass with a faint even glow, not a flat matte fill",
      "the bezel and stand read as matte polymer, not timber",
      "the whole unit stays thin and modern under the canonical camera",
    ],
  },
  {
    id: "bookshelf",
    subject: "wooden bookshelf",
    objectClass: "Portal",
    material: { primary: "timber", accents: [{ family: "paper", part: "the books" }] },
    pattern: "DISPLAY",
    mode: "simplify",
    input: "/references/bookshelf.png",
    proves: "timber still looks warm and right — the material system did not break the ORIGINAL good look",
    hypothesis:
      "Declaring 'timber' keeps the ORIGINAL warm wooden look fully intact — proving the material system is additive (it fixes the wrong materials) and never destructive to the right ones.",
    probes: [
      "warm, pleasant wood grain is present and reads as real timber",
      "the books read as matte paper, not one wooden mass",
      "no cold or metallic drift crept in from the new material logic",
    ],
  },
  {
    id: "camera",
    subject: "mirrorless camera",
    objectClass: "Identity",
    material: {
      primary: "matte-metal",
      accents: [
        { family: "glass", part: "the lens" },
        { family: "polymer", part: "the grip" },
      ],
    },
    pattern: "EXAMINE",
    mode: "preserve",
    input: "/references/camera.png", // Reference Studio — generated studio reference (no photo needed)
    proves: "a multi-material Identity hero (metal body + glass lens) holds distinct finishes at once — from a GENERATED studio reference",
    hypothesis:
      "A multi-material Identity hero can hold three distinct finishes at once — a matte-metal body, a glass lens and a polymer grip — without any one collapsing into the others or into wood.",
    probes: [
      "the body reads as matte metal, the lens clearly as glass",
      "the grip reads as polymer, distinct from the metal body",
      "no wooden bleed on any part; the object stays cool and precise",
    ],
  },
  {
    id: "photo-frame",
    subject: "framed photograph",
    objectClass: "Memory",
    material: { primary: "timber", accents: [{ family: "glass", part: "the glazing over the photo" }] },
    pattern: "DISPLAY",
    mode: "preserve",
    input: "/nests/golden-nest-v1/frame.png",
    proves: "a Memory object with glass glazing reads without turning into an opaque board",
    hypothesis:
      "A Memory object with glass glazing reads as a framed photo behind glass — the timber frame stays warm and the glazing stays subtle, never turning into a single opaque board.",
    probes: [
      "the frame reads as warm timber (or its true material)",
      "the glazing reads as a thin glass layer over the photo, not paint",
      "the inner photo stays legible and does not melt into the frame",
    ],
  },
  {
    id: "vinyl-player",
    subject: "vinyl record turntable",
    objectClass: "Identity",
    material: {
      primary: "matte-metal",
      accents: [
        { family: "polymer", part: "the plinth" },
        { family: "rubber", part: "the record and slip-mat" },
      ],
    },
    pattern: "PLAY",
    mode: "preserve",
    input: null, // NEEDS A PHOTO
    proves: "metal + polymer + matte rubber vinyl coexist; the matte black record is not glossy or wooden",
    hypothesis:
      "Metal, polymer and matte-rubber vinyl coexist in one Identity object — the record reads as deep matte vinyl, never as a glossy disc or a wooden plate.",
    probes: [
      "the platter/record reads as deep matte vinyl, not glossy or wooden",
      "the plinth reads as matte polymer or metal, distinct from the record",
      "the tonearm stays crisp and metallic under the canonical camera",
    ],
  },
  {
    id: "sofa",
    subject: "two-seat sofa",
    objectClass: "Story",
    material: { primary: "fabric" },
    pattern: "static",
    mode: "simplify",
    input: "/references/sofa.png",
    proves: "upholstered fabric stays plush and soft — the anchor Story object",
    hypothesis:
      "Upholstered fabric stays plush, soft and matte — the warm anchor Story object the whole family is measured against for warmth.",
    probes: [
      "the upholstery reads as soft woven fabric with a gentle nap",
      "volumes look plush and inviting, not hard or plastic",
      "it keeps the warm, calm Nestudio soul",
    ],
  },
  {
    id: "rug",
    subject: "woven area rug",
    objectClass: "Story",
    material: { primary: "fabric" },
    pattern: "static",
    mode: "simplify",
    input: null, // NEEDS A PHOTO
    proves: "a flat woven textile reads as fabric nap under the same camera, not as painted board",
    hypothesis:
      "A flat, mostly-2D woven rug still reads as soft fabric nap under the canonical camera — the material system survives an object with almost no volume.",
    probes: [
      "the surface reads as woven textile, not a printed or painted board",
      "the pile/nap gives a soft matte depth despite the flatness",
      "it sits flat and correct under the slightly-elevated camera",
    ],
  },
  {
    id: "desk-lamp",
    subject: "desk lamp",
    objectClass: "Story",
    material: { primary: "matte-metal", accents: [{ family: "fabric", part: "the lamp shade" }] },
    pattern: "TOGGLE",
    mode: "simplify",
    input: "/nests/golden-nest-v1/lamp.png",
    proves: "a metal-armed lamp with a fabric shade — two materials in a small Story object",
    hypothesis:
      "A small Story object can carry two materials — a matte-metal arm and a fabric shade — cleanly, at a smaller scale than the hero objects.",
    probes: [
      "the arm/base reads as matte metal",
      "the shade reads as soft fabric, distinct from the metal",
      "the two materials stay separate at small scale under the canonical camera",
    ],
  },
  {
    id: "plant",
    subject: "potted house plant",
    objectClass: "Story",
    material: { primary: "greenery", accents: [{ family: "ceramic", part: "the pot" }] },
    pattern: "static",
    mode: "simplify",
    input: "/references/plant.png",
    proves: "living greenery + a glazed ceramic pot — organic material and glaze in one object",
    hypothesis:
      "Living greenery and a glazed ceramic pot coexist — soft matte leaves over a satin-glazed pot — proving organic material and glaze render distinctly in one object.",
    probes: [
      "the leaves read as soft matte greenery, not plastic or wooden",
      "the pot reads as glazed ceramic with a gentle satin sheen",
      "the greens stay natural; the pot keeps its true glaze colour",
    ],
  },
];

/** The single benchmark object — perfect this first; it defines the whole language. */
export function benchmarkObject(batch: CalibrationObject[] = CALIBRATION_BATCH): CalibrationObject {
  return batch.find((o) => o.benchmark) ?? batch[0];
}

/** Every object except the benchmark — locked until the benchmark passes. */
export function nonBenchmarkObjects(batch: CalibrationObject[] = CALIBRATION_BATCH): CalibrationObject[] {
  const b = benchmarkObject(batch);
  return batch.filter((o) => o.id !== b.id);
}

/** Objects that still need a reference photo before they can be generated. */
export function objectsNeedingInput(batch: CalibrationObject[] = CALIBRATION_BATCH): CalibrationObject[] {
  return batch.filter((o) => !o.input);
}

/** Objects ready to generate right now (a reference photo exists). */
export function objectsReady(batch: CalibrationObject[] = CALIBRATION_BATCH): CalibrationObject[] {
  return batch.filter((o) => !!o.input);
}

/** The set of material families the batch exercises (coverage check). */
export function materialCoverage(batch: CalibrationObject[] = CALIBRATION_BATCH): string[] {
  const fams = new Set<string>();
  for (const o of batch) {
    fams.add(o.material.primary);
    for (const a of o.material.accents ?? []) fams.add(a.family);
  }
  return Array.from(fams).sort();
}
