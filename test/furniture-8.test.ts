import { describe, it, expect } from "vitest";
import { buildFurniture8Prompt, deriveIdentityNotes, FURNITURE_8_VERSION } from "@/lib/asset-pipeline/furniture-8";
import type { IdentityContract } from "@/lib/identity/types";

// furniture@8 is the M35 GPT-Image prompt. Two guarantees are load-bearing:
//   1. Preserve and Simplify produce MEANINGFULLY different instructions (item 6).
//   2. The object-specific identity is stated as fact, and the version is truthful.

describe("furniture@8 prompt", () => {
  const base = { subject: "coffee mug", identityNotes: "- cream ceramic mug\n- black B-shaped handle" };

  it("stamps the truthful version", () => {
    const p = buildFurniture8Prompt({ ...base, mode: "preserve" });
    expect(p.promptVersion).toBe(FURNITURE_8_VERSION);
    expect(FURNITURE_8_VERSION).toBe("furniture@8");
  });

  it("Preserve keeps writing; Simplify strips it — the payloads differ", () => {
    const preserve = buildFurniture8Prompt({ ...base, mode: "preserve" });
    const simplify = buildFurniture8Prompt({ ...base, mode: "simplify" });

    // Different instructions.
    expect(preserve.positive).not.toBe(simplify.positive);

    // Preserve: keep lettering/logos/patterns.
    expect(preserve.positive).toMatch(/Preserve readable lettering/i);
    expect(preserve.negative).not.toMatch(/\blettering\b/i);

    // Simplify: remove writing/logos, and forbid them in the negative.
    expect(simplify.positive).toMatch(/REMOVE writing/i);
    expect(simplify.negative).toMatch(/lettering/i);
    expect(simplify.negative).toMatch(/\bwriting\b/i);
  });

  it("states the priority order and the object-specific identity as fact", () => {
    const p = buildFurniture8Prompt({ ...base, mode: "preserve" });
    expect(p.positive).toMatch(/PRIMARY GOAL/);
    expect(p.positive).toMatch(/IDENTITY — PRESERVE/);
    expect(p.positive).toMatch(/OBJECT-SPECIFIC IDENTITY/);
    expect(p.positive).toMatch(/black B-shaped handle/);
  });

  it("forbids photo/sticker/hand/environment artefacts in both modes", () => {
    for (const mode of ["preserve", "simplify"] as const) {
      const p = buildFurniture8Prompt({ ...base, mode });
      expect(p.negative).toMatch(/photograph/);
      expect(p.negative).toMatch(/sticker/);
      expect(p.negative).toMatch(/\bhand\b/);
    }
  });

  it("derives object identity from a contract (critical colours flagged, placed)", () => {
    const contract: IdentityContract = {
      objectType: "coffee mug",
      preserveDetails: true,
      silhouette: { width: 10, height: 10, aspect: 1, alpha: new Uint8ClampedArray(0) },
      colours: [
        { rgb: [245, 238, 220], coverage: 0.6, bbox: { x: 0.3, y: 0.2, w: 0.4, h: 0.6 }, critical: false },
        { rgb: [20, 18, 16], coverage: 0.2, bbox: { x: 0.02, y: 0.3, w: 0.2, h: 0.4 }, critical: true },
      ],
      criticalColours: [[20, 18, 16]],
      hasGraphics: true,
      source: { width: 10, height: 10, dataUrl: "data:," },
    };
    const notes = deriveIdentityNotes(contract);
    expect(notes).toMatch(/coffee mug/);
    expect(notes).toMatch(/black/); // the critical dark handle
    expect(notes).toMatch(/on the left/); // placed from its bbox
    expect(notes).toMatch(/must stay this colour/); // critical flag surfaced
    expect(notes).toMatch(/lettering|graphics/); // graphics preserved
  });
});
