/**
 * lib/identity/prompt.ts — prompt ARCHITECTURE from the immutable contract.
 *
 * This is not "add more descriptive words". The generation prompt is assembled from
 * the structured identity contract as a set of IMMUTABLE constraints, prepended to
 * the Nestudio DNA prompt, plus an explicit statement that style may only change
 * finish/edges/lighting/polish — never redesign or recolour the identity.
 */

import type { AssetDnaPrompt } from "@/lib/asset-dna";
import type { IdentityContract, RGB } from "./types";

const NAMED: { rgb: RGB; name: string }[] = [
  { rgb: [20, 18, 16], name: "black" }, { rgb: [245, 238, 220], name: "cream" }, { rgb: [255, 255, 255], name: "white" },
  { rgb: [140, 92, 58], name: "brown" }, { rgb: [120, 120, 120], name: "grey" }, { rgb: [180, 60, 50], name: "red" },
  { rgb: [60, 110, 190], name: "blue" }, { rgb: [70, 140, 80], name: "green" }, { rgb: [220, 190, 90], name: "yellow" },
  { rgb: [200, 150, 90], name: "tan" },
];
function nameColour(rgb: RGB): string {
  let best = NAMED[0], bd = Infinity;
  for (const n of NAMED) { const d = Math.abs(rgb[0] - n.rgb[0]) + Math.abs(rgb[1] - n.rgb[1]) + Math.abs(rgb[2] - n.rgb[2]); if (d < bd) { bd = d; best = n; } }
  return best.name;
}

/** Compose the identity-constrained positive/negative from the contract + DNA prompt. */
export function buildIdentityPrompt(contract: IdentityContract, dna: AssetDnaPrompt): AssetDnaPrompt {
  const colours = contract.colours
    .slice(0, 4)
    .map((c) => `${nameColour(c.rgb)}${c.critical ? " (MUST stay this colour, in this place)" : ""}`)
    .join(", ");
  const criticalNames = contract.criticalColours.map(nameColour);
  const constraints = [
    `This is the user's real ${contract.objectType}. PRESERVE ITS IDENTITY EXACTLY — do not redesign, do not recolour, do not restyle its shape`,
    `keep the same silhouette and proportions`,
    colours ? `keep its colours where they are: ${colours}` : "",
    criticalNames.length ? `the ${criticalNames.join(" and ")} parts are critical and must remain ${criticalNames.join("/")}` : "",
    contract.preserveDetails && contract.hasGraphics ? `keep its lettering / graphics exactly as they are` : "",
    `Nestudio may ONLY change the material finish, edge softness, lighting and polish — never the identity above`,
  ].filter(Boolean).join(". ");

  return {
    positive: `${constraints}. ${dna.positive}`,
    negative: `${dna.negative}, recoloured, changed handle colour, changed silhouette, redesigned shape, removed lettering, generic replacement`,
    dnaVersion: dna.dnaVersion,
  };
}
