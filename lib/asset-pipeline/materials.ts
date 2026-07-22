/**
 * lib/asset-pipeline/materials.ts — the Nestudio MATERIAL vocabulary.
 * -----------------------------------------------------------------------------
 * Sprint 1 (Phase 2). The fix for the "wooden furniture" failure: furniture@8 used to
 * force ONE surface on every object — "premium matte material, restrained warm colours"
 * — so a modern laptop came out as a warm-wood antique. Materials are now DATA: each
 * object declares what it is actually made of, and the prompt states that truth.
 *
 * The load-bearing principle (bake it into every clause):
 *
 *      WARMTH LIVES IN THE LIGHT, NOT IN THE MATERIAL.
 *
 * The Nestudio house key light stays soft and warm for every asset (see asset-dna +
 * camera). The MATERIAL only decides the surface's real finish and true colour —
 * brushed aluminium reads cool, a screen reads as dark emissive glass, ceramic reads
 * glazed. The house qualities that ALL materials keep (soft rounded iconic form, matte-
 * leaning hand-crafted care, internal AO only, no external shadow, the canonical camera)
 * live in furniture@8, not here.
 *
 * PURE DATA — no DOM, no SDK. Usable in a route, a test, a script or the client.
 */

/** The material families the Alphabet needs. Extend deliberately (a new letter, §10). */
export type MaterialFamily =
  | "timber" // warm painted / natural wood — the ORIGINAL Nestudio look
  | "matte-metal" // brushed / anodised aluminium, steel — cool, satin, never chrome
  | "warm-metal" // brass, copper, muted gold — warm satin metal
  | "polymer" // moulded matte plastic / soft-touch shells
  | "screen" // dark emissive display glass (the biggest fix)
  | "glass" // clear / frosted translucent glass
  | "ceramic" // glazed ceramic / porcelain
  | "fabric" // woven textile — boucle, felt, canvas, upholstery
  | "leather" // supple matte leather
  | "paper" // matte paper / card / print
  | "rubber" // deep matte rubber / vinyl
  | "greenery"; // living plant — leaves + soil

/** Which official style-reference set to attach for a family (route decides the files). */
export type StyleRefFamily =
  | "warm-soft" // the existing official furniture refs (wood / fabric / plant) — warm organic materials
  | "none"; // cool / technical materials: attach NO refs (the wood refs are what caused the bias)

export type MaterialSpec = {
  family: MaterialFamily;
  label: string;
  /** How this material's surface reads in Nestudio's house style (true finish, not "warm matte"). */
  surface: string;
  /** Palette guidance — decouples the object's true colour from the warm KEY LIGHT. */
  palette: string;
  /** Extra negative terms that actively kill this material's failure mode. */
  negativeAdds: string[];
  /** The style-ref set to attach (warm-soft for organic warm materials, none for cool/technical). */
  styleRef: StyleRefFamily;
};

/** Terms that push a cool/technical material back toward the rejected wooden-antique look. */
const ANTI_WOOD = ["wooden", "wood grain", "carved wood", "warm beige", "antique", "matte clay", "terracotta"];

export const MATERIALS: Record<MaterialFamily, MaterialSpec> = {
  timber: {
    family: "timber",
    label: "painted / natural timber",
    surface:
      "warm painted timber or natural wood — soft matte with a faint hand-brushed grain and gently rounded edges",
    palette: "keep its own wood tone (pale oak through warm walnut); never plasticky, never grey",
    negativeAdds: ["glossy varnish", "wet lacquer"],
    styleRef: "warm-soft",
  },
  "matte-metal": {
    family: "matte-metal",
    label: "brushed / anodised metal",
    surface:
      "brushed or anodised matte metal — a cool neutral satin with a soft low sheen that never becomes chrome, mirror or wet gloss; crisp edges softened just slightly",
    palette: "cool neutral metal — aluminium silver, graphite or matte black — as itself, NOT warm wood and NOT beige",
    negativeAdds: [...ANTI_WOOD, "chrome", "mirror finish"],
    styleRef: "none",
  },
  "warm-metal": {
    family: "warm-metal",
    label: "brass / copper metal",
    surface: "warm satin metal — brushed brass, copper or muted gold with a soft matte glow, never mirror-bright",
    palette: "true warm metallic (brass, copper, gold) read AS metal, not as painted wood",
    negativeAdds: ["chrome", "mirror finish", "wood grain"],
    styleRef: "none",
  },
  polymer: {
    family: "polymer",
    label: "moulded matte polymer",
    surface:
      "smooth matte moulded polymer — an even soft-touch finish over softly rounded shells, no gloss and no plastic-toy shine",
    palette: "keep its true colour including deep charcoal or clean off-white; matte, never glossy",
    negativeAdds: [...ANTI_WOOD, "glossy plastic"],
    styleRef: "none",
  },
  screen: {
    family: "screen",
    // The dark screen is now GUARANTEED deterministically by fillEnclosedHoles in cleanup,
    // so this clause is kept CALM — one light mention of "off / dark" only. Aggressive
    // "charcoal-black" language here bled into the whole body and darkened the metal.
    label: "switched-off display",
    surface:
      "a plain switched-OFF screen set flush in its bezel — a quiet, unlit flat panel with only a whisper of soft reflection; a blank or bright source screen still reads as an off, dark screen, never glowing white",
    palette: "a calm unlit dark screen; never a bright white blank rectangle. This applies ONLY to the screen — the rest of the object keeps its own true material colour",
    negativeAdds: ["white screen", "bright blank screen", "glowing white rectangle", "transparent screen", "empty screen hole"],
    styleRef: "none",
  },
  glass: {
    family: "glass",
    label: "clear / frosted glass",
    surface:
      "clear or frosted glass — softly translucent with gentle edge-light and a faint internal refraction over believable thick walls; never a flat opaque panel",
    palette: "transparent or lightly tinted glass true to the object",
    negativeAdds: [...ANTI_WOOD, "opaque", "solid fill"],
    styleRef: "none",
  },
  ceramic: {
    family: "ceramic",
    label: "glazed ceramic",
    surface: "glazed ceramic or porcelain — a soft satin glaze with gentle rounded highlights over smooth handcrafted walls",
    palette: "keep its own glaze colour",
    negativeAdds: ["wood grain", "glossy lacquer"],
    styleRef: "warm-soft",
  },
  fabric: {
    family: "fabric",
    label: "woven textile",
    surface:
      "woven textile — a soft matte nap with a gentle knit or weave read (boucle, felt, canvas) over plush, visibly soft rounded volumes",
    palette: "keep its own fabric colour, muted and matte",
    negativeAdds: ["glossy", "hard edges", "wood grain"],
    styleRef: "warm-soft",
  },
  leather: {
    family: "leather",
    label: "supple leather",
    surface: "supple matte leather — a soft natural grain with a low sheen, gently creased at the stress points, warm and tactile",
    palette: "keep its own leather tone (tan, cognac, black)",
    negativeAdds: ["wet gloss", "patent shine"],
    styleRef: "warm-soft",
  },
  paper: {
    family: "paper",
    label: "matte paper / card",
    surface: "matte paper or card — completely flat and non-reflective with clean soft edges and a hint of thickness where it stacks",
    palette: "keep its own paper and print colour, matte",
    negativeAdds: ["glossy", "wood grain"],
    styleRef: "warm-soft",
  },
  rubber: {
    family: "rubber",
    label: "matte rubber / vinyl",
    surface: "deep matte rubber or vinyl — a soft velvety non-reflective finish over gently rounded forms",
    palette: "keep its own colour, usually deep matte black or graphite",
    negativeAdds: [...ANTI_WOOD, "glossy"],
    styleRef: "none",
  },
  greenery: {
    family: "greenery",
    label: "living plant",
    surface:
      "a living plant — soft matte leaves with gentle organic variation and believable depth, no plastic sheen, potted in soft matte terracotta or glazed ceramic",
    palette: "natural leaf greens with a warm earthen pot; never grey and never wooden foliage",
    negativeAdds: ["plastic leaves", "wooden leaves", "grey foliage"],
    styleRef: "warm-soft",
  },
};

/** The neutral default when an object declares no material: honour its own real surface,
 *  matte-first — this is the old behaviour minus the warm-wood forcing (already an
 *  improvement, and it keeps every existing caller working unchanged). */
export const NEUTRAL_MATERIAL: MaterialSpec = {
  family: "polymer", // only used for the (unused) family field; the clauses below are neutral
  label: "the object's own material",
  surface:
    "honour the object's own real material, matte-first — read its true surface (wood, metal, ceramic, fabric, glass or an emissive screen) AS ITSELF; premium, tactile and hand-crafted, never glossy plastic-toy and never a wet product-shot",
  palette: "keep the object's own true colours; warmth lives only in the light, never painted onto the material",
  negativeAdds: [],
  styleRef: "warm-soft",
};

/** One object's material: a primary family plus optional named accent materials
 *  (a laptop = matte-metal body + a screen display; a camera = metal body + a glass lens). */
export type ObjectMaterial = {
  primary: MaterialFamily;
  /** Distinct sub-parts made of a different material, e.g. { family: "screen", part: "the display" }. */
  accents?: { family: MaterialFamily; part: string }[];
};

export function specFor(family: MaterialFamily): MaterialSpec {
  return MATERIALS[family];
}

/** The style-ref set to attach for an object, decided by its PRIMARY material (accents
 *  never add refs). Cool/technical primaries return "none" so no wood refs bias them. */
export function styleRefFamilyFor(material?: ObjectMaterial | null): StyleRefFamily {
  if (!material) return NEUTRAL_MATERIAL.styleRef;
  return MATERIALS[material.primary].styleRef;
}

/** True when the object should receive the official warm furniture style references. */
export function usesStyleRefs(material?: ObjectMaterial | null): boolean {
  return styleRefFamilyFor(material) === "warm-soft";
}

/** True when any part of the object is a screen or glass — those objects need the
 *  enclosed-hole fill in cleanup (GPT Image renders their screen as a transparent hole). */
export function hasGlassSurface(material?: ObjectMaterial | null): boolean {
  if (!material) return false;
  const glassy = (f: MaterialFamily) => f === "screen" || f === "glass";
  return glassy(material.primary) || (material.accents ?? []).some((a) => glassy(a.family));
}

/**
 * Build the MATERIAL block for the prompt from an object's material. States the primary
 * surface + palette, then each accent part's own material. Returns the block text and the
 * extra negative terms this material contributes (to actively kill its failure mode).
 */
export function buildMaterialBlock(material?: ObjectMaterial | null): { block: string; negativeAdds: string[] } {
  const primary = material ? MATERIALS[material.primary] : NEUTRAL_MATERIAL;
  const lines: string[] = [
    "MATERIAL — TRUE TO THE OBJECT (warmth lives in the LIGHT, never painted onto the material):",
    `- body: ${primary.surface}`,
    `- colour: ${primary.palette}`,
  ];
  const negativeAdds = [...primary.negativeAdds];
  for (const accent of material?.accents ?? []) {
    const spec = MATERIALS[accent.family];
    lines.push(`- ${accent.part}: ${spec.surface}`);
    negativeAdds.push(...spec.negativeAdds);
  }
  // De-duplicate the negatives; order is irrelevant for a comma list.
  return { block: lines.join("\n"), negativeAdds: Array.from(new Set(negativeAdds)) };
}
