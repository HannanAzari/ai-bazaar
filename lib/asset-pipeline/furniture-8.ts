/**
 * lib/asset-pipeline/furniture-8.ts — the `furniture@8` prompt architecture.
 * -----------------------------------------------------------------------------
 * M35 (GPT Image). A single, explicit prompt whose PRIORITY ORDER is stated up
 * front: transform the real object into a premium Nestudio asset while keeping it
 * recognisably the SAME personal object. IDENTITY is preserved; only the material,
 * form and finish are re-authored.
 *
 * This is NOT the deterministic re-composite / repair pipeline. furniture@8 asks
 * the model for its genuine result. The only thing we add is TRUTH about the object
 * (an object-specific identity block) — never style tricks.
 *
 * Preserve vs Simplify produce meaningfully different instructions (verify from the
 * request payload on /dev/gpt-image).
 *
 * PURE DATA — no DOM, no SDK. Usable in a route, a test or the client.
 */

import type { IdentityContract, RGB } from "@/lib/identity/types";

export const FURNITURE_8_VERSION = "furniture@8";

export type PreserveMode = "preserve" | "simplify";

export type Furniture8Prompt = {
  positive: string;
  negative: string;
  promptVersion: string;
  mode: PreserveMode;
};

/* ── colour naming (local, tiny) ──────────────────────────────────────────────── */

const NAMED: { rgb: RGB; name: string }[] = [
  { rgb: [22, 20, 18], name: "black" }, { rgb: [245, 238, 220], name: "cream" }, { rgb: [252, 252, 250], name: "white" },
  { rgb: [140, 92, 58], name: "brown" }, { rgb: [122, 122, 122], name: "grey" }, { rgb: [180, 60, 50], name: "red" },
  { rgb: [210, 120, 120], name: "pink-red" }, { rgb: [60, 110, 190], name: "blue" }, { rgb: [70, 140, 80], name: "green" },
  { rgb: [220, 190, 90], name: "yellow" }, { rgb: [200, 150, 90], name: "tan" },
];
function nameColour(rgb: RGB): string {
  let best = NAMED[0], bd = Infinity;
  for (const n of NAMED) {
    const d = Math.abs(rgb[0] - n.rgb[0]) + Math.abs(rgb[1] - n.rgb[1]) + Math.abs(rgb[2] - n.rgb[2]);
    if (d < bd) { bd = d; best = n; }
  }
  return best.name;
}

/** Human region from a normalized bbox centre. */
function placeOf(bbox: { x: number; y: number; w: number; h: number }): string {
  const cx = bbox.x + bbox.w / 2, cy = bbox.y + bbox.h / 2;
  const h = cx < 0.4 ? "on the left" : cx > 0.6 ? "on the right" : "in the centre";
  const v = cy < 0.38 ? "near the top" : cy > 0.62 ? "near the bottom" : "";
  return v ? `${h}, ${v}` : h;
}

/**
 * Derive an OBJECT-SPECIFIC IDENTITY block from the extracted contract — the truth
 * we know about THIS object (dominant colours, where they sit, which are critical,
 * whether it carries lettering/graphics). Not adjectives; measured facts.
 */
export function deriveIdentityNotes(contract: IdentityContract): string {
  const lines: string[] = [`- ${contract.objectType}`];
  for (const c of contract.colours.slice(0, 4)) {
    if (c.coverage < 0.04) continue;
    const critical = c.critical ? " (a defining colour — must stay this colour, in this place)" : "";
    lines.push(`- ${nameColour(c.rgb)} ${placeOf(c.bbox)}${critical}`);
  }
  if (contract.hasGraphics) {
    lines.push(
      contract.preserveDetails
        ? "- carries hand-made lettering / graphics on the front — keep it readable and in place"
        : "- carries incidental lettering / graphics — the shape matters, the writing does not",
    );
  }
  return lines.join("\n");
}

/* ── the base prompt (the sprint spec, verbatim in spirit) ────────────────────── */

const PRIMARY_GOAL =
  "PRIMARY GOAL:\nTransform the selected real object into a premium Nestudio asset while keeping it recognisably the same personal object.";

const IDENTITY_SHARED = [
  "IDENTITY — PRESERVE:",
  "- Preserve the object's distinctive silhouette and proportions.",
  "- Preserve the placement, shape and colour of important handles, openings, markings and decorative details.",
  "- Do not invent duplicate letters, handles, holes, faces or extra components.",
  "- Do not melt, fragment, flatten or distort the object.",
];

const TRANSFORMATION = [
  "TRANSFORMATION:",
  "Rebuild the object as a polished, intentionally designed 3D Nestudio collectible.",
  "It must not look like a cropped photograph, sticker, painting, sketch or pasted photo texture.",
  "Give it coherent solid geometry, believable thickness, clean edges and a premium tactile form.",
];

const NESTUDIO_APPEARANCE = [
  "NESTUDIO APPEARANCE:",
  "- softly rounded, friendly proportions",
  "- premium matte material",
  "- restrained warm colours",
  "- subtle handcrafted character",
  "- dimensional form with gentle internal shading",
  "- slightly elevated front three-quarter camera with the top surface visible",
  "- no environment, room, hand, pedestal, text outside the object or decorative background",
  "- isolated cleanly for use as an in-app asset",
  "- no baked checkerboard",
  "- no dramatic cast shadow",
];

const OUTPUT = [
  "OUTPUT:",
  "One centred object with generous padding.",
  "Transparent background when supported natively; otherwise use a single flat chroma background that can be removed safely.",
];

/* ── the negative (what the object must NOT become) ───────────────────────────── */

const NEGATIVE_BASE = [
  "photograph", "photo cutout", "sticker", "painting", "sketch", "pasted photo texture", "cropped photograph",
  "glossy", "shiny", "wet look", "product photo",
  "duplicate letters", "duplicate handle", "extra handle", "duplicate face", "extra holes", "extra components",
  "melted", "fragmented", "flattened", "distorted", "broken rim", "missing wall",
  "hand", "fingers", "arm", "holding", "curtain", "room", "environment", "pedestal", "decorative background",
  "text outside the object", "checkerboard", "transparency pattern", "dramatic cast shadow", "drop shadow",
  "gibberish text", "deformed", "low quality",
];

/**
 * Build the furniture@8 prompt for one object. `identityNotes` overrides the
 * auto-derived block when the caller knows the real object precisely (it must
 * DESCRIBE the real thing — never inject style). `mode` changes the instruction
 * meaningfully: Preserve keeps writing/logos/patterns; Simplify strips them.
 */
export function buildFurniture8Prompt(opts: {
  subject: string;
  contract?: IdentityContract | null;
  mode: PreserveMode;
  identityNotes?: string;
}): Furniture8Prompt {
  const { subject, contract, mode } = opts;
  const preserve = mode === "preserve";

  // The Preserve/Simplify divergence — a real difference in instruction, verifiable.
  const detailLine = preserve
    ? "- Preserve readable lettering, logos, patterns, unusual handles, distinctive colours and meaningful wear exactly as they are (the user chose Preserve details)."
    : "- Simplify: keep the silhouette, proportions, main colour and functional structure, but REMOVE writing, logos and tiny incidental patterns — leave those surfaces clean.";

  const identityBlock =
    (opts.identityNotes && opts.identityNotes.trim()) ||
    (contract ? deriveIdentityNotes(contract) : `- ${(subject || "home object").trim()}`);

  const positive = [
    PRIMARY_GOAL,
    [...IDENTITY_SHARED, detailLine].join("\n"),
    TRANSFORMATION.join("\n"),
    NESTUDIO_APPEARANCE.join("\n"),
    OUTPUT.join("\n"),
    `OBJECT-SPECIFIC IDENTITY:\n${identityBlock}`,
    `The object is a ${(subject || "home object").trim()}.`,
  ].join("\n\n");

  const negative = [
    ...NEGATIVE_BASE,
    ...(preserve ? [] : ["writing", "lettering", "logos", "text", "printed word"]),
  ].join(", ");

  return { positive, negative, promptVersion: FURNITURE_8_VERSION, mode };
}
