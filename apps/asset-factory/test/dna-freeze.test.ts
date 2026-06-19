import { describe, it, expect } from "vitest";
import {
  MASTER_PROMPT,
  NEGATIVE_PROMPT,
  NESTUDIO_DNA,
  NESTUDIO_SIGNATURE,
  NESTUDIO_DNA_VERSION,
  STYLE_FROZEN,
  STYLE_ID,
  STYLE_NAME,
} from "@/lib/prompts";
import { PERSONALITIES } from "@/lib/sofa-dna";

// V3.7 production lock. This is a FREEZE GUARD: it pins the locked visual language so
// an accidental edit to the prompt system fails the build. Changing the style on
// purpose means bumping NESTUDIO_DNA_VERSION and updating these expectations.

describe("Nestudio DNA freeze (V3.7 production lock)", () => {
  it("declares the frozen baseline", () => {
    expect(STYLE_FROZEN).toBe(true);
    expect(NESTUDIO_DNA_VERSION).toBe("3.7.0");
    expect(STYLE_ID).toBe("nestudio_v2");
    expect(STYLE_NAME).toBe("Nestudio Master Style V2");
  });

  it("locks the ten Nestudio DNA principles into the prompt system", () => {
    const lib = `${MASTER_PROMPT} ${NESTUDIO_DNA} ${NESTUDIO_SIGNATURE}`.toLowerCase();
    // 1 rounded geometry · 2 soft edge transitions · 3 thick readable silhouettes
    expect(lib).toContain("rounded geometry");
    expect(lib).toContain("softened edges");
    expect(lib).toContain("material transitions");
    expect(lib).toContain("thick readable silhouettes");
    // 4 warm oak detailing · 5 premium matte materials · 6 friendly stylized proportions
    expect(lib).toContain("warm-oak wood detailing");
    expect(lib).toContain("soft matte");
    expect(lib).toContain("friendly-premium proportions");
    // 7 consistent across categories · 9 one universe
    expect(lib).toContain("identical across every product");
    expect(lib).toContain("nestudio world identity");
    // 10 distinct from generic furniture catalogs (negative side)
    expect(NEGATIVE_PROMPT).toContain("generic furniture catalog");
  });

  it("keeps the ten-personality system intact (principle 8 — strong personality)", () => {
    expect(PERSONALITIES).toHaveLength(10);
    expect(PERSONALITIES.filter((p) => p.tier === "safe")).toHaveLength(5);
    expect(PERSONALITIES.filter((p) => p.tier === "bold")).toHaveLength(5);
  });
});
